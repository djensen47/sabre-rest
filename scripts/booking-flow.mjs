#!/usr/bin/env node
/**
 * Manual end-to-end smoke test for the Booking Management v1 service.
 *
 * Runs create → get → modify → cancel against a live Sabre environment
 * (cert by default). Useful after changes to the mappers to catch
 * wire-format issues the unit tests can't see — defaulted fields,
 * envelope shapes, and anything Sabre's runtime actually rejects.
 *
 * Prerequisites:
 *   1. `npm run build` (the script imports the compiled package from
 *      `dist/`).
 *   2. A `.env` file in the current working directory with at minimum
 *      SABRE_CLIENT_ID, SABRE_CLIENT_SECRET, and SABRE_BASE_URL.
 *   3. A JSON file with a valid `createBooking` input payload for your
 *      Sabre cert account (passed via --payload).
 *
 * Usage:
 *   node scripts/booking-flow.mjs --payload path/to/create-booking.json
 *   node scripts/booking-flow.mjs --payload ./payload.json --base-url https://api.cert.platform.sabre.com
 *
 * Flow:
 *   1. createBooking  → capture confirmationId
 *   2. getBooking     → verify + capture bookingSignature
 *   3. modifyBooking  → add a GENERAL remark (safe, minimal change)
 *   4. cancelBooking  → cancelAll: true
 *   5. getBooking     → verify the booking reflects the cancellation
 *
 * If any step after step 1 fails, the script attempts a best-effort
 * cancelBooking as cleanup so test bookings don't leak.
 */

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

try {
  process.loadEnvFile('.env');
} catch (err) {
  if (err?.code !== 'ENOENT') {
    process.stderr.write(`warning: failed to load .env: ${err?.message ?? err}\n`);
  }
}

let sabreRest;
try {
  sabreRest = await import('../dist/index.js');
} catch (err) {
  process.stderr.write(
    `error: failed to import ../dist/index.js — run \`npm run build\` first.\n${err?.message ?? err}\n`,
  );
  process.exit(2);
}
const { createOAuthV2, createSabreClient, SabreApiResponseError } = sabreRest;

const { values } = parseArgs({
  options: {
    payload: { type: 'string' },
    'base-url': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  process.stdout.write(
    'booking-flow — create → get → modify → cancel smoke test\n\n' +
      'Usage: node scripts/booking-flow.mjs --payload <file> [--base-url <url>]\n\n' +
      'Env:\n' +
      '  SABRE_CLIENT_ID, SABRE_CLIENT_SECRET — required (OAuth)\n' +
      '  SABRE_BASE_URL                       — required unless --base-url is given\n',
  );
  process.exit(0);
}

if (!values.payload) {
  process.stderr.write(
    'error: --payload <path> is required (JSON file with a createBooking input).\n',
  );
  process.exit(2);
}

const baseUrl = values['base-url'] ?? process.env.SABRE_BASE_URL;
const missing = [];
if (!process.env.SABRE_CLIENT_ID) missing.push('SABRE_CLIENT_ID');
if (!process.env.SABRE_CLIENT_SECRET) missing.push('SABRE_CLIENT_SECRET');
if (!baseUrl) missing.push('SABRE_BASE_URL (or --base-url)');
if (missing.length > 0) {
  process.stderr.write(`error: missing required configuration: ${missing.join(', ')}\n`);
  process.exit(2);
}

const payloadRaw = await readFile(values.payload, 'utf8');
const createInput = JSON.parse(payloadRaw);

const client = createSabreClient({
  baseUrl,
  auth: createOAuthV2({
    baseUrl,
    clientId: process.env.SABRE_CLIENT_ID,
    clientSecret: process.env.SABRE_CLIENT_SECRET,
  }),
});

function logStep(n, label) {
  const prefix = `\n[${n}] ${label}`;
  process.stdout.write(`${prefix}\n${'-'.repeat(prefix.length - 1)}\n`);
}

function logErr(label, err) {
  process.stderr.write(`\n${label} FAILED\n`);
  if (err instanceof SabreApiResponseError) {
    process.stderr.write(`  statusCode: ${err.statusCode}\n`);
    process.stderr.write(`  body: ${err.body}\n`);
  } else {
    process.stderr.write(`  ${err?.stack ?? err}\n`);
  }
}

let confirmationId;
let cleanupAttempted = false;

async function cleanup() {
  if (!confirmationId || cleanupAttempted) return;
  cleanupAttempted = true;
  process.stderr.write(`\ncleanup: attempting cancelBooking for ${confirmationId}\n`);
  try {
    await client.bookingManagementV1.cancelBooking({
      confirmationId,
      cancelAll: true,
    });
    process.stderr.write('cleanup: cancelBooking succeeded\n');
  } catch (err) {
    logErr('cleanup cancelBooking', err);
  }
}

try {
  // -------------------------------------------------------------------------
  logStep(1, 'createBooking');
  const created = await client.bookingManagementV1.createBooking(createInput);
  confirmationId = created.confirmationId;
  if (!confirmationId) {
    process.stderr.write(
      `create returned no confirmationId. Response: ${JSON.stringify(created, null, 2)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`confirmationId: ${confirmationId}\n`);
  process.stdout.write(`timestamp:      ${created.timestamp ?? '(none)'}\n`);
  if (created.errors?.length) {
    process.stdout.write(`errors:         ${JSON.stringify(created.errors)}\n`);
  }

  // -------------------------------------------------------------------------
  logStep(2, 'getBooking');
  const got = await client.bookingManagementV1.getBooking({ confirmationId });
  const bookingSignature = got.bookingSignature;
  process.stdout.write(`bookingId:       ${got.bookingId ?? '(none)'}\n`);
  process.stdout.write(`bookingSignature: ${bookingSignature ?? '(none)'}\n`);
  process.stdout.write(`isTicketed:      ${got.isTicketed}\n`);
  process.stdout.write(`isCancelable:    ${got.isCancelable}\n`);
  process.stdout.write(`flights:         ${got.flights?.length ?? 0}\n`);
  process.stdout.write(`travelers:       ${got.travelers?.length ?? 0}\n`);
  if (!bookingSignature) {
    throw new Error('getBooking returned no bookingSignature — cannot modify');
  }

  // -------------------------------------------------------------------------
  logStep(3, 'modifyBooking (add GENERAL remark)');
  const modified = await client.bookingManagementV1.modifyBooking({
    confirmationId,
    bookingSignature,
    before: { remarks: got.remarks ?? [] },
    after: {
      remarks: [...(got.remarks ?? []), { type: 'GENERAL', text: 'booking-flow smoke test' }],
    },
    retrieveBooking: true,
  });
  process.stdout.write(`timestamp:  ${modified.timestamp ?? '(none)'}\n`);
  process.stdout.write(`remarks:    ${modified.booking?.remarks?.length ?? 0}\n`);
  if (modified.errors?.length) {
    process.stdout.write(`errors:     ${JSON.stringify(modified.errors)}\n`);
  }

  // -------------------------------------------------------------------------
  logStep(4, 'cancelBooking (cancelAll)');
  const cancelled = await client.bookingManagementV1.cancelBooking({
    confirmationId,
    cancelAll: true,
    retrieveBooking: true,
  });
  cleanupAttempted = true; // don't re-cancel in the finally block
  process.stdout.write(`timestamp:      ${cancelled.timestamp ?? '(none)'}\n`);
  process.stdout.write(`voidedTickets:  ${cancelled.voidedTickets?.length ?? 0}\n`);
  process.stdout.write(`refundedTickets: ${cancelled.refundedTickets?.length ?? 0}\n`);
  process.stdout.write(`flightRefunds:  ${cancelled.flightRefunds?.length ?? 0}\n`);
  if (cancelled.errors?.length) {
    process.stdout.write(`errors:         ${JSON.stringify(cancelled.errors)}\n`);
  }

  // -------------------------------------------------------------------------
  logStep(5, 'getBooking (post-cancel verification)');
  try {
    const after = await client.bookingManagementV1.getBooking({ confirmationId });
    process.stdout.write(`isCancelable: ${after.isCancelable}\n`);
    process.stdout.write(`flights:      ${after.flights?.length ?? 0}\n`);
  } catch (err) {
    if (err instanceof SabreApiResponseError && err.statusCode === 404) {
      process.stdout.write('booking no longer retrievable (404) — cancellation confirmed\n');
    } else {
      throw err;
    }
  }

  process.stdout.write('\nbooking-flow: OK\n');
  process.exit(0);
} catch (err) {
  logErr('booking-flow', err);
  await cleanup();
  process.exit(1);
}
