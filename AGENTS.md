# AGENTS.md

Operational guide for AI agents (and humans) working in this repository.
This file is intentionally short and tactical. For the *why* behind these
rules, read the architecture and decisions documents linked below.

## What this project is

`sabre-rest` is a Sabre REST API client for Node.js, written in TypeScript.
It is a published npm package, ESM-only, dependency-free, server-side.

## Read first

Before making non-trivial changes, read both of these:

- [`docs/architecture.md`](./docs/architecture.md) — reusable architectural
  decisions: public API surface, middleware chain, auth + token store,
  errors, generated types and mapping, service organization, project
  conventions.
- [`docs/decisions.md`](./docs/decisions.md) — Sabre-specific decisions:
  service grouping, naming, OAuth versions, baseUrl, error envelopes,
  spec location, roadmap.

If you make a decision that conflicts with anything in those documents,
update the documents in the same PR. The docs are the source of truth.

## Key conventions you must follow

These are duplicated from the architecture doc on purpose. Internalize them.

### Public API

- The public API is **interfaces and factory functions only**. Concrete
  implementation classes are named `Default*`, live internally, and are
  **not** exported from the package.
- Public-facing variables and parameters are typed to the **interface**,
  never to the `Default*` class.
- Construction goes through factories: `createSabreClient`,
  `createOAuthV2`, `createMemoryTokenStore`, etc. No `new` in the public
  API.

### Generated types

- Generated types live in `src/generated/` and are **purely internal**.
  They are never re-exported, never appear in public types, and never
  leak through error classes.
- Each service has hand-written public types in its own folder. The
  `mappers.ts` file in the service folder translates between public types
  and generated types at the boundary.
- Do not edit files in `src/generated/` by hand. Regenerate them with
  `npm run generate -- <spec-name>` (see [Commands](#commands)).

### Modules and imports

- ESM only. `"type": "module"` in `package.json`.
- All relative imports must include the `.js` extension, even when
  importing a `.ts` file:
  ```ts
  import { foo } from './bar.js';   // correct
  import { foo } from './bar';      // wrong — runtime ERR_MODULE_NOT_FOUND
  ```
- Use `import type` for type-only imports from `src/generated/`.

### File and folder naming

- **Kebab-case** for both files and directories: `oauth-v2.ts`,
  `memory-store.ts`, `air-booking-v3/`.
- Identifiers in code stay camelCase / PascalCase as usual.
- The folder for each service uses the kebab-case form of the
  camelCase service property name: `client.airBookingV3` lives in
  `src/services/air-booking-v3/`.

### Errors

- Throw the appropriate `Sabre*Error` subclass. Never throw raw `Error`s.
- Never let `Response`, `Headers`, or other `fetch`-shaped objects appear
  on a public error class. Use `cause` (the standard `Error` option) to
  preserve the underlying failure for debugging.

### Dependencies

- The package has **zero runtime dependencies**. Do not add any.
- Dev dependencies are fine when needed. Justify additions in the PR
  description.

## Development workflow

1. **Start from clean main**:
   ```bash
   git checkout main
   git pull
   ```
2. **Branch.** Branch names follow `<type>/<short-description>`, where
   `<type>` matches a conventional commit type (`feat`, `fix`, `chore`,
   `docs`, `refactor`, `test`, etc.):
   ```bash
   git checkout -b feat/air-booking-retrieve
   ```
3. **Code.** Make multiple commits as you work. Individual commit
   messages on a feature branch do **not** need to be conventional —
   only the squashed PR commit does (see step 6).
4. **Verify locally** before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. **Push**:
   ```bash
   git push -u origin <branch>
   ```
6. **Open a PR.** The **PR title must be a valid conventional commit
   message** (e.g., `feat: add air-booking-v3 retrieve operation`). The
   PR will be squash-merged, and the squashed commit message becomes the
   PR title — release-please reads it to determine the next version
   bump and generate the changelog entry.
7. **Squash-merge the PR** once it's approved and CI is green. Never
   merge with a merge commit; release-please depends on the squash flow.

### Branch naming conventions

| Type        | When to use                                          |
|-------------|------------------------------------------------------|
| `feat/`     | New feature or capability                            |
| `fix/`      | Bug fix                                              |
| `refactor/` | Internal change that doesn't alter behavior          |
| `docs/`     | Documentation only                                   |
| `test/`     | Test additions or changes                            |
| `chore/`    | Tooling, dependencies, CI, build, repo housekeeping  |

### Commit message conventions

Conventional commits, lowercase, no trailing period:

```
feat: add air-booking-v3 retrieve operation
fix: refresh token before expiry skew margin
docs: clarify TokenStore lock semantics
chore: bump biome to 1.9.5
```

Breaking changes use a `!` after the type:

```
feat!: rename SabreClient.flights to SabreClient.airBookingV3
```

### One PR, one logical change

Don't bundle unrelated changes. A PR adding a new service should not
also bump dependencies or rename a file in another service.

## Release workflow (automated)

Releases are fully automated by [release-please](https://github.com/googleapis/release-please).
You don't need to bump versions, edit `CHANGELOG.md`, or create tags by
hand.

1. PRs are merged to `main` with conventional commit messages.
2. release-please opens (or updates) a "release PR" on `main` that bumps
   the version in `package.json` and updates `CHANGELOG.md` based on the
   conventional commits since the last release.
3. The maintainer reviews and merges the release PR.
4. Merging the release PR creates a tag.
5. The publish workflow fires on the tag, runs lint + typecheck + test +
   build, then publishes to npm with provenance.

The project starts at `0.1.0` and uses minor bumps for new features
until it reaches `1.0.0`.

## Commands

| Command                                  | What it does                                                |
|------------------------------------------|-------------------------------------------------------------|
| `npm install`                            | Install dependencies                                        |
| `npm test`                               | Run the test suite (vitest)                                 |
| `npm run test:watch`                     | Run vitest in watch mode                                    |
| `npm run lint`                           | Lint with Biome                                             |
| `npm run lint:fix`                       | Lint with Biome and apply autofixes                         |
| `npm run format`                         | Format with Biome                                           |
| `npm run typecheck`                      | Run `tsc --noEmit`                                          |
| `npm run build`                          | Compile to `dist/` with `tsc`                               |
| `npm run clean`                          | Remove `dist/`                                              |
| `npm run generate`                       | Regenerate all types from `docs/specs/*`                    |
| `npm run generate -- air-booking-v3`     | Regenerate one spec by basename                             |

## Don'ts

- **Don't commit directly to `main`.** Branch protection enforces this,
  but you should not even try.
- **Don't edit `src/generated/` by hand.** Regenerate via
  `npm run generate`.
- **Don't leak generated types into the public API.** Map at the
  boundary. Use hand-written types in `src/services/<name>/types.ts`.
- **Don't add runtime dependencies** to `package.json`.
- **Don't skip the conventional commit format on PR titles.** It breaks
  release-please.
- **Don't merge with a merge commit.** Squash-merge only.
- **Don't bundle unrelated changes** in one PR.
- **Don't use `new DefaultFooClass()` in tests** as if it were the public
  API. Use the factory functions, just like consumers do.
- **Don't add `Default*` classes to the package's `exports`.**
- **Don't introduce extensions other than `.js` in relative imports.**
