import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkTarget, publishBuild } from '../scripts/deploy.mjs';

test('stable deployments require main and unknown targets are rejected', () => {
  checkTarget('stable', 'main'); checkTarget('next', 'feature/adventure-worlds');
  assert.throws(() => checkTarget('stable', 'feature/adventure-worlds'), /requires main/);
  assert.throws(() => checkTarget('typo', 'main'), /Choose stable or next/);
});

test('publishing either version preserves the other and removes its own obsolete assets', async () => {
  const root = mkdtempSync(join(tmpdir(), 'keep-it-going-deploy-test-'));
  const remote = join(root, 'remote.git'), seed = join(root, 'seed'), dist = join(root, 'dist');
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (base: string, path: string, text: string) => {
    const file = join(base, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text);
  };
  const file = (path: string) => git(remote, 'show', `gh-pages:${path}`);
  const subtree = (path: string) => git(remote, 'rev-parse', `gh-pages:${path}`);
  const options = { repo: remote, user: { name: 'Deployment test', email: 'deploy-test@example.invalid' } };
  try {
    mkdirSync(seed); git(root, 'init', '--bare', remote); git(seed, 'init', '--initial-branch=gh-pages');
    git(seed, 'config', 'user.name', options.user.name); git(seed, 'config', 'user.email', options.user.email);
    put(seed, 'index.html', 'stable-v1'); put(seed, 'assets/old.js', 'old-stable');
    put(seed, 'CNAME', 'example.invalid'); put(seed, '.nojekyll', '');
    git(seed, 'add', '.'); git(seed, 'commit', '-m', 'Initial stable site'); git(seed, 'push', remote, 'gh-pages');

    // First preview publication must work when next/ does not exist yet.
    put(dist, 'index.html', 'preview-v1'); put(dist, 'assets/preview-old.js', 'preview-old');
    const stableAssets = subtree('assets');
    await publishBuild(dist, 'next', options);
    assert.equal(file('index.html'), 'stable-v1'); assert.equal(subtree('assets'), stableAssets);
    assert.equal(file('next/index.html'), 'preview-v1');

    // Republish preview: delete its obsolete bundles, without touching stable.
    rmSync(dist, { recursive: true }); put(dist, 'index.html', 'preview-v2'); put(dist, 'assets/preview-new.js', 'preview-new');
    await publishBuild(dist, 'next', options);
    assert.throws(() => file('next/assets/preview-old.js'));
    assert.equal(file('next/assets/preview-new.js'), 'preview-new'); assert.equal(file('index.html'), 'stable-v1');

    // Stable publication must preserve every preview byte, plus the domain file.
    const preview = subtree('next');
    rmSync(dist, { recursive: true }); put(dist, 'index.html', 'stable-v2'); put(dist, 'assets/stable-new.js', 'stable-new');
    await publishBuild(dist, 'stable', options);
    assert.equal(subtree('next'), preview); assert.equal(file('index.html'), 'stable-v2');
    assert.equal(file('assets/stable-new.js'), 'stable-new'); assert.throws(() => file('assets/old.js'));
    assert.equal(file('CNAME'), 'example.invalid'); assert.equal(file('.nojekyll'), '');

    put(dist, 'next/index.html', 'accidental-preview-overwrite');
    await assert.rejects(publishBuild(dist, 'stable', options), /must not contain next/);
    assert.equal(subtree('next'), preview);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
