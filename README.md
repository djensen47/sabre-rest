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

## License

[MIT](./LICENSE)
