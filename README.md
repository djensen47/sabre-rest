# sabre-rest

A Sabre REST API client for Node.js, written in TypeScript.

> **Status**: Early development. The API surface is unstable and subject to
> change until we reach 1.0. See [CHANGELOG.md](./CHANGELOG.md) for releases.

## Requirements

- Node.js 22 or later

## Install

```bash
npm install sabre-rest
```

## Usage

```ts
import { createSabreClient, createOAuthV2, SabreBaseUrls } from 'sabre-rest';

const client = createSabreClient({
  baseUrl: SabreBaseUrls.cert,
  auth: createOAuthV2({
    clientId: process.env.SABRE_CLIENT_ID!,
    clientSecret: process.env.SABRE_CLIENT_SECRET!,
  }),
});

// Service calls coming soon as APIs are added.
```

## CLI

The package ships a `sabre-rest` bin for testing the library against
real Sabre servers. It is **provisional** — flag names and output shapes
can change without notice while the library is at `0.x`.

You can run the CLI either via `npx sabre-rest <command>` (works whether
`sabre-rest` is installed locally in a project, installed globally, or
not installed at all — `npx` will fetch it on demand), or by installing
globally and dropping the prefix:

```bash
npm install -g sabre-rest
sabre-rest --help
```

Examples below use `npx`, but bare `sabre-rest …` works identically
once you've installed globally.

```bash
npx sabre-rest --help
npx sabre-rest airline-lookup --codes AA,BA
npx sabre-rest airline-alliance-lookup --codes "*A,*O" --format table
npx sabre-rest bargain-finder-max \
  --from JFK --to LHR --departure-date 2025-12-25 \
  --pax ADT:1 --cabin Business --non-stop
```

Every command supports `--body <json>` to pass a complete input JSON
object instead of using the per-flag ergonomics.

### Output formats

The CLI emits indented JSON to stdout by default. Pass `--format table`
for a compact human-readable summary:

- `airline-lookup` — one row per airline (`code`, `name`, `alternativeName`)
- `airline-alliance-lookup` — one row per alliance (`code`, `name`, `members`)
- `bargain-finder-max` — one row per priced itinerary (`id`, `legs`, `total`, `carrier`, `model`)

The BFM table is a quick-eyeballing summary, not a full view; switch
back to `--format json` (the default) when you need everything in the
response. Since the JSON output is valid JSON, you can pipe it through
any external tool you prefer for filtering — e.g., if you have `jq`
installed and want to pull out a single field:

```bash
# Optional — only useful if you happen to use jq
npx sabre-rest bargain-finder-max --from JFK --to LHR --departure-date 2025-12-25 \
  | jq '.itineraries[0].totalFare'
```

The CLI itself does not require `jq` or any other external tool to be
useful — both formats are designed to stand on their own.

### Environment

The CLI reads credentials from environment variables and automatically
loads a `.env` file from the current working directory if one exists
(via Node's built-in `process.loadEnvFile`, no dotenv dependency). Copy
`.env.sample` from this repo to `.env` to get started.

| Variable              | Required                                | Notes                                       |
|-----------------------|-----------------------------------------|---------------------------------------------|
| `SABRE_CLIENT_ID`     | yes (every command)                     | OAuth v2 client id                          |
| `SABRE_CLIENT_SECRET` | yes (every command)                     | OAuth v2 client secret                      |
| `SABRE_BASE_URL`      | yes (every command)                     | e.g. `https://api.cert.platform.sabre.com`  |
| `SABRE_COMPANY_CODE`  | no (defaults to `TN`, optional for `bargain-finder-max`) | Agency company code. CLI defaults to `TN` (Sabre's Travel Network channel) — set explicitly only if your account needs a different value. |
| `SABRE_PCC`           | no (optional for `bargain-finder-max`)  | Pseudo city code                            |

## License

[MIT](./LICENSE)
