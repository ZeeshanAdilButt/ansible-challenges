// Challenge 5, part 1 test.
// Run: node --test challenges/challenge-5-your-first-role/part-1-move-to-a-role/test.mjs
// It fails until you have built the role (the six TODOs) and run run.mjs once. That is on purpose.
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
const PART = 'challenges/challenge-5-your-first-role/part-1-move-to-a-role';
const hint = `Run: node ${PART}/run.mjs`;

// The run records which site.yml it used, so a maintainer run with --reference is checked too.
const siteRel = () => getFact('c5.p1.site_file') ?? `${PART}/site.yml`;
const roleDir = () => join(root, dirname(siteRel()), 'roles', 'webserver');
const code = (path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

test('the role has tasks, a handler, a default, a template and metadata', () => {
  const dir = roleDir();
  const tasks = code(join(dir, 'tasks', 'main.yml'));
  assert.equal((tasks.match(/^- name:/gm) ?? []).length, 5, 'TODO 1: tasks/main.yml should hold the 5 tasks of before.yml, as a plain list.');
  assert.match(code(join(dir, 'handlers', 'main.yml')), /^- name: Reload nginx$/m, 'TODO 2: handlers/main.yml should hold the handler "Reload nginx".');
  assert.match(code(join(dir, 'defaults', 'main.yml')), /^site_port: 8080$/m, 'TODO 3: defaults/main.yml should say site_port: 8080.');
  assert.match(readFileSync(join(dir, 'templates', 'site.conf.j2'), 'utf8'), /listen \{\{ site_port \}\};/, 'TODO 4: copy the template into the role.');
});

test('meta/main.yml names the role and its namespace', () => {
  const meta = code(join(roleDir(), 'meta', 'main.yml'));
  assert.match(meta, /^galaxy_info:/m, 'meta/main.yml needs galaxy_info.');
  for (const key of ['role_name', 'namespace', 'author', 'description']) {
    const m = meta.match(new RegExp(`^\\s+${key}:\\s*(.+?)\\s*$`, 'm'));
    assert.ok(m && m[1] !== 'TODO', `TODO 5: fill in ${key} in meta/main.yml.`);
  }
  assert.match(meta, /^\s+role_name:\s*webserver\s*$/m, 'role_name must be webserver.');
  assert.match(meta, /^\s+namespace:\s*[a-z][a-z0-9_]*\s*$/m, 'namespace must be a lower case word (letters, digits, underscore).');
});

test('site.yml calls the role and is much shorter than before.yml', () => {
  const site = code(join(root, siteRel()));
  assert.match(site, /^\s+roles:\s*$/m, 'TODO 6: site.yml needs a roles: list.');
  assert.match(site, /^\s+-\s*(role:\s*)?webserver\s*$/m, 'TODO 6: the roles: list needs the entry webserver.');
  assert.equal(getFact('c5.p1.tasks_moved'), 5, `Five tasks should come from the role. ${hint}`);
  const before = getFact('c5.p1.playbook_lines_before');
  const after = getFact('c5.p1.playbook_lines_after');
  assert.ok(Number.isInteger(before) && Number.isInteger(after) && after < before / 3, `site.yml (${after} lines) should be less than a third of before.yml (${before} lines). ${hint}`);
});

test('the role does the same work as the playbook, and a second run changes nothing', () => {
  assert.equal(getFact('c5.p1.before_changed_run1'), 12, `before.yml should change 6 things on each of 2 hosts. ${hint}`);
  assert.equal(getFact('c5.p1.before_changed_run2'), 0, `A second run of before.yml changes nothing. ${hint}`);
  assert.equal(getFact('c5.p1.role_changed_run1'), 12, `The role should change the same 12 things. ${hint}`);
  assert.equal(getFact('c5.p1.role_handler_runs_run1'), 2, `The handler should run once on each web host. ${hint}`);
  assert.equal(getFact('c5.p1.role_changed_run2'), 0, `A second run of the role changes nothing. ${hint}`);
});

test('a default can be overridden from outside, and a typo in the role name is an error', () => {
  assert.equal(getFact('c5.p1.override_changed'), 4, `With -e site_port=9090 the template and the handler change on each host (4). ${hint}`);
  assert.equal(getFact('c5.p1.override_port_9090'), true, `The config should say listen 9090. ${hint}`);
  assert.equal(getFact('c5.p1.typo_exit_code'), 1, `A missing role is an error and the exit code is 1. ${hint}`);
  assert.match(String(getFact('c5.p1.typo_message')), /The role 'webservr' was not found/, `The message should name the missing role. ${hint}`);
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
