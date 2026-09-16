#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const bundleDirectory = join(root, 'src-tauri', 'target', 'release', 'bundle', 'deb');

function fail(message) {
  throw new Error(`[linux-deb] ${message}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit status ${result.status}`;
    fail(`${command} ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout.trim();
}

function newestDeb() {
  if (!existsSync(bundleDirectory)) return null;
  return readdirSync(bundleDirectory)
    .filter((name) => name.endsWith('.deb'))
    .map((name) => join(bundleDirectory, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0] ?? null;
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function pngDimensions(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(`${path} is not a valid PNG icon`);
  }
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function desktopEntries(path) {
  return new Map(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const explicitPath = process.argv[2];
const debPath = explicitPath ? resolve(explicitPath) : newestDeb();
if (!debPath || !existsSync(debPath)) {
  fail(`no Debian package found${explicitPath ? ` at ${debPath}` : ` in ${bundleDirectory}`}`);
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const expectedArchitecture = new Map([['x64', 'amd64'], ['arm64', 'arm64']]).get(process.arch);
const packageName = run('dpkg-deb', ['--field', debPath, 'Package']);
const packageVersion = run('dpkg-deb', ['--field', debPath, 'Version']);
const architecture = run('dpkg-deb', ['--field', debPath, 'Architecture']);
const dependencies = run('dpkg-deb', ['--field', debPath, 'Depends']);

if (packageName !== 'paint-node') fail(`unexpected package name: ${packageName}`);
if (packageVersion !== packageJson.version) {
  fail(`package version ${packageVersion} does not match package.json ${packageJson.version}`);
}
if (expectedArchitecture && architecture !== expectedArchitecture) {
  fail(`package architecture ${architecture} does not match host ${expectedArchitecture}`);
}
for (const dependency of ['libwebkit2gtk-4.1-0', 'libgtk-3-0']) {
  if (!dependencies.includes(dependency)) fail(`missing runtime dependency: ${dependency}`);
}

const extractionDirectory = mkdtempSync(join(tmpdir(), 'paintnode-deb-verify-'));
try {
  run('dpkg-deb', ['--extract', debPath, extractionDirectory]);

  const binaryPath = join(extractionDirectory, 'usr', 'bin', 'PaintNode');
  if (!existsSync(binaryPath)) fail('package does not contain /usr/bin/PaintNode');
  if ((statSync(binaryPath).mode & 0o111) === 0) fail('/usr/bin/PaintNode is not executable');

  const desktopPath = join(
    extractionDirectory,
    'usr',
    'share',
    'applications',
    'PaintNode.desktop',
  );
  if (!existsSync(desktopPath)) fail('package does not contain PaintNode.desktop');
  const desktop = desktopEntries(desktopPath);
  const expectedDesktopEntries = {
    Type: 'Application',
    Name: 'PaintNode',
    Exec: 'PaintNode',
    Icon: 'PaintNode',
    Terminal: 'false',
  };
  for (const [key, value] of Object.entries(expectedDesktopEntries)) {
    if (desktop.get(key) !== value) fail(`desktop entry ${key} must be ${value}`);
  }
  if (!(desktop.get('Categories') ?? '').split(';').includes('Graphics')) {
    fail('desktop entry is missing the Graphics category');
  }

  const iconRoot = join(extractionDirectory, 'usr', 'share', 'icons', 'hicolor');
  const iconSizes = walkFiles(iconRoot)
    .filter((path) => basename(path) === 'PaintNode.png')
    .map(pngDimensions)
    .map(([width, height]) => `${width}x${height}`);
  for (const size of ['32x32', '128x128', '256x256', '512x512']) {
    if (!iconSizes.includes(size)) fail(`package is missing the ${size} application icon`);
  }

  const linkedLibraries = run('ldd', [binaryPath]);
  if (/\bnot found\b/.test(linkedLibraries)) {
    fail(`the packaged executable has unresolved shared libraries:\n${linkedLibraries}`);
  }

  console.log(`[linux-deb] verified ${debPath}`);
  console.log(`[linux-deb] ${packageName} ${packageVersion} (${architecture})`);
  console.log(`[linux-deb] desktop launcher, Graphics menu entry, executable, dependencies, and icons are present`);
} finally {
  rmSync(extractionDirectory, { recursive: true, force: true });
}
