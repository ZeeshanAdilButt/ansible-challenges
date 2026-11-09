// Challenge 1, part 2 test.
// Run: node --test challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/test.mjs
// It fails until you have written your inventory and run run.mjs once. That is on purpose.
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
const hint = 'Run: node challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/run.mjs';

test('my-inventory.ini names the groups web and db with the right hosts', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c1.p2.inventory_file') ?? `challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini`;
  const r = ansible(['ansible-inventory', '-i', rel, '--list'], { merge: false });
  assert.equal(r.code, 0, `ansible-inventory could not read ${rel}. Is the fleet running? node toolkit/fleet.mjs up\n${r.stderr}`);
  const inv = JSON.parse(r.stdout);
  const web = [...(inv.web?.hosts ?? [])].sort();
  const db = [...(inv.db?.hosts ?? [])].sort();
  assert.deepEqual(web, ['web1', 'web2'], `Group web should hold web1 and web2, it holds [${web}]. Edit my-inventory.ini.`);
  assert.deepEqual(db, ['db1'], `Group db should hold db1, it holds [${db}]. Edit my-inventory.ini.`);
  assert.equal(inv._meta.hostvars.web1.ansible_user, 'ansible', 'The [all:vars] section must keep ansible_user=ansible.');
});

test('run.mjs saved the pattern counts', () => {
  assert.equal(getFact('c1.p2.hosts_all'), 3, `c1.p2.hosts_all should be 3. ${hint}`);
  assert.equal(getFact('c1.p2.hosts_web'), 2, `c1.p2.hosts_web should be 2. ${hint}`);
  assert.equal(getFact('c1.p2.hosts_not_db'), 2, `c1.p2.hosts_not_db should be 2. ${hint}`);
  assert.equal(getFact('c1.p2.hosts_web_and_db'), 0, `c1.p2.hosts_web_and_db should be 0. ${hint}`);
});

test('the ad hoc apt command changed two hosts once and then none', () => {
  assert.equal(getFact('c1.p2.adhoc_changed_first'), 2, `c1.p2.adhoc_changed_first should be 2 (web1 and web2). ${hint}`);
  assert.equal(getFact('c1.p2.adhoc_changed_second'), 0, `c1.p2.adhoc_changed_second should be 0. ${hint}`);
  assert.equal(getFact('c1.p2.command_changed'), 3, `c1.p2.command_changed should be 3: the command module always says changed. ${hint}`);
});

test('the targets run Python 3.11 and the warning goes away with auto_silent', () => {
  assert.match(String(getFact('c1.p2.target_python')), /^3\.11\.\d+$/, `c1.p2.target_python should look like 3.11.2. ${hint}`);
  assert.equal(getFact('c1.p2.warning_lines_default'), 3, `With the default setting there is one warning per host (3). ${hint}`);
  assert.equal(getFact('c1.p2.warning_lines_set'), 0, `With auto_silent there are no warnings. ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(1), { containers: 0, networks: 0, volumes: 0 });
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
