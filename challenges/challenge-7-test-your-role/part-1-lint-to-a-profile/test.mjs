// Challenge 7, part 1 test.
// Run: node --test challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/test.mjs
// It fails until your fix-me folder passes ansible-lint at the profile production and you have run run.mjs. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-7-test-your-role/part-1-lint-to-a-profile';
const hint = `Run: node ${PART}/run.mjs`;
// A maintainer run with --reference records which folder it used.
const fixRel = (getFact('c7.p1.fix_file') ?? `${PART}/fix-me/site.yml`).replace(/\/site\.yml$/, '');

test('your fix-me folder passes ansible-lint at the profile production (live check)', () => {
  const r = ansible(['ansible-lint', '--profile', 'production', 'site.yml'], { cwd: fixRel });
  assert.equal(r.code, 0, `ansible-lint --profile production still finds problems in ${fixRel}. Fix them (the first lines say which rule and which line). Is the fleet running? node toolkit/fleet.mjs up\n${r.stdout.split('\n').slice(0, 12).join('\n')}`);
});

test('run.mjs saved the lint facts', () => {
  assert.equal(getFact('c7.p1.findings_default'), 33, `c7.p1.findings_default should be 33 (the sloppy code). ${hint}`);
  assert.equal(getFact('c7.p1.findings_fixed'), 0, `Your copy still has findings at production. ${hint}`);
  assert.equal(getFact('c7.p1.highest_profile'), 'production', `The highest profile your copy passes should be production. ${hint}`);
  assert.equal(getFact('c7.p1.highest_profile_before'), 'min', 'The sloppy code passes only min.');
});

test('each rule has its profile, measured, and the summary label is not used', () => {
  const pairs = String(getFact('c7.p1.rule_profiles') ?? '');
  assert.ok(pairs, `c7.p1.rule_profiles is missing. ${hint}`);
  const map = Object.fromEntries(pairs.split(',').map((p) => p.split(/:(?=[^:]*$)/)));
  assert.equal(map['fqcn[action-core]'], 'production');
  assert.equal(map['no-changed-when'], 'shared');
  assert.equal(map['ignore-errors'], 'shared');
  assert.equal(map['name[casing]'], 'moderate');
  assert.equal(map['no-free-form'], 'basic');
  assert.equal(Object.keys(map).length, getFact('c7.p1.rules_hit_before'), 'One entry for every rule the default run hit.');
});

test('the counts per profile only stay or go up', () => {
  const names = ['min', 'basic', 'moderate', 'safety', 'shared', 'production'];
  const counts = names.map((n) => getFact(`c7.p1.findings_${n}`));
  assert.ok(counts.every((c) => Number.isInteger(c)), `The per profile counts are missing. ${hint}`);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], `${names[i]} has fewer findings than ${names[i - 1]}`);
  assert.equal(counts[0], 0, 'min only checks that Ansible can load the files.');
  assert.equal(counts[5], getFact('c7.p1.findings_default'), 'production includes every rule that default runs here.');
});

test('the sloppy folder was not edited', () => {
  const text = readFileSync(join(here, 'sloppy', 'site.yml'), 'utf8');
  assert.match(text, /- shell: echo "deploying"/, 'Do not edit sloppy/. Fix the copy in fix-me/.');
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(7), { containers: 0, networks: 0, volumes: 0 });
});

test('the README links the safety rules', () => {
  assert.match(readFileSync(join(here, 'README.md'), 'utf8'), /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
});

test('results.md and chart.svg exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  const svg = readFileSync(join(here, 'chart.svg'), 'utf8');
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">/);
  assert.match(svg, /<desc id="d">/);
});
