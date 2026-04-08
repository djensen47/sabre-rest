#!/usr/bin/env node
/**
 * Entry point for the `sabre-rest` CLI bin.
 *
 * Kept intentionally tiny: a shebang, optional `.env` loading, and a
 * call into {@link run}. All testable logic lives in `cli-impl.ts` so
 * the bin file itself has nothing to unit-test.
 */

import { run } from './cli-impl.js';

// Load a `.env` file from the current working directory if it exists.
// `process.loadEnvFile` is built into Node 21.7+ (stable in 22), so this
// adds a `.env` workflow without pulling in dotenv as a dependency.
// Existing process.env values win over file values, matching the
// principle of least surprise for shell-exported env vars.
//
// Only "no such file" errors are silently swallowed — every other failure
// (a malformed file, a permission error, etc.) is surfaced to stderr and
// the CLI continues with whatever env vars are already set in the shell.
// Silently swallowing parse errors hides real bugs in the user's .env.
try {
  process.loadEnvFile('.env');
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`warning: failed to load .env: ${message}\n`);
  }
}

const exitCode = await run(process.argv.slice(2), process.env);
process.exit(exitCode);
