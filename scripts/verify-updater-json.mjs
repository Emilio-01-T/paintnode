#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[updater] ${message}`);
}

export function verifyUpdaterJson(
  manifest,
  { version, repository, requiredTargets },
) {
  if (!manifest || typeof manifest !== 'object') fail('latest.json must contain an object');
  if (manifest.version !== version) {
    fail(`version ${String(manifest.version)} does not match ${version}`);
  }
  if (!manifest.platforms || typeof manifest.platforms !== 'object') {
    fail('latest.json is missing its platforms object');
  }

  const expectedPath = `/${repository}/releases/download/paintnode-v${version}/`;
  for (const target of requiredTargets) {
    const entry = manifest.platforms[target];
    if (!entry || typeof entry !== 'object') fail(`latest.json is missing ${target}`);
    if (typeof entry.signature !== 'string' || !entry.signature.trim()) {
      fail(`${target} has no updater signature`);
    }
    let url;
    try {
      url = new URL(entry.url);
    } catch {
      fail(`${target} has an invalid updater URL`);
    }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith(expectedPath)) {
      fail(`${target} does not point to ${repository} tag paintnode-v${version}`);
    }
  }

  return requiredTargets.map((target) => ({ target, url: manifest.platforms[target].url }));
}

async function main() {
  const [, , manifestPath, ...requiredTargets] = process.argv;
  if (!manifestPath || requiredTargets.length === 0) {
    fail('usage: verify-updater-json.mjs FILE TARGET [TARGET ...]');
  }
  const root = resolve(import.meta.dirname, '..');
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const repository = new URL(packageJson.repository.url).pathname.replace(/^\//, '').replace(/\.git$/, '');
  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
  const verified = verifyUpdaterJson(manifest, {
    version: packageJson.version,
    repository,
    requiredTargets,
  });
  for (const entry of verified) console.log(`[updater] verified ${entry.target}: ${entry.url}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
