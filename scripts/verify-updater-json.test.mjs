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
});
