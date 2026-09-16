import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyManagedRuntimeTarget } from './verify-managed-runtime-manifest.mjs';

function manifestFor(artifacts) {
  return {
    schemaVersion: 1,
    packages: ['codex', 'claude'].map((provider) => ({
      provider,
      packageVersion: '5.0.0',
      protocolVersion: 5,
      minimumPaintNodeVersion: '0.2.5',
      artifacts: artifacts.map(({ os, arch }) => ({
        os,
        arch,
        url: `https://example.invalid/${provider}-${os}-${arch}.zip`,
        sha256: 'ab'.repeat(32),
        size: 42,
      })),
    })),
  };
}

test('release preflight accepts complete compatible provider targets', () => {
  const verified = verifyManagedRuntimeTarget(
    manifestFor([{ os: 'linux', arch: 'x64' }]),
    { os: 'linux', arch: 'x64', currentVersion: '0.2.6' },
  );
  assert.deepEqual(verified.map((entry) => entry.provider), ['codex', 'claude']);
});

test('release preflight rejects missing targets and incompatible protocol versions', () => {
  assert.throws(
    () => verifyManagedRuntimeTarget(
      manifestFor([{ os: 'darwin', arch: 'arm64' }]),
      { os: 'linux', arch: 'x64', currentVersion: '0.2.6' },
    ),
    /not published for linux-x64/,
  );

  const manifest = manifestFor([{ os: 'linux', arch: 'x64' }]);
  manifest.packages[0].protocolVersion = 4;
  assert.throws(
    () => verifyManagedRuntimeTarget(
      manifest,
      { os: 'linux', arch: 'x64', currentVersion: '0.2.6' },
    ),
    /protocol 4 does not match 5/,
  );
});
