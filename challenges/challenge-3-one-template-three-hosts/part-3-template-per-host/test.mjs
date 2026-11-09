// Challenge 3, part 3 test.
// Run: node --test challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/test.mjs
// It fails until you have written app.conf.j2 and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/run.mjs';

test('app.conf.j2 has a condition and a loop', () => {
  // The run records which template it rendered, so a maintainer run with --reference is checked too.
  const file = getFact('c3.p3.template_file') ?? 'app.conf.j2';
  const text = readFileSync(join(here, file), 'utf8').replace(/\{#[\s\S]*?#\}/g, '');
  assert.match(text, /\{%-?\s*if\b/, 'app.conf.j2 needs an {% if %} that tells web hosts from the database host (see TODO 3).');
  assert.match(text, /\{%-?\s*for\b/, 'app.conf.j2 needs a {% for %} loop over groups[\'web\'] (see TODO 3).');
});

test('one template made three different files', () => {
  assert.equal(getFact('c3.p3.differs'), true, `The three files should all be different (host name, port, role). ${hint}`);
  assert.equal(getFact('c3.p3.port_web1'), '8080', `web1 should listen on 8080 (group_vars/web.yml). ${hint}`);
  assert.equal(getFact('c3.p3.port_web2'), '8081', `web2 should listen on 8081 (host_vars/web2.yml beats group_vars/web.yml). ${hint}`);
  assert.equal(getFact('c3.p3.port_db1'), '5432', `db1 should listen on 5432 (group_vars/db.yml). ${hint}`);
});

test('the web files list both web hosts and the database file lists none', () => {
  assert.equal(getFact('c3.p3.web_files_list_both_peers'), true, `Both web files need the lines "peer = web1" and "peer = web2". ${hint}`);
  assert.equal(getFact('c3.p3.db_file_has_no_peers'), true, `The database file must have no peer lines. ${hint}`);
  const web1 = getFact('c3.p3.lines_web1');
  assert.ok(web1 > getFact('c3.p3.lines_db1'), `A web file (${web1} lines) should be longer than the database file (${getFact('c3.p3.lines_db1')} lines): it has the peer lines. ${hint}`);
  assert.equal(web1, getFact('c3.p3.lines_web2'), `web1 and web2 should have the same number of lines. ${hint}`);
});

test('the second run changes nothing', () => {
  assert.equal(getFact('c3.p3.first_run_changed'), 6, `c3.p3.first_run_changed should be 6 (folder and file on 3 hosts). ${hint}`);
  assert.equal(getFact('c3.p3.second_run_changed'), 0, `c3.p3.second_run_changed should be 0. ${hint}`);
  assert.equal(getFact('c3.p3.final_changed'), 0, `c3.p3.final_changed should be 0. ${hint}`);
});

test('--diff showed the one line that changed on one host', () => {
  assert.equal(getFact('c3.p3.diff_changed'), 1, `Changing the port on web1 only should change 1 host. ${hint}`);
  assert.equal(getFact('c3.p3.diff_removed'), 'listen_port = 8080', `The diff should remove the old port line. ${hint}`);
  assert.equal(getFact('c3.p3.diff_added'), 'listen_port = 9090', `The diff should add the new port line. ${hint}`);
  assert.equal(getFact('c3.p3.restore_changed'), 1, `Running again without -e should change web1 back (1 change). ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(3), { containers: 0, networks: 0, volumes: 0 });
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
