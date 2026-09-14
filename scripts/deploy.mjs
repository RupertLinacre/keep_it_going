import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ghpages from 'gh-pages';

export function checkTarget(target, branch) {
  if (!['stable', 'next'].includes(target)) throw new Error('Choose stable or next.');
  if (target === 'stable' && branch !== 'main') {
    throw new Error('Stable deployment requires main. Use npm run deploy:next to publish this branch.');
  }
}

export async function publishBuild(directory, target, options = {}) {
  if (!['stable', 'next'].includes(target)) throw new Error('Choose stable or next.');
  if (!existsSync(resolve(directory, 'index.html'))) throw new Error('The build is missing index.html.');
  if (target === 'stable' && existsSync(resolve(directory, 'next'))) {
    throw new Error('The stable build must not contain next/: that folder belongs to the preview.');
  }
  await new Promise((accept, reject) => ghpages.publish(directory, {
    ...options,
    branch: 'gh-pages',
    remote: 'origin',
    nojekyll: true,
    // gh-pages scopes removal to dest. Clear stale preview assets inside next/;
    // stable updates remove old root assets while retaining the entire preview.
    dest: target === 'next' ? 'next' : '.',
    remove: target === 'next' ? '.' : ['**/*', '!next/**', '!CNAME'],
  }, error => error ? reject(error) : accept()));
}

async function deploy(target) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const branch = git('branch', '--show-current');
  checkTarget(target, branch);
  if (!branch) throw new Error('Check out a source branch before deploying.');
  if (git('status', '--porcelain', '--untracked-files=no')) {
    throw new Error('Commit tracked changes before deploying so the release identifies the exact source revision.');
  }
  const commit = git('rev-parse', 'HEAD');
  console.log(`Checking and building ${target} from ${branch} (${commit.slice(0, 7)})…`);
  for (const args of [['test'], ['run', 'build']]) {
    execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
  }
  const dist = resolve(root, 'dist');
  writeFileSync(resolve(dist, 'release.json'), JSON.stringify({
    target, branch, commit, builtAt: new Date().toISOString(),
  }, null, 2) + '\n');
  await publishBuild(dist, target, { message: `Deploy ${target} from ${branch} (${commit.slice(0, 7)})` });
  console.log(`Published: https://rupertlinacre.com/keep_it_going/${target === 'next' ? 'next/' : ''}`);
  console.log('GitHub Pages may take a minute to serve the new build.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deploy(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
