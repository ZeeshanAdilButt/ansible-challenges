// Challenge 3, part 2 test.
// Run: node --test challenges/challenge-3-one-template-three-hosts/part-2-facts/test.mjs
// It fails until you have filled in the four facts in facts.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-3-one-template-three-hosts/part-2-facts/run.mjs';

test('facts.yml has no TODO left in its messages', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c3.p2.playbook_file') ?? 'challenges/challenge-3-one-template-three-hosts/part-2-facts/facts.yml';
  const text = readFileSync(join(here, '..', '..', '..', rel), 'utf8').split('\n').filter((l) => l.includes('msg:')).join('\n');
  assert.ok(!/TODO/.test(text), 'facts.yml still has the word TODO in a msg line. Replace it with the fact, for example ansible_facts[\'distribution\'] (see the top of the file).');
  assert.equal((text.match(/ansible_facts\[/g) || []).length, 4, 'facts.yml should read four facts with ansible_facts[...] (distribution, default_ipv4, memtotal_mb, pkg_mgr).');
});

test('the four facts came back from three hosts', () => {
  assert.equal(getFact('c3.p2.hosts_reported'), 3, `Facts should come from 3 hosts. ${hint}`);
  assert.equal(getFact('c3.p2.distribution'), 'Debian', `The distribution should be Debian. ${hint}`);
  assert.equal(getFact('c3.p2.pkg_mgr'), 'apt', `The package manager should be apt. ${hint}`);
  assert.match(String(getFact('c3.p2.default_ipv4_web1')), /^\d+\.\d+\.\d+\.\d+$/, `The IPv4 address of web1 should look like 172.25.0.2. ${hint}`);
  assert.ok(getFact('c3.p2.memtotal_mb_web1') > 0, `The memory should be a number above 0. ${hint}`);
  assert.equal(getFact('c3.p2.memtotal_same_on_all_hosts'), true, `The three containers share one kernel, so they report the same memory. ${hint}`);
});

test('a missing fact is an error only when you ask for it', () => {
  assert.equal(getFact('c3.p2.missing_fact_error'), true, `On new servers default_ipv4 should be missing. ${hint}`);
});

test('the old injected style warns and has an end date', () => {
  assert.equal(getFact('c3.p2.deprecation_lines'), 2, `Two tasks use the old style, so there should be 2 deprecation warnings. ${hint}`);
  assert.match(String(getFact('c3.p2.deprecation_text')), /INJECT_FACTS_AS_VARS/, `The warning should name INJECT_FACTS_AS_VARS. ${hint}`);
  assert.match(String(getFact('c3.p2.deprecation_remedy')), /ansible_facts/, `The warning should tell you to use ansible_facts. ${hint}`);
  assert.match(String(getFact('c3.p2.deprecation_removal_version')), /^2\.\d+/, `The warning should name a version for the removal. ${hint}`);
  assert.equal(getFact('c3.p2.inject_off_error'), true, `With injection off the old name should be undefined. ${hint}`);
});

test('the minimal subset gathers fewer facts, and not the network ones', () => {
  assert.ok(getFact('c3.p2.fact_count_min') < getFact('c3.p2.fact_count_full'), `gather_subset: min should give fewer facts than the default. ${hint}`);
  assert.equal(getFact('c3.p2.min_has_default_ipv4'), false, `With gather_subset: min there should be no default_ipv4. ${hint}`);
});

test('the timings were measured', () => {
  for (const k of ['gather_full_s', 'gather_min_s', 'gather_ping_s', 'gather_full_pipelined_s', 'gather_min_pipelined_s', 'gather_ping_pipelined_s']) {
    assert.ok(getFact(`c3.p2.${k}`) > 0, `c3.p2.${k} should be a number of seconds above 0. ${hint}`);
  }
  // A ping does no gathering, so it is always the cheapest call. (Full against min is NOT asserted: see the README.)
  assert.ok(getFact('c3.p2.gather_ping_pipelined_s') < getFact('c3.p2.gather_full_pipelined_s'), `A ping should cost less than gathering all facts. ${hint}`);
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
