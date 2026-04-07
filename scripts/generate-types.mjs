#!/usr/bin/env node
/**
 * Regenerate TypeScript types from OpenAPI specs in docs/specs/.
 *
 * Usage:
 *   node scripts/generate-types.mjs                       # all specs
 *   node scripts/generate-types.mjs air-booking-v3        # one spec
 *   node scripts/generate-types.mjs air-booking-v3 air-shopping-v2
 *
 * Spec file basename (without extension) is used as the argument and as the
 * generated file name. Accepts .yaml, .yml, and .json inputs.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const specsDir = join(repoRoot, 'docs', 'specs');
const outDir = join(repoRoot, 'src', 'generated');

async function main() {
  await mkdir(outDir, { recursive: true });

  let entries;
  try {
    entries = await readdir(specsDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Specs directory not found: ${specsDir}`);
      process.exit(1);
    }
    throw err;
  }

  const allSpecs = entries
    .filter((f) => /\.(ya?ml|json)$/i.test(f))
    .map((f) => ({ file: f, name: basename(f, extname(f)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (allSpecs.length === 0) {
    console.log('No specs found in docs/specs/. Nothing to generate.');
    return;
  }

  const requested = process.argv.slice(2);
  let specsToGenerate;
  if (requested.length === 0) {
    specsToGenerate = allSpecs;
  } else {
    const known = new Map(allSpecs.map((s) => [s.name, s]));
    const unknown = requested.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      console.error(`Unknown spec(s): ${unknown.join(', ')}`);
      console.error(`Available specs: ${allSpecs.map((s) => s.name).join(', ')}`);
      process.exit(1);
    }
    specsToGenerate = requested.map((n) => known.get(n));
  }

  for (const spec of specsToGenerate) {
    const inputPath = join(specsDir, spec.file);
    const outputPath = join(outDir, `${spec.name}.ts`);
    console.log(`→ ${spec.name}`);
    const result = spawnSync('npx', ['openapi-typescript', inputPath, '--output', outputPath], {
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.error(`Failed to generate ${spec.name}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log('Typechecking generated output...');
  const tscResult = spawnSync('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
  if (tscResult.status !== 0) {
    console.error('Typecheck failed after generation.');
    process.exit(tscResult.status ?? 1);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
