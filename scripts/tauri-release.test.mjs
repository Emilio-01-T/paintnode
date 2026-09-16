import assert from 'node:assert/strict';
import test from 'node:test';

import { debBundleDirectory, requestsDebBundle } from './tauri-release.mjs';

test('detects whether a Tauri build includes a Debian bundle', () => {
  assert.equal(requestsDebBundle(['build', '--bundles', 'deb,appimage']), true);
  assert.equal(requestsDebBundle(['build', '--bundles=appimage,deb']), true);
  assert.equal(requestsDebBundle(['build', '--bundles', 'appimage']), false);
  assert.equal(requestsDebBundle(['build']), true);
});

test('resolves native and target-specific Debian bundle directories', () => {
  assert.equal(
    debBundleDirectory('/repo', ['build', '--bundles', 'deb']),
    '/repo/src-tauri/target/release/bundle/deb',
  );
  assert.equal(
    debBundleDirectory('/repo', [
      'build',
      '--debug',
      '--target=x86_64-unknown-linux-gnu',
      '--bundles',
      'deb',
    ]),
    '/repo/src-tauri/target/x86_64-unknown-linux-gnu/debug/bundle/deb',
  );
});
