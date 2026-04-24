# Architecture

This document captures the **reusable** architectural decisions behind
`sabre-rest`. Most of what's here is not Sabre-specific — it describes a
pattern for building any REST client library in TypeScript for Node.js, and
could be lifted into another project with little change.

For decisions that are specific to Sabre's APIs, see
[`decisions.md`](./decisions.md).

Each section follows the same shape: the decision, the reasoning, and the
alternatives we considered and rejected.

---

## Public API surface

### Decision

The public API consists exclusively of **interfaces** and **factory
functions**. Concrete implementation classes exist internally (named
`Default*`) and are not exported from the package.

```ts
// public
export interface SabreClient { /* ... */ }
export function createSabreClient(opts: SabreClientOptions): SabreClient;

// internal — not exported
class DefaultSabreClient implements SabreClient { /* ... */ }
```

Consumers never see `new` or `Default*`. They construct via factories and hold
references typed to the interface.

### Why

- **Program to the interface, not the implementation.** Classic OOP. The
  interface is the contract; the class is one possible fulfilment of it.
- **No leaked implementation details.** Consumers cannot accidentally depend
  on private fields, protected methods, prototype shape, or class identity.
- **Easier to test and mock.** Implementing an interface in a test double is
  trivial; subclassing a concrete class is not.
- **Easier to evolve.** The implementation can be rewritten, replaced, or
  split without changing the public type.

### Alternatives rejected

- **Export the concrete classes alongside interfaces.** Tempting for "power
  users" but creates a second public surface that has to be maintained.
  Consumers reach past the interface and we lose the freedom to refactor.
- **Use `I`-prefixed interfaces (`ISabreClient`).** Microsoft/C# convention,
  not idiomatic in modern TypeScript or in JS at large. The interface is the
  primary name; the class is the secondary.

---

## HTTP layer: middleware chain

### Decision

The HTTP layer is built around a **single ordered middleware chain**.
Middlewares have the uniform shape:

```ts
type Middleware = (
  req: SabreRequest,
  next: (req: SabreRequest) => Promise<SabreResponse>,
) => Promise<SabreResponse>;
```

The chain is invoked outermost-first. Each middleware may inspect or modify
the request, call `next` to pass it down, then inspect or modify the response
on the way back. The terminator (the actual `fetch` call) is built into the
chain runner — it is **not** itself a middleware.

The library installs a small set of **baked-in** middlewares (auth,
error-mapping). Consumer middlewares wrap the baked-ins. The default chain is:

```
[...consumer middleware] → errorMap → auth → fetch
```

### Override mode

Consumers can take full control of the chain by setting
`overrideMiddleware: true`. In override mode, no built-ins are installed and
the consumer is responsible for the entire chain. Passing both `auth:` and
`overrideMiddleware: true` is a construction error — opting out of the
defaults is incompatible with the convenience option.

The library exports the building blocks (`createAuthMiddleware`,
`createErrorMappingMiddleware`) so override users can pick and choose.

### Why

- **One mental model.** A single ordered list is the simplest possible shape.
  No before/after slots, no per-stage hooks, no priority numbers.
- **Composable.** Logging, tracing, metrics, retries, custom headers — all
  fit the same shape and stack arbitrarily.
- **Honest.** The terminator (fetch) is not middleware because it does not
  call `next`. Treating it like middleware would be a lie about the shape.
- **Override is rare but real.** Production users sometimes need to replace
  built-in behavior wholesale (e.g., custom auth flows, alternate transports,
  test fixtures). A single explicit flag is cleaner than escape hatches like
  position markers or branding.

### Alternatives rejected

- **Two-slot middleware (`outer` and `inner`).** Splits "wraps the logical
  call" from "wraps each network attempt." Genuinely useful for some patterns
  but doubles the API surface and asks consumers to think about positioning
  for every middleware. Single-list covers ~95% of the cases.
- **Position markers (e.g., an `AUTH` placeholder constant).** Lets consumers
  reorder a single built-in by placing a sentinel in the array. Doesn't
  generalize — every built-in would need its own marker.
- **Brand the auth middleware** so the client can detect missing or
  duplicated installations. Considered, but rejected in favor of "override
  means override" — if you opt out, you own the consequences.

---

## Authentication

### Decision

Authentication is split into two interfaces:

```ts
interface TokenProvider {
  getToken(): Promise<string>;     // returns a valid token, refreshes if needed
  invalidate(): Promise<void>;     // forces the next getToken to refresh
}

interface TokenStore {
  get(): Promise<StoredToken | null>;
  set(token: StoredToken): Promise<void>;
  clear(): Promise<void>;
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}
```

A `TokenProvider` is constructed via a factory (e.g., `createOAuthV2(...)`)
and holds a `TokenStore`. The store defaults to an in-memory implementation;
consumers can supply their own (Redis, file, encrypted file, etc.) without
touching the provider.

### Refresh strategy

The provider uses **proactive expiry checking** with a 401 fallback:

1. `getToken` reads the store. If a non-expired token exists, return it.
2. Otherwise, refresh: take the store's lock, double-check inside the lock
   (another client may have already refreshed while we waited), then call the
   token endpoint and persist.
3. If a request that used a non-expired token still gets a 401 from the API,
   the auth middleware calls `invalidate()` and retries the request once with
   a fresh token.

Expiry includes a configurable skew margin (default 60 seconds) so we never
hand out a token that dies in flight.

### Distributed locking

`withLock` exists on the store interface to support distributed deployments
where many client instances share a single token via an external store
(e.g., Redis). The lock prevents thundering herds against the token endpoint:
when N clients see an expired token simultaneously, only one fetches a fresh
one and the others read it from the store after the lock releases.

For in-memory stores, `withLock` is a per-instance promise chain. For Redis
or similar, it's a `SETNX`-style distributed lock with a timeout.

### Cluster scoping

Multiple independent groups of clients can share their own token by
constructing separate stores with different key prefixes. The store is
responsible for namespacing both the cached token and the lock under that
prefix. Providers are unaware of clustering — they only know about their
store.

### Why

- **Separation of concerns.** The provider knows *how* to obtain a token; the
  store knows *where* it lives. They evolve independently.
- **Pluggable storage without changing providers.** Adding Redis, file, or
  encrypted-file storage is a single new `TokenStore` implementation.
- **Single-flight refresh, even across processes.** Locking is built into the
  storage interface, so distributed deployments don't need a separate
  coordination mechanism.
- **Proactive expiry beats error-first.** Checking expiry locally avoids
  burning a request and a round-trip just to discover the token is dead.
- **The 401 fallback handles edge cases.** Token rotation, server-side
  revocation, and clock skew can produce a 401 even on a "valid" token. One
  retry recovers without complicating the happy path.

### Alternatives rejected

- **Error-first / lazy refresh.** Try the request, refresh on 401, retry.
  Simpler to write but doubles the latency on every refresh and burns
  requests unnecessarily.
- **Refresh tokens.** OAuth2 client-credentials flows generally don't issue
  refresh tokens — you re-auth with client_id/secret. We don't need them.
- **Single combined `Authenticator` interface** instead of provider + store.
  Conflates "how to obtain" with "where to keep," forcing every storage
  variant to also reimplement the obtain logic.

---

## Errors

### Decision

A small hierarchy of error classes, all extending a single base. No fields
or types from the underlying transport (`Response`, `Headers`, etc.) are
exposed on any error.

```
SabreError                       (base)
├── SabreApiResponseError        (Sabre returned a non-2xx response)
├── SabreAuthenticationError     (auth flow failed)
├── SabreNetworkError            (fetch threw — no response)
├── SabreTimeoutError            (request exceeded its deadline)
└── SabreParseError              (2xx body could not be parsed)
```

Discrimination is via `instanceof`. The base supports the standard `Error`
`cause` option (Node 16.9+), and downstream errors set `cause` to preserve
the underlying failure for debugging without leaking its type into the
public API.

### Why

- **Operational distinctions.** Network errors are usually retryable; HTTP
  4xx errors usually aren't; auth errors mean credentials are wrong; timeouts
  may have different SLAs than network errors. Each maps to a different
  catch-block response.
- **`instanceof` is reliable in Node.** No serialization boundaries to worry
  about, so we don't need a `code` field for cross-realm discrimination.
- **`cause` preserves debuggability without leaking types.** The underlying
  `TypeError` from a failed `fetch` is reachable for logging, but it never
  appears in the public type signature.
- **Minimal surface.** Five categories cover the meaningful failure modes
  without per-status subclasses.

### Alternatives rejected

- **Per-status subclasses** (`SabreNotFoundError`, `SabreRateLimitError`,
  etc.). Premature multiplication. Consumers can check `err.statusCode === 429`
  on `SabreApiResponseError` directly. Add subclasses only when a meaningful
  number of consumers want to catch a specific status.
- **A `code` string field on the base** for programmatic discrimination.
  Useful in environments where `instanceof` is unreliable (cross-realm,
  serialized errors), but for Node-only consumers it's redundant noise. Add
  later if a real need shows up.
- **Normalized `errors[]` field on `SabreApiResponseError`.** Tempting,
  because some APIs return structured error envelopes — but envelope shapes
  vary across Sabre's APIs and "normalize on the way out" is premature
  without seeing real responses. The raw body is preserved on `responseBody`
  for now; we may add a normalized field later, non-breakingly.

---

## Generated types and the mapping layer

### Decision

When the upstream API ships an OpenAPI spec, types are **generated** from
the spec into `src/generated/` and treated as **purely internal**. They are
never re-exported from the package and never appear in the public API.

Each service has hand-written **public types** (input and output shapes) in
its own folder, plus a `mappers.ts` file with pure functions that translate
between public types and generated types at the boundary.

```
src/services/<service-name>/
├── service.ts       # interface + Default* implementation
├── mappers.ts       # to / from functions, namespace-imported as `mappers`
└── types.ts         # public input/output types
```

Mapping function naming uses the `to` / `from` prefix:

```ts
export function toRetrieveRequest(input: PublicInput): GeneratedRequest;
export function fromRetrieveResponse(response: GeneratedResponse): PublicOutput;
```

Beyond the `to` / `from` prefix, the rest of the function name follows
the operation's natural verb/noun — `toLookupRequest`,
`toCreateBookingRequest`, `toGetAncillariesRequest`,
`fromSearchResponse`. There is no mechanical derivation rule. A reader
scanning multiple services should expect the operation name, not a
fixed pattern.

Services consume mappers via a namespace import for grouping at call sites:

```ts
import * as mappers from './mappers.js';

// inside the service method
const wireRequest = mappers.toRetrieveRequest(input);
```

### Why

- **Decouple the public API from upstream's choices.** Generated types tend
  to be verbose, awkward, and full of optionals where the real contract is
  stricter (or vice versa). Hand-written types let us name fields well,
  enforce real invariants, and shield consumers from churn.
- **Generated types are an implementation detail.** When the upstream spec
  changes, only the mapper has to change. Public types stay stable, and
  consumers don't get unexpected breaking changes from a regenerated type.
- **Mappers are pure data transforms.** No DI, no state, no I/O. Functions
  are the right shape; classes would add ceremony for nothing.
- **Colocation.** Everything related to one service lives in one folder.
  Adding an operation touches one directory, not three.

### Alternatives rejected

- **Re-export generated types directly.** Couples the public API to the
  generator's output and to every quirk of the upstream spec. Every regen
  becomes a potential breaking change.
- **Curated re-exports of selected generated types.** A middle ground, but
  still leaks shape and is harder to evolve. If you ever want to rename a
  field, you can't.
- **Centralized mapper directory** (`src/mappers/<service>.ts` parallel to
  `src/services/<service>/`). Forces context-switching across folders for
  every change.

### Public type design rules

Three rules that govern how public types are shaped, derived from
actual drift bugs we've had to fix in this repo:

- **Share a public type across operations only when the OAS uses the
  same `$ref`.** Two schemas that happen to look alike each get their
  own public type. Sabre splits shapes for a reason (different required
  fields, different extension fields), and merging by coincidence hides
  future divergence. The guideline is "same ref → share; same shape
  today → don't trust it."
- **Optionality mirrors the OAS.** If the spec's `required:` list
  includes a field, the public type field is required too. Don't loosen
  a field defensively — an unexplained `?` will be read as a bug by
  future maintainers. If a field is loosened, say why (see next rule).
- **Document defensive choices inline.** If a field is intentionally
  looser than the spec to accommodate a cert-observed quirk, add a doc
  comment on the field explaining the quirk and ideally pointing at a
  test fixture that reproduces it. Without that, the next reader will
  tighten the type to match the spec and break the real-world caller
  the looseness was protecting.

---

## Service organization

### Decision

The client exposes services as properties on a single root object:

```ts
client.<serviceName>.<operation>(input);
```

Services are constructed **eagerly** in the client factory (not lazy
getters). They are not exposed as standalone factories — `createXyzService`
is not part of the public API. The root client is the only construction
path.

How services are *grouped* (by upstream API vs. by domain) is a project-level
trade-off documented in [`decisions.md`](./decisions.md). Both are valid
patterns; the right choice depends on whether the upstream's API boundaries
match your consumers' mental model.

### Why

- **One construction path.** A single factory means one place to wire
  dependencies, one place to read configuration, one place to validate
  options. Standalone service factories double the surface for negligible
  benefit.
- **Eager construction is simpler.** Services are cheap (each holds a few
  references), so lazy getters trade complexity for nothing.
- **Heavy JSDoc instead of runtime metadata.** Each service and method gets
  a thorough doc block. Runtime metadata fields (`info`, `operations`) were
  considered for CLI introspection but rejected — they add per-service
  boilerplate that drifts from the actual code.

### Alternatives rejected

- **Lazy service getters.** The memory savings are imperceptible and the
  complexity is real (proxy traps, getter caching, error handling on first
  access).
- **Standalone service factories** (`createXyzService(deps)`). Allows
  consumers to instantiate one service without the full client. Speculative
  flexibility for a use case nobody has asked for.
- **Runtime `info` field on each service.** Useful for CLI introspection,
  but adds boilerplate and maintenance burden. JSDoc covers the
  documentation case for IDEs, and a CLI can use build-time extraction if
  it ever needs runtime metadata.

---

## Project conventions

### Module system

ESM only. `"type": "module"` in `package.json`. CommonJS is not supported.

Source files use **explicit `.js` extensions** in relative imports:

```ts
import { foo } from './bar.js';   // not './bar' or './bar.ts'
```

This is required by Node's native ESM resolver and is enforced by Biome.
TypeScript leaves the specifier alone, so the source matches the emitted
output exactly.

### Build

Plain `tsc`. No bundler. The library is server-side, dependency-free, and
has no need for tree-shaking, minification, or single-file output. Avoiding
a bundler removes a layer of configuration and keeps source files
1:1 with emitted files.

`tsconfig.json` is configured with `module: NodeNext`, `moduleResolution:
NodeNext`, `target: ES2022`, `strict: true`, plus
`noUncheckedIndexedAccess` and `noImplicitOverride`. We do **not** enable
`exactOptionalPropertyTypes` — it interacts poorly with generated code and
common spread patterns.

### File and folder naming

Kebab-case for both files and directories. Identifiers in code are
camelCase / PascalCase as usual. The conversion at the import boundary
is the same as every npm package import (`react-dom` → `ReactDOM`), so
there's no real cognitive cost.

### Linting and formatting

[Biome](https://biomejs.dev) handles both. Single tool, single config,
fast. Generated files are excluded from both lint and format.

### Versioning and releases

Conventional commits + [release-please](https://github.com/googleapis/release-please).
Pushing conventional commits to `main` causes release-please to open a
"release PR" that bumps the version in `package.json` and updates
`CHANGELOG.md`. Merging the release PR creates a tag, which triggers a
publish workflow that runs lint, typecheck, test, build, and finally
`npm publish --provenance`.

The project starts at `0.1.0` and uses minor bumps for new features until
it reaches `1.0.0`.

### Why

- **ESM only** is the modern Node default and avoids dual-publish complexity.
- **`tsc` only** keeps the build trivial and the output transparent.
- **Kebab-case files** match the dominant npm ecosystem convention and
  avoid case-sensitivity bugs across platforms.
- **Biome** replaces ESLint + Prettier with one fast tool and zero plugin
  ecosystem to maintain.
- **release-please** automates versioning and changelog generation while
  preserving the "tag triggers publish" model and supporting solo work
  without commit hooks.
