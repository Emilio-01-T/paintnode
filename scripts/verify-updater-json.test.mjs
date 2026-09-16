import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyUpdaterJson } from './verify-updater-json.mjs';

const options = {
  version: '1.2.3',
  repository: 'Emilio-01-T/paintnode',
  requiredTargets: [
    'linux-x86_64',
    'linux-x86_64-appimage',
    'linux-x86_64-deb',
  ],
};

function fixture() {
  return {
    version: '1.2.3',
    platforms: Object.fromEntries(
      options.requiredTargets.map((target) => [
        target,
        {
          signature: `signature-${target}`,
          url: `https://github.com/Emilio-01-T/paintnode/releases/download/paintnode-v1.2.3/PaintNode-${target}`,
        },
      ]),
    ),
  };
}

test('accepts a complete updater manifest for this release channel', () => {
  assert.equal(verifyUpdaterJson(fixture(), options).length, options.requiredTargets.length);
});

test('accepts tauri-action v1 API URLs only when they belong to the current release', () => {
  const manifest = fixture();
  const releaseAssets = options.requiredTargets.map((target, index) => {
    const apiUrl = `https://api.github.com/repos/Emilio-01-T/paintnode/releases/assets/${1000 + index}`;
    manifest.platforms[target].url = apiUrl;
    return { apiUrl, url: `https://github.com/Emilio-01-T/paintnode/releases/download/paintnode-v1.2.3/PaintNode-${target}` };
  });

  assert.equal(
    verifyUpdaterJson(manifest, { ...options, releaseAssets }).length,
    options.requiredTargets.length,
  );

  const stale = structuredClone(manifest);
  stale.platforms['linux-x86_64-deb'].url =
    'https://api.github.com/repos/Emilio-01-T/paintnode/releases/assets/9999';
  assert.throws(
    () => verifyUpdaterJson(stale, { ...options, releaseAssets }),
    /not point to an asset attached/,
  );
});

test('rejects missing targets, signatures, versions, and foreign repositories', () => {
  const missing = fixture();
  delete missing.platforms['linux-x86_64-deb'];
  assert.throws(() => verifyUpdaterJson(missing, options), /missing linux-x86_64-deb/);

  const unsigned = fixture();
  unsigned.platforms['linux-x86_64-appimage'].signature = '';
  assert.throws(() => verifyUpdaterJson(unsigned, options), /no updater signature/);

  const wrongVersion = fixture();
  wrongVersion.version = '1.2.4';
  assert.throws(() => verifyUpdaterJson(wrongVersion, options), /does not match/);

  const foreign = fixture();
  foreign.platforms['linux-x86_64'].url =
    'https://github.com/white-cornerstone/paintnode/releases/download/paintnode-v1.2.3/PaintNode';
  assert.throws(() => verifyUpdaterJson(foreign, options), /does not point/);

  const foreignApi = fixture();
  foreignApi.platforms['linux-x86_64'].url =
    'https://api.github.com/repos/white-cornerstone/paintnode/releases/assets/1234';
  assert.throws(() => verifyUpdaterJson(foreignApi, options), /does not point/);
});
