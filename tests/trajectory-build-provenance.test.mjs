import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sourceGitState } from '../scripts/build-trajectory-92be.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'worldlaw-build-provenance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function repository(root) {
  mkdirSync(root, { recursive: true });
  git(root, 'init');
  writeFileSync(join(root, 'app.mjs'), 'export const version = 1;\n');
  git(root, 'add', 'app.mjs');
  git(root, '-c', 'user.name=WORLDLAW test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
  return git(root, 'rev-parse', 'HEAD');
}

test('nested extracted source never inherits enclosing repository metadata', t => {
  const parent = fixture(t);
  const enclosingHead = repository(parent);
  const extracted = join(parent, 'received-worldlaw');
  mkdirSync(extracted);
  writeFileSync(join(extracted, 'app.mjs'), 'export const version = 2;\n');
  // This is the original failure condition: cwd alone still resolves parent HEAD.
  assert.equal(git(extracted, 'rev-parse', 'HEAD'), enclosingHead);
  assert.deepEqual(sourceGitState(extracted, ['app.mjs']), { sourceHead: null, sourceStatus: null });
});

test('real repository retains commit and scoped dirty source state', t => {
  const root = fixture(t);
  const head = repository(root);
  assert.deepEqual(sourceGitState(root, ['app.mjs']), { sourceHead: head, sourceStatus: '' });
  writeFileSync(join(root, 'app.mjs'), 'export const version = 2;\n');
  writeFileSync(join(root, 'unrelated.txt'), 'not bundled\n');
  const state = sourceGitState(root, ['app.mjs']);
  assert.equal(state.sourceHead, head);
  assert.match(state.sourceStatus, /M app\.mjs/);
  assert.doesNotMatch(state.sourceStatus, /unrelated/);
});

test('linked Git worktree retains its own commit, including symlinked root', t => {
  const outer = fixture(t);
  const main = join(outer, 'main');
  repository(main);
  const worktree = join(outer, 'worktree');
  git(main, 'worktree', 'add', '-b', 'receiving', worktree);
  writeFileSync(join(worktree, 'app.mjs'), 'export const version = 2;\n');
  git(worktree, 'add', 'app.mjs');
  git(worktree, '-c', 'user.name=WORLDLAW test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'worktree revision');
  const head = git(worktree, 'rev-parse', 'HEAD');
  assert.notEqual(head, git(main, 'rev-parse', 'HEAD'));
  assert.deepEqual(sourceGitState(worktree, ['app.mjs']), { sourceHead: head, sourceStatus: '' });
  if (process.platform !== 'win32') {
    const alias = join(outer, 'worktree-alias');
    symlinkSync(worktree, alias, 'dir');
    assert.deepEqual(sourceGitState(alias, ['app.mjs']), { sourceHead: head, sourceStatus: '' });
  }
});

test('source without Git metadata returns unavailable Git fields', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'app.mjs'), 'export const version = 1;\n');
  assert.deepEqual(sourceGitState(root, ['app.mjs']), { sourceHead: null, sourceStatus: null });
});
