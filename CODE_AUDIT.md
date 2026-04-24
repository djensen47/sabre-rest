# Code Audit

Working document for a cross-cutting review of `src/services/*` and the
shared infrastructure around them. The goal is a punch list, not a
single mega-PR.

## Methodology

1. **Read-only investigation, one dimension at a time.** Each dimension
   below gets its own focused pass across all 8 services. No source-code
   changes during this phase — the only writes are to findings files.
2. **Findings go in individual files** under `findings/` — one file per
   dimension (e.g. `findings/01-deduplication.md`, `findings/02-oop.md`).
   Files are self-contained so each can be read without conversation
   context.
3. **Investigation cadence: calibration + waves.** Run dimension 1 solo
   as a calibration pass to validate finding quality. If the output is
   good, fan out the remaining dimensions in **waves of 3 parallel
   subagents** (Explore subagent_type, read-only). Review each wave's
   findings before launching the next, so a bad prompt template gets
   caught after 3 runs, not 8.
4. **Synthesis pass.** Once all dimension findings are written, read
   them together and reconcile: deduplicate overlaps, flag
   inconsistencies, prioritize.
5. **Action PRs by theme, one at a time.** Ship fixes grouped by
   dimension (one PR for drift, one for OOP, etc.). Small, revertable,
   easy to review.
6. **Sabre is finicky** — never deduplicate on the basis of "looks the
   same today." A shared shape across operations is only safe when the
   OAS uses the same `$ref` (see Dimension 4). When in doubt, leave the
   duplication.

## Dimensions

### 1. Deduplication opportunities (cautious)

**What to look for:** repeated mapper logic, repeated assertion
patterns, repeated test scaffolding, repeated HTTP-call boilerplate
across services.

**Why it matters:** drift between near-duplicate code is harder to
spot than drift between obviously-different code.

**Bad looks like:** four services each implementing the same date
parser inline; identical 20-line HTTP wrapper code copy-pasted across
service files.

**Safety rule:** before merging two shapes, confirm the OAS uses the
same `$ref` for both. If not, leave them separate
(`docs/architecture.md` → Public type design rules).

### 2. OOP guidelines compliance

Rules live in `docs/architecture.md`. Check each service against:

- Public surface is **interfaces + factory functions**; concrete
  implementations are internal and named `Default*`.
- No code depends on private fields, protected methods, prototype
  shape, or `class` identity (e.g. `instanceof DefaultFoo`).
- Concrete classes are **not exported** alongside their interfaces.
- No `I`-prefixed interface names.
- Subclassing of concrete classes does not appear in user code paths.
- Errors use the small shared hierarchy; no per-service error
  subclasses unless the catch-site treatment differs.

### 3. Generated types stay internal

`docs/decisions.md` calls this out as a hard rule.

**What to look for:** any export from `src/generated/*` that escapes
into a public type, JSDoc example, or `index.ts` re-export. Mappers
should consume generated types and emit hand-written public types —
nothing generated should appear on the public surface.

**Bad looks like:** a public response type whose field is typed as
`components['schemas']['Foo']` from the generated file.

### 4. Public type design rules compliance

`docs/architecture.md` → Public type design rules. Three rules:

1. **Same `$ref` → share; same shape today → don't trust it.** Two
   look-alike schemas each get their own public type unless the OAS
   `$ref` is the same.
2. **Optionality mirrors the OAS.** A field that's `required` in the
   spec is required in the public type. No defensive `?` without a
   reason.
3. **Document defensive choices inline.** Any field that's
   intentionally looser than the spec gets a doc comment explaining
   the quirk, ideally pointing at a fixture that reproduces it.

### 5. Cross-service drift

With 8 services added incrementally, drift is the most likely real
finding. Check:

- File layout: does every service have the same files
  (`service.ts`, `mappers.ts`, `types.ts`, `assertions.ts` (?),
  `*.test.ts`)?
- Naming: operation method names, input/output type names, mapper
  function names follow the same conventions across services?
- Mapper signatures: same shape (e.g. `mapFooRequest(input): Generated`,
  `mapFooResponse(generated): Public`)?
- Assertion patterns: same approach for required-field checks across
  services?
- Test structure: `describe` block layout, fixture loading, naming
  conventions all match?

### 6. Mapper purity & symmetry

Mappers should be **pure functions** (per the `add-api` skill).

**What to look for:**
- Side effects in mappers (logging, mutation of inputs, `Date.now()`,
  randomness).
- Hidden field-dropping: a request mapper that quietly omits an input
  field, or a response mapper that doesn't surface a generated field
  the public type claims.
- Round-trip asymmetry: `map(unmap(x))` should be stable for the
  fields the public type carries.

### 7. Public surface hygiene (`src/index.ts`)

**What to look for:**
- Anything exported but never imported anywhere (dead exports).
- Anything imported by tests or callers but not exported.
- Internals accidentally re-exported (concrete classes, generated
  types, helper functions that should be module-private).

### 8. Test coverage parity

Not chasing 100% — chasing **consistency**.

**What to look for:**
- Services with mapper tests but no service tests (or vice versa).
- Services missing the assertion tests their peers have.
- One service's tests cover error paths; others don't.

### 9. Error handling consistency

Each service should surface Sabre errors through the shared error
classes the same way. Look for:

- Bespoke error throwing inside a service that bypasses the shared
  hierarchy.
- Inconsistent error message shapes / metadata fields across services.
- Unhandled rejection paths (e.g. mapper throws a raw `Error` instead
  of a typed Sabre error).

## Findings

Findings live in `findings/`, one file per dimension. Each finding
inside a file follows this template:

```
### short title — service(s)

**Where:** `src/services/foo/mappers.ts:123`
**What:** description of the issue
**Severity:** must-fix / should-fix / nice-to-have
**Belongs in:** Dimension N (only if the finding is more naturally a different dimension)
**Proposed fix:** brief sketch (or "TBD")
```

**Cross-dimension findings — tag in place.** If an investigator
spots something that more naturally belongs to a different dimension,
write the finding in the file where it was found and add a
`**Belongs in:** Dimension N` line. Do not throw it out, do not
move it. The synthesis pass (methodology step 4) reconciles the
overlaps. Discarding signal is worse than mild redundancy.

**Negative findings — non-findings list, not numbered.** Anything
with severity `none` ("checked, no issue found") goes in the
"Non-Findings" section at the bottom of the dimension file, not as
a numbered finding. Numbered findings carry actionable severity
(must-fix / should-fix / nice-to-have). Non-findings are still
useful — they document what was checked — but they're not the
punch list.

Index of dimension files (created as each pass completes):

- `findings/01-deduplication.md`
- `findings/02-oop.md`
- `findings/03-generated-types-internal.md`
- `findings/04-public-type-rules.md`
- `findings/05-cross-service-drift.md`
- `findings/06-mapper-purity.md`
- `findings/07-public-surface-hygiene.md`
- `findings/08-test-coverage-parity.md`
- `findings/09-error-handling-consistency.md`
