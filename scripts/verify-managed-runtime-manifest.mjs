#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { MANAGED_RUNTIME_PROTOCOL_VERSION } from './managed-runtime-package-contract.mjs';

const DEFAULT_MANIFEST_URL = 'https://github.com/Emilio-01-T/paintnode/releases/download/provider-runtimes-latest/runtime-manifest.json';
const REQUIRED_PROVIDERS = ['codex', 'claude'];

function versionParts(value) {
  const parts = String(value).split('-', 1)[0].split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`invalid semantic version: ${value}`);
  }
  return parts;
}

function versionAtLeast(current, minimum) {
  const currentParts = versionParts(current);
  const minimumParts = versionParts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (currentParts[index] !== minimumParts[index]) {
      return currentParts[index] > minimumParts[index];
    }
  }
  return true;
}

export function verifyManagedRuntimeTarget(
  manifest,
  { os, arch, currentVersion, providers = REQUIRED_PROVIDERS },
) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.packages)) {
    throw new Error('managed runtime manifest must use schema version 1');
  }

  return providers.map((provider) => {
    const packageEntry = manifest.packages.find((entry) => entry.provider === provider);
    if (!packageEntry) throw new Error(`managed ${provider} package is not published`);
    if (packageEntry.protocolVersion !== MANAGED_RUNTIME_PROTOCOL_VERSION) {
      throw new Error(
        `managed ${provider} protocol ${packageEntry.protocolVersion} does not match ${MANAGED_RUNTIME_PROTOCOL_VERSION}`,
      );
    }
    if (!versionAtLeast(currentVersion, packageEntry.minimumPaintNodeVersion)) {
      throw new Error(
        `managed ${provider} requires PaintNode ${packageEntry.minimumPaintNodeVersion}, current release is ${currentVersion}`,
      );
    }
    const artifact = packageEntry.artifacts?.find((entry) => entry.os === os && entry.arch === arch);
    if (!artifact) throw new Error(`managed ${provider} artifact is not published for ${os}-${arch}`);
    if (!/^https:\/\//.test(artifact.url)) throw new Error(`managed ${provider} artifact URL must use HTTPS`);
    if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) throw new Error(`managed ${provider} artifact SHA-256 is invalid`);
    if (!Number.isSafeInteger(artifact.size) || artifact.size <= 0) {
      throw new Error(`managed ${provider} artifact size is invalid`);
    }
    return {
      provider,
      packageVersion: packageEntry.packageVersion,
      os,
      arch,
      size: artifact.size,
    };
  });
}

async function readManifest(source) {
  if (/^https:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`runtime manifest returned HTTP ${response.status}`);
    return response.json();
  }
  return JSON.parse(await readFile(resolve(source), 'utf8'));
}

async function main() {
  const [, , source = DEFAULT_MANIFEST_URL, os, arch] = process.argv;
  if (!os || !arch) {
    throw new Error('Usage: verify-managed-runtime-manifest.mjs [URL_OR_FILE] OS ARCH');
  }
  const packageJson = JSON.parse(await readFile(resolve(import.meta.dirname, '..', 'package.json'), 'utf8'));
  const manifest = await readManifest(source);
  const verified = verifyManagedRuntimeTarget(manifest, {
    os,
    arch,
    currentVersion: packageJson.version,
  });
  for (const entry of verified) {
    console.log(
      `[managed-runtime] ${entry.provider} ${entry.packageVersion} ${entry.os}-${entry.arch} (${entry.size} bytes)`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
