#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[updater] ${message}`);
}

export function verifyUpdaterJson(
  manifest,
  { version, repository, requiredTargets, releaseAssets },
) {
  if (!manifest || typeof manifest !== 'object') fail('latest.json must contain an object');
  if (manifest.version !== version) {
    fail(`version ${String(manifest.version)} does not match ${version}`);
  }
  if (!manifest.platforms || typeof manifest.platforms !== 'object') {
    fail('latest.json is missing its platforms object');
  }

  const expectedDownloadPath = `/${repository}/releases/download/paintnode-v${version}/`;
  const expectedApiPath = `/repos/${repository}/releases/assets/`;
  const currentReleaseUrls = releaseAssets
    ? new Set(
        releaseAssets.flatMap((asset) =>
          [asset?.apiUrl, asset?.url].filter((value) => typeof value === 'string'),
        ),
      )
    : null;
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
    const taggedDownload =
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith(expectedDownloadPath);
    const apiAsset =
      url.protocol === 'https:' &&
      url.hostname === 'api.github.com' &&
      url.pathname.startsWith(expectedApiPath) &&
      /^\d+$/.test(url.pathname.slice(expectedApiPath.length));
    if (!taggedDownload && !apiAsset) {
      fail(`${target} does not point to the ${repository} release channel for paintnode-v${version}`);
    }
    if (currentReleaseUrls && !currentReleaseUrls.has(entry.url)) {
      fail(`${target} does not point to an asset attached to paintnode-v${version}`);
    }
  }

  return requiredTargets.map((target) => ({ target, url: manifest.platforms[target].url }));
}

async function main() {
  const [, , manifestPath, ...args] = process.argv;
  let releaseAssetsPath;
  if (args[0] === '--release-assets') {
    releaseAssetsPath = args[1];
    args.splice(0, 2);
  }
  const requiredTargets = args;
  if (!manifestPath || requiredTargets.length === 0) {
    fail('usage: verify-updater-json.mjs FILE [--release-assets FILE] TARGET [TARGET ...]');
  }
  const root = resolve(import.meta.dirname, '..');
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const repository = new URL(packageJson.repository.url).pathname.replace(/^\//, '').replace(/\.git$/, '');
  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
  const releaseAssets = releaseAssetsPath
    ? JSON.parse(await readFile(resolve(releaseAssetsPath), 'utf8')).assets
    : undefined;
  if (releaseAssetsPath && !Array.isArray(releaseAssets)) {
    fail('release assets file must contain an assets array');
  }
  const verified = verifyUpdaterJson(manifest, {
    version: packageJson.version,
    repository,
    requiredTargets,
    releaseAssets,
  });
  for (const entry of verified) console.log(`[updater] verified ${entry.target}: ${entry.url}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
