// Tests for tools/make_starter.mjs. Run: node --test tools/test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findIdenticalTwins, EXEMPT } from './starter_twins.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'make_starter.mjs');

function put(root, rel, text = 'x') {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function starter(source, target) {
  return spawnSync(process.execPath, [script, target], { encoding: 'utf8', env: { ...process.env, ANP_SOURCE_ROOT: source } });
}

test('make_starter leaves out reference folders, NOTES.md, facts.json, keys, collections, .vault-pass, .git and node_modules', () => {
  const base = mkdtempSync(join(tmpdir(), 'anp-starter-'));
  const source = join(base, 'src');
  const target = join(base, 'out');
  try {
    put(source, 'README.md', 'hello');
    put(source, 'facts.json', '{"c1.p1.a_mb": 1}');
    put(source, '.git/config');
    put(source, 'keys/id_ed25519');
    put(source, 'collections/ansible_collections/x/y/galaxy.yml');
    put(source, '.vault-pass');
    put(source, 'challenges/challenge-1-a/NOTES.md');
    put(source, 'node_modules/x/index.js');
    put(source, 'toolkit/docker.js');
    put(source, 'challenges/challenge-1-a/part-1-b/README.md');
    put(source, 'challenges/challenge-1-a/part-1-b/test.mjs');
    put(source, 'challenges/challenge-1-a/part-1-b/reference/solution.yml', 'ok: true');
    put(source, 'challenges/challenge-2-a/part-1-b/reference/deep/solution.txt');
    put(source, 'challenges/challenge-2-a/part-1-b/results.md');

    const r = starter(source, target);
    assert.equal(r.status, 0, r.stderr);

    assert.equal(readFileSync(join(target, 'README.md'), 'utf8'), 'hello');
    assert.ok(existsSync(join(target, 'toolkit/docker.js')));
    assert.ok(existsSync(join(target, 'challenges/challenge-1-a/part-1-b/test.mjs')));
    assert.ok(existsSync(join(target, 'challenges/challenge-2-a/part-1-b/results.md')));

    assert.ok(!existsSync(join(target, 'facts.json')), 'facts.json must not be copied');
    assert.ok(!existsSync(join(target, '.git')), '.git must not be copied');
    assert.ok(!existsSync(join(target, 'keys')), 'keys must not be copied');
    assert.ok(!existsSync(join(target, 'collections')), 'collections must not be copied');
    assert.ok(!existsSync(join(target, '.vault-pass')), '.vault-pass must not be copied');
    assert.ok(!existsSync(join(target, 'challenges/challenge-1-a/NOTES.md')), 'NOTES.md must not be copied');
    assert.ok(!existsSync(join(target, 'node_modules')), 'node_modules must not be copied');
    assert.ok(!existsSync(join(target, 'challenges/challenge-1-a/part-1-b/reference')), 'reference must not be copied');
    assert.ok(!existsSync(join(target, 'challenges/challenge-2-a/part-1-b/reference')), 'nested reference must not be copied');
    assert.ok(existsSync(join(source, 'challenges/challenge-1-a/part-1-b/reference/solution.yml')), 'the source is untouched');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('make_starter refuses a target that is not empty, or inside the source', () => {
  const base = mkdtempSync(join(tmpdir(), 'anp-starter-'));
  const source = join(base, 'src');
  try {
    put(source, 'README.md');
    put(base, 'full/file.txt');
    assert.equal(starter(source, join(base, 'full')).status, 2);
    assert.equal(starter(source, join(source, 'inside')).status, 2);
    assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 2);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// ---- starters must not hold the solution ----
// A learner starter that is byte-identical to its reference file already has the answer, so its test cannot fail first.

test('findIdenticalTwins flags a starter equal to its reference, by path and by file name, and ignores a different one', () => {
  const base = mkdtempSync(join(tmpdir(), 'anp-twins-'));
  try {
    const part = 'challenges/challenge-1-a/part-1-b';
    put(base, `${part}/solution.yml`, 'same');
    put(base, `${part}/reference/solution.yml`, 'same');
    put(base, `${part}/roles/x/molecule/verify.yml`, 'same too');
    put(base, `${part}/reference/verify.yml`, 'same too');
    put(base, `${part}/todo.yml`, '# TODO write it');
    put(base, `${part}/reference/todo.yml`, 'written');
    put(base, `${part}/reference/only-here.yml`, 'no starter file');
    const found = findIdenticalTwins(base).map((t) => t.starter).sort();
    assert.deepEqual(found, [`${part}/roles/x/molecule/verify.yml`, `${part}/solution.yml`]);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('no learner starter file is byte-identical to its reference twin (each exemption has a reason)', () => {
  const repo = join(dirname(script), '..');
  const flagged = findIdenticalTwins(repo).filter((t) => !EXEMPT[t.starter]);
  assert.deepEqual(flagged, [], `These starters already hold the solution. Replace each with a starter that has TODO lines, or add it to EXEMPT in tools/starter_twins.mjs with a reason:\n${flagged.map((t) => `  ${t.starter}  ==  ${t.reference}`).join('\n')}`);
  for (const [file, why] of Object.entries(EXEMPT)) {
    assert.ok(why.length > 20, `EXEMPT entry ${file} needs a real reason`);
    assert.ok(existsSync(join(repo, file)), `EXEMPT entry ${file} does not exist any more. Remove it from EXEMPT.`);
  }
});
