import { describe, expect, it } from 'vitest';
import ciWorkflow from '../../.github/workflows/ci.yml?raw';
import providerRuntimeWorkflow from '../../.github/workflows/provider-runtimes.yml?raw';
import releaseWorkflow from '../../.github/workflows/release.yml?raw';
import packageJson from '../../package.json?raw';
import tauriConfig from '../../src-tauri/tauri.conf.json?raw';

describe('Linux distribution contract', () => {
  it('builds and validates a Debian package in pull-request CI', () => {
    expect(ciWorkflow).toContain('native-linux:');
    expect(ciWorkflow).toContain('runs-on: ubuntu-22.04');
    expect(ciWorkflow).toContain('npm run tauri:build:linux');
    expect(ciWorkflow).toContain('npm run verify:linux:deb');
    expect(ciWorkflow).toContain('paintnode-linux-x86_64-deb');
  });

  it('publishes Debian and AppImage assets from the compatibility baseline', () => {
    expect(releaseWorkflow).toContain('name: Linux x86_64');
    expect(releaseWorkflow).toContain('runtime-preflight:');
    expect(releaseWorkflow).toContain('needs: runtime-preflight');
    expect(releaseWorkflow).toContain('verify-managed-runtime-manifest.mjs');
    expect(releaseWorkflow).toContain('runner: ubuntu-22.04');
    expect(releaseWorkflow).toContain('args: --bundles deb,appimage');
    expect(releaseWorkflow).toContain('TAURI_SIGNING_PRIVATE_KEY:');
    expect(releaseWorkflow).toContain("PAINTNODE_SIGN_LINUX_DEB: '1'");
    expect(releaseWorkflow).toContain('tauriScript: node scripts/tauri-release.mjs');
  });

  it('publishes managed provider runtimes for Linux x64', () => {
    expect(providerRuntimeWorkflow).toContain('runs-on: ${{ matrix.target.runner }}');
    expect(providerRuntimeWorkflow).toMatch(/runner: ubuntu-22\.04\s+platform: linux\s+arch: x64/);
    expect(providerRuntimeWorkflow).toContain('runtime-${{ matrix.provider }}-${{ matrix.target.platform }}-${{ matrix.target.arch }}');
  });

  it('builds each macOS architecture on its native runner with optional signing', () => {
    expect(releaseWorkflow).toContain('runner: macos-14');
    expect(releaseWorkflow).toContain('args: --target aarch64-apple-darwin --bundles app,dmg');
    expect(releaseWorkflow).toContain('runner: macos-15-intel');
    expect(releaseWorkflow).toContain('args: --target x86_64-apple-darwin --bundles app,dmg');
    expect(releaseWorkflow).toContain('Detect Apple release signing');
    expect(releaseWorkflow).toContain('publishing an unsigned macOS build');
    expect(providerRuntimeWorkflow).toMatch(/runner: macos-15-intel\s+platform: darwin\s+arch: x64/);
  });

  it('serializes updater metadata and publishes only after validation', () => {
    expect(releaseWorkflow).toContain('max-parallel: 1');
    expect(releaseWorkflow).toContain('releaseDraft: true');
    expect(releaseWorkflow).toContain('verify-updater-json.mjs');
    expect(releaseWorkflow).toContain('linux-x86_64-appimage linux-x86_64-deb');
    expect(releaseWorkflow).toContain('gh release edit "paintnode-v${VERSION}" --draft=false --latest');
  });

  it('provides an unsigned local package command and a high-resolution launcher icon', () => {
    expect(packageJson).toContain('"tauri:build:linux"');
    expect(packageJson).toContain('createUpdaterArtifacts');
    expect(packageJson).toContain('"verify:linux:deb"');
    expect(tauriConfig).toContain('"icons/icon.png"');
  });

  it('uses this repository for releases and updater metadata', () => {
    expect(packageJson).toContain('https://github.com/Emilio-01-T/paintnode.git');
    expect(releaseWorkflow).toContain('github.com/Emilio-01-T/paintnode/releases');
    expect(tauriConfig).toContain('github.com/Emilio-01-T/paintnode/releases/latest/download/latest.json');
  });
});
