// Challenge 5, part 3 test.
// Run: node --test challenges/challenge-5-your-first-role/part-3-same-result/test.mjs
// It fails until part 1 is done, you have listed the files in files-to-compare.txt, and run.mjs has run once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const PART = 'challenges/challenge-5-your-first-role/part-3-same-result';
const hint = `Run: node ${PART}/run.mjs`;

test('files-to-compare.txt lists the two files that the playbook writes', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c5.p3.files_list') ?? `${PART}/files-to-compare.txt`;
  const lines = readFileSync(join(root, rel), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .sort();
  assert.deepEqual(lines, ['/etc/nginx/conf.d/site.conf', '/var/www/site/index.html'], 'TODO: list the files that before.yml writes (look for dest:), one path per line.');
});

test('the playbook and the role leave the same files on the web hosts', () => {
  assert.equal(getFact('c5.p3.files_compared'), 2, `Two files should be compared. ${hint}`);
  assert.equal(getFact('c5.p3.hosts_compared'), 2, `Two web hosts should be compared. ${hint}`);
  assert.equal(getFact('c5.p3.hashes_equal'), true, `The sha256 of every file should be equal. ${hint}`);
});

test('the recap counts are the same: 12 changes first, 0 the second time', () => {
  assert.equal(getFact('c5.p3.changed_playbook'), 12, `The playbook should change 12 things. ${hint}`);
  assert.equal(getFact('c5.p3.changed_role'), 12, `The role should change 12 things. ${hint}`);
  assert.equal(getFact('c5.p3.changed_playbook_second'), 0, `${hint}`);
  assert.equal(getFact('c5.p3.changed_role_second'), 0, `${hint}`);
});

test('the check can fail: a different port gives a different config file and the same index page', () => {
  assert.equal(getFact('c5.p3.hashes_differ_with_other_port'), true, `A changed port should change a fingerprint. ${hint}`);
  assert.equal(getFact('c5.p3.differing_files_with_other_port'), '/etc/nginx/conf.d/site.conf', `Only the config file should differ. ${hint}`);
});

test('the fleet is running', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(5), { containers: 0, networks: 0, volumes: 0 });
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
