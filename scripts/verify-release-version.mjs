#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function fail(message) {
  throw new Error(`[release-version] ${message}`);
}

function capture(relativePath, pattern, label) {
  const match = read(relativePath).match(pattern);
  if (!match) fail(`could not read ${label} from ${relativePath}`);
  return match[1];
}

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const version = packageJson.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json contains an invalid semantic version: ${String(version)}`);
}

const versions = new Map([
  ['package-lock.json', packageLock.version],
  ['package-lock.json workspace root', packageLock.packages?.['']?.version],
  ['src-tauri/tauri.conf.json', JSON.parse(read('src-tauri/tauri.conf.json')).version],
  [
    'src-tauri/Cargo.toml',
    capture('src-tauri/Cargo.toml', /^\[package\][\s\S]*?^version = "([^"]+)"/m, 'package version'),
  ],
  [
    'src-tauri/Cargo.lock',
    capture(
      'src-tauri/Cargo.lock',
      /^\[\[package\]\]\s*\nname = "paintnode"\s*\nversion = "([^"]+)"/m,
      'locked PaintNode version',
    ),
  ],
  [
    'src-tauri/macos/quicklook/PaintNodeORAPreview-Info.plist',
    capture(
      'src-tauri/macos/quicklook/PaintNodeORAPreview-Info.plist',
      /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
      'Quick Look preview version',
    ),
  ],
  [
    'src-tauri/macos/quicklook/PaintNodeORAThumbnail-Info.plist',
    capture(
      'src-tauri/macos/quicklook/PaintNodeORAThumbnail-Info.plist',
      /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
      'Quick Look thumbnail version',
    ),
  ],
]);

for (const [file, candidate] of versions) {
  if (candidate !== version) fail(`${file} uses ${candidate}; expected ${version}`);
}

const releaseNotes = resolve(root, 'docs', 'release-notes', `${version}.md`);
if (!existsSync(releaseNotes)) fail(`missing docs/release-notes/${version}.md`);

if (process.env.GITHUB_REF_TYPE === 'tag') {
  const expectedTag = `paintnode-v${version}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    fail(`tag ${String(process.env.GITHUB_REF_NAME)} does not match ${expectedTag}`);
  }
}

console.log(`[release-version] ${version} is synchronized across app, Rust, Quick Look, notes, and tag`);
