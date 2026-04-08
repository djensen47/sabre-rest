---
name: add-api
description: Add a new Sabre service to the sabre-rest package end-to-end. Generates types from an OpenAPI spec in docs/specifications/, scaffolds the service folder with hand-written public types and pure mapper functions, wires the new service into createSabreClient, re-exports the public types, and writes tests at the mapper and service levels. Use when the user asks to add a new Sabre API, implement a new endpoint, or wrap a Sabre OpenAPI spec they have placed in docs/specifications/.
---

# Add a new Sabre API service

This skill walks through adding a new Sabre service to `sabre-rest` end-to-end. It assumes the foundation in `src/` is already in place (see `docs/architecture.md`).

## Required reading first

Read these before doing any work. They contain the *why* behind the conventions this skill enforces:

- `docs/architecture.md` — public API surface, service organization, mapping layer, the "generated types stay internal" rule, and the project conventions.
- `docs/decisions.md` — service grouping (per Sabre API, not per domain), service naming (camelCase + version suffix), error envelope handling, baseUrl rule.
- `AGENTS.md` — operational rules and don'ts.

If something in this skill conflicts with those documents, the documents win and you should update this skill.

## Prerequisites

Before invoking this skill the user must have:

1. Dropped the Sabre OpenAPI spec at `docs/specifications/<basename>.yml` (or `.yaml` / `.json`).
2. A clean main branch checked out (or at least no uncommitted work that would conflict). You will create a feature branch shortly.

If the spec is not present, stop and tell the user where to put it. Do not invent or fetch a spec on the user's behalf.

## Inputs

- `<spec-basename>` — the basename of the spec file in `docs/specifications/` with no extension. Example: `airline-lookup` for `docs/specifications/airline-lookup.yml`.

## Step-by-step

### 1. Verify the spec exists and read it end-to-end

Use `Glob` or `ls` to confirm `docs/specifications/<basename>.*` exists. If it does not, stop and tell the user.

Read the spec file in full. You need to understand:

- The API's `info.title` and `info.version` (these drive naming).
- Each operation: HTTP method, path, query / path / body parameters, request body shape (if any), response shape, and which response codes Sabre documents.
- The `securitySchemes` section (typically `oauth2_authentication` — this confirms the service uses bearer auth, which the baked-in middleware already handles).
- Any quirks: deeply nested envelopes, fields that look required but are marked optional, multiple operations sharing types, etc.

### 2. Run the type generator

```bash
npm run generate -- <basename>
```

This produces `src/generated/<basename>.ts`. The script also runs `tsc --noEmit` after generation to verify the output compiles. If generation or the post-generation typecheck fails, stop and tell the user — don't try to hand-edit the generated file.

### 3. Decide and confirm the service identifiers

These come from the OAS `info` block plus a hand-curated short form. Confirm with the user (or propose, then confirm) before writing files. Worked example using `info.title: "Airline Lookup"`, `info.version: "v1"`:

| Thing                        | Convention                                        | Example                          |
|------------------------------|---------------------------------------------------|----------------------------------|
| Service identifier           | camelCase, version suffix                         | `airlineLookupV1`                |
| Folder name                  | kebab-case form of the identifier                 | `src/services/airline-lookup-v1/`|
| Public interface name        | PascalCase, ends in `Service`                     | `AirlineLookupV1Service`         |
| Internal class name          | `Default` prefix on the interface                 | `DefaultAirlineLookupV1Service`  |

The internal class is **never** exported from the package.

For each operation in the spec, decide a method name. Sabre's `operationId` is often awkward (`airlinesLookup`, `CreateBargainFinderMax`) — hand-curate something idiomatic for the call site. Note the source `operationId` in JSDoc so the link back to Sabre's docs is preserved.

### 4. Create the service folder

Create `src/services/<folder>/` with three files: `types.ts`, `mappers.ts`, `service.ts`.

### 5. Write `types.ts` — hand-written public types

For each operation, define:

- An **input type** named `<MethodName>Input` (e.g., `LookupAirlinesInput`). Always a single object — no positional parameters, even if there's only one field. This makes future additions non-breaking.
- An **output type** named `<MethodName>Output` (e.g., `LookupAirlinesOutput`). When the result is a list, wrap it in a property name (`{ airlines: Airline[] }`) so adding sibling fields later is non-breaking.
- **Domain types** (e.g., `Airline`, `AirlineAlliance`). Plain interfaces, idiomatic camelCase, required fields where the public contract demands them.

**Critical**: do not import anything from `src/generated/` here. This file is the public contract. Generated types are an implementation detail of the mapper.

JSDoc every type and every field. Heavy documentation is the convention — use it to explain Sabre quirks, valid value ranges, and what optional fields mean.

### 6. Write `mappers.ts` — pure data transforms

Two functions per operation:

- `to<MethodName>Request(baseUrl: string, input?: <Input>): SabreRequest` — builds the outgoing request.
- `from<MethodName>Response(res: SabreResponse): <Output>` — parses and maps the response.

#### Imports

```ts
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/<basename>.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { /* public types */ } from './types.js';
```

The generated import **must** be `import type`. A value-level import would emit a runtime require for an empty module.

#### URL building

Use Node's `URL` and `URLSearchParams`:

```ts
const url = new URL(PATH, ensureTrailingSlash(baseUrl));
if (input?.codes && input.codes.length > 0) {
  url.searchParams.set('alliancecode', input.codes.join(','));
}
```

Helpful facts about Node's URL behavior:

- `new URL(PATH, base)` requires `base` to end with `/` for `PATH` to resolve correctly. Use a small `ensureTrailingSlash` helper.
- `URLSearchParams` leaves `*` raw in query strings (it's a sub-delimiter, not a reserved character). Comma is percent-encoded as `%2C`. The resulting URL matches what Sabre's docs show — don't fight it.

#### Response parsing

Wrap `JSON.parse` in a try/catch and throw `SabreParseError` on failure (preserve the raw body and the underlying error via `cause`):

```ts
let parsed: components['schemas']['SomeResponse'];
try {
  parsed = JSON.parse(res.body) as components['schemas']['SomeResponse'];
} catch (err) {
  throw new SabreParseError('Failed to parse <Service> response as JSON', res.body, { cause: err });
}
if (parsed === null || typeof parsed !== 'object') {
  throw new SabreParseError('<Service> response was not a JSON object', parsed);
}
```

#### Be lenient with the response shape

Sabre marks most fields optional in the OAS even when they're effectively required. Skip records missing the fields your public type requires rather than failing the whole call. Consumers are better served by partial data than nothing.

```ts
const items: Airline[] = [];
for (const item of parsed.AirlineInfo ?? []) {
  if (!item.AirlineCode || !item.AirlineName) continue;
  items.push({ code: item.AirlineCode, name: item.AirlineName });
}
```

#### Pure functions only

No classes, no DI, no I/O beyond the response object passed in. Mappers are data transforms.

### 7. Write `service.ts` — interface + internal class

Template:

```ts
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { /* public input/output types */ } from './types.js';

/**
 * Sabre <Title> v<n>.
 *
 * <one or two sentences from the OAS info.description, rephrased>
 *
 * Source: Sabre API "<Title>" v<n>
 *   - Operation: `<operationId>` (`<METHOD> <path>`)
 *   - Docs: https://developer.sabre.com/docs/...
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface <Name>Service {
  /**
   * <one-line summary>
   *
   * @param input <description of input>
   * @returns <description of output>
   */
  <method>(input?: <Input>): Promise<<Output>>;
}

/**
 * Internal implementation of {@link <Name>Service}. Not exported from the
 * package; consumers obtain instances exclusively via {@link createSabreClient}.
 */
export class Default<Name>Service implements <Name>Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async <method>(input?: <Input>): Promise<<Output>> {
    const req = mappers.to<Method>Request(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.from<Method>Response(res);
  }
}
```

Key conventions:

- The mappers import is a **namespace import** (`import * as mappers`). This is the project convention — call sites read `mappers.toFooRequest(...)` consistently across services.
- The class uses **private fields** (`#baseUrl`, `#request`). They are part of the internal implementation and never visible.
- **Heavy JSDoc** on the interface and every method. Always link to Sabre's docs and name the source operation.

### 8. Wire the service into `src/client.ts` — five places

This is the easiest step to get wrong. **All five updates are required.** Search for the existing `airlineLookupV1` references in `src/client.ts` and follow the same pattern; the diff will be additive.

1. **Imports** — add the service interface (type-only) and the `Default*` class:
   ```ts
   import {
     type <Name>Service,
     Default<Name>Service,
   } from './services/<folder>/service.js';
   ```

2. **`SabreClient` interface** — add the readonly property with JSDoc:
   ```ts
   /**
    * Sabre <Title> v<n>.
    * <one-line summary>
    */
   readonly <serviceIdentifier>: <Name>Service;
   ```

3. **`createSabreClient` factory body** — instantiate inside the factory after `chain` and `deps` are built:
   ```ts
   const <serviceIdentifier> = new Default<Name>Service(deps);
   ```
   And include it in the construction call:
   ```ts
   return new DefaultSabreClient(chain, { /* existing services */, <serviceIdentifier> });
   ```

4. **`SabreClientServices` interface** — add the new field:
   ```ts
   <serviceIdentifier>: <Name>Service;
   ```

5. **`DefaultSabreClient` class** — add the readonly field, assign it in the constructor:
   ```ts
   readonly <serviceIdentifier>: <Name>Service;
   // ...
   constructor(run, services) {
     // ...
     this.<serviceIdentifier> = services.<serviceIdentifier>;
   }
   ```

If you forget any one of these, `tsc` will tell you. Don't ignore type errors here — fix them by updating whichever spot is missing.

### 9. Re-export public types from `src/index.ts`

Add (under the `// Services` comment):

```ts
export type { <Name>Service } from './services/<folder>/service.js';
export type {
  <PublicTypeA>,
  <PublicTypeB>,
  /* ...all the public types from types.ts... */
} from './services/<folder>/types.js';
```

**Do not export the `Default*` class.** The interface and the input/output/domain types are the public surface.

### 10. Write tests

Two test files for the service. Use `vitest`.

#### `mappers.test.ts` — pure unit tests

No `fetch`, no client. Test `to*` and `from*` directly. Cover at minimum:

- URL building with no input (omits the optional query param)
- URL building with empty input arrays (still omits the param)
- URL building with one or more values (correct comma separation, correct percent-encoding)
- URL building with a base URL that ends in a trailing slash (does not break)
- Response mapping for a populated response
- Response mapping for an empty response (`AirlineInfo: undefined` or `[]`)
- Response mapping that drops items missing required fields
- Parse error: body that is not valid JSON → `SabreParseError`
- Parse error: body that is JSON but not an object → `SabreParseError`

#### `service.test.ts` — integration through `createSabreClient`

Construct a client with a fake `TokenProvider` and a stubbed global `fetch`. Verify:

- The service is reachable as `client.<serviceIdentifier>`.
- Calling the method issues a `fetch` to the correct URL.
- The `Authorization: Bearer <token>` header is attached.
- The `Accept: application/json` header is attached.
- A 2xx response is mapped through the mapper to the public output type.
- A non-2xx response surfaces as `SabreApiResponseError` (the baked-in error mapper handles this — verify by checking `name` and `statusCode`).

Test scaffolding:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

describe('<Name>Service.<method>', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ...tests
});
```

When mocking responses for a path that may retry (e.g., the auth-on-401 path), use `mockImplementation(() => new Response(...))` rather than `mockResolvedValue(new Response(...))`. `Response` bodies are streams that can only be read once; `mockResolvedValue` returns the same instance every call and the second `text()` will throw.

### 11. Run the quality gate

```bash
npm run lint:fix
npm run typecheck
npm test
npm run build
```

All four must pass. Common failures and fixes:

- **Lint formatter complaints** — run `npm run lint:fix` first; it autofixes the safe issues. For `noUnusedTemplateLiteral` and other "unsafe fix" suggestions, fix them by hand (replace template literals with plain strings when no interpolation is used).
- **Lint import sort** — autofix handles it.
- **Typecheck error in `client.ts`** — almost always a missed wiring step. Re-check all five places in step 8.
- **Test fails with `Body is unusable`** — `Response` body was consumed twice. Use `mockImplementation` to return a fresh `Response` each call.
- **Test URL assertion fails** — usually a wrong assumption about percent-encoding. Print the actual URL and compare; trust the URL class output and update the assertion.

### 12. Stop. Let the user review.

Do not commit, push, or open a PR without explicit user confirmation. Summarize what changed:

- New files created (list them)
- Modified files (`src/client.ts`, `src/index.ts`)
- Test count delta
- Any decisions made about the public type shape (especially places where you intentionally exposed less than what Sabre returns)
- Any drive-by refactors (e.g., extracting a helper if a pattern emerged from the new service)

Then ask the user how they want to proceed.

## Don'ts

- **Don't export the `Default*` class.** Ever. The interface plus the input/output/domain types is the entire public surface.
- **Don't import generated types in `types.ts`.** Generated types appear only in `mappers.ts`, and only as `import type`.
- **Don't reach for the OpenAPI `operationId`** as the method name without checking how it reads at the call site. Hand-curate.
- **Don't add validation** in the service. The architecture explicitly defers validation to the consumer's gateway/repository layer.
- **Don't normalize Sabre's error envelope** in the service. `SabreApiResponseError` carries the raw body; consumers handle it.
- **Don't add runtime dependencies.** The package is dependency-free.
- **Don't bundle unrelated changes.** If you spot something else worth fixing, flag it and let the user decide whether to do it in this PR or a separate one.
- **Don't commit, push, or open a PR without explicit confirmation** from the user. The user reviews first.

## Summary checklist

When the work is done, confirm every box:

- [ ] Spec at `docs/specifications/<basename>.<ext>`
- [ ] Generated types at `src/generated/<basename>.ts`
- [ ] `src/services/<folder>/types.ts` — public types, no generated imports
- [ ] `src/services/<folder>/mappers.ts` — pure functions, type-only generated import
- [ ] `src/services/<folder>/service.ts` — interface + internal `Default*` class
- [ ] `src/client.ts` — five wiring updates (imports, `SabreClient` interface property, factory body construction, `SabreClientServices`, `DefaultSabreClient`)
- [ ] `src/index.ts` — public type re-exports (no `Default*`)
- [ ] `src/services/<folder>/mappers.test.ts`
- [ ] `src/services/<folder>/service.test.ts`
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all green
- [ ] Stopped for user review (no commit / push / PR yet)
