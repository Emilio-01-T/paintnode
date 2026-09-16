#!/usr/bin/env node

import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function argumentValue(args, name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function requestsDebBundle(args) {
  const bundles = argumentValue(args, '--bundles');
  if (!bundles) return true;
  return bundles.split(',').map((bundle) => bundle.trim()).includes('deb');
}

export function debBundleDirectory(projectRoot, args) {
  const target = argumentValue(args, '--target');
  const profile = args.includes('--debug') ? 'debug' : 'release';
  const targetSegments = target ? [target] : [];
  return resolve(
    projectRoot,
    'src-tauri',
    'target',
    ...targetSegments,
    profile,
    'bundle',
    'deb',
  );
}

function run(command, args, description) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status ?? 1}`);
  }
}

function signDebPackages(tauriExecutable, buildArgs) {
  if (
    !process.env.TAURI_SIGNING_PRIVATE_KEY?.trim() &&
    !process.env.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim()
  ) {
    throw new Error('TAURI_SIGNING_PRIVATE_KEY is required to sign Linux .deb updates');
  }

  const bundleDirectory = debBundleDirectory(PROJECT_ROOT, buildArgs);
  if (!existsSync(bundleDirectory)) {
    throw new Error(`Debian bundle directory was not created: ${bundleDirectory}`);
  }

  const debPackages = readdirSync(bundleDirectory)
    .filter((name) => name.endsWith('.deb'))
    .sort();
  if (debPackages.length === 0) {
    throw new Error(`No Debian package was created in ${bundleDirectory}`);
  }

  for (const packageName of debPackages) {
    const packagePath = resolve(bundleDirectory, packageName);
    run(
      tauriExecutable,
      ['signer', 'sign', packagePath],
      `signing ${packageName}`,
    );

    const signaturePath = `${packagePath}.sig`;
    if (!existsSync(signaturePath)) {
      throw new Error(`Tauri did not create ${signaturePath}`);
    }
    console.log(`[release] signed Debian updater artifact: ${signaturePath}`);
  }
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(SCRIPT_PATH), '..');

function main() {
  const args = process.argv.slice(2);
  const executableName = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
  const tauriExecutable = resolve(PROJECT_ROOT, 'node_modules', '.bin', executableName);

  run(tauriExecutable, args, 'Tauri command');

  if (
    process.platform === 'linux' &&
    args[0] === 'build' &&
    process.env.PAINTNODE_SIGN_LINUX_DEB === '1' &&
    requestsDebBundle(args)
  ) {
    signDebPackages(tauriExecutable, args);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(`[release] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
