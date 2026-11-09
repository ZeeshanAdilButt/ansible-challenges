// Challenge 2, part 1: your first playbook, run twice.
// Run: node challenges/challenge-2-run-it-twice/part-1-first-playbook/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run the fixed playbook in reference/ (for maintainers).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 2, part 1: your first playbook');
const CHALLENGE = 2;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-2-run-it-twice/part-1-first-playbook';
const PLAYBOOK = `${PART}/${reference ? 'reference/' : ''}site.yml`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shown = (text) => text.replaceAll('/reference/site.yml', '/site.yml');

const MIN_TASKS = 5;

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// The PLAY RECAP lines: one per host.
function recap(text) {
  const rows = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\S+)\s*: ok=(\d+)\s+changed=(\d+)\s+unreachable=(\d+)\s+failed=(\d+)\s+skipped=(\d+)/);
    if (m) rows[m[1]] = { ok: +m[2], changed: +m[3], unreachable: +m[4], failed: +m[5], skipped: +m[6] };
  }
  return rows;
}
const total = (rows, key) => Object.values(rows).reduce((a, r) => a + r[key], 0);

// Task names that --list-tasks prints (they sit six spaces in).
const taskNames = (text) => text.split('\n').filter((l) => /^ {6}\S/.test(l)).map((l) => l.trim().replace(/\s+TAGS:.*$/, ''));

// Run one command, record it, return the result.
function step(argv, note) {
  const r = ansible(argv);
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(shown(`node toolkit/ansible.mjs ${argv.map(quote).join(" ")}`), shown(compactOutput(r.stdout)), typeof note === 'function' ? note(r) : note);
  return r;
}

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. Three new targets: no nginx, no redis, nothing changed by hand.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // Your playbook must be valid YAML and have all its tasks before the real run.
  const syntax = ansible(['ansible-playbook', PLAYBOOK, '--syntax-check']);
  if (syntax.code !== 0) throw new Error(`${PLAYBOOK} is not a valid playbook yet. Ansible says:\n${syntax.stdout.trim()}`);
  const list = ansible(['ansible-playbook', PLAYBOOK, '--list-tasks']);
  const names = taskNames(list.stdout);
  if (names.length < MIN_TASKS) {
    throw new Error(`${PLAYBOOK} has ${names.length} task(s) and needs ${MIN_TASKS}: install nginx, write the home page, start nginx, install redis-server, start redis-server. Follow the TODO lines in site.yml and run this again.`);
  }

  // Step 1: check the playbook and list what it will do.
  step(['ansible-playbook', PLAYBOOK, '--syntax-check'], 'Syntax check: Ansible read the file and found nothing wrong. It did not connect to any host.');
  step(['ansible-playbook', PLAYBOOK, '--list-tasks'], `The playbook has ${names.length} tasks in 2 plays. Gathering Facts is added by Ansible and is not counted.`);

  // Step 2: the first real run.
  const first = step(['ansible-playbook', PLAYBOOK], (r) => `First run: ${total(recap(r.stdout), 'changed')} changes in total. Every task that had work to do says changed.`);
  const r1 = recap(first.stdout);
  if (first.code !== 0) throw new Error('The first run failed. Read the output above. Common causes: a task is missing become, or a module option is misspelled.');

  // Step 3: the same command again.
  const second = step(['ansible-playbook', PLAYBOOK], (r) => `Second run: ${total(recap(r.stdout), 'changed')} changes. The servers already match the playbook, so every task says ok.`);
  const r2 = recap(second.stdout);
  if (second.code !== 0) throw new Error('The second run failed. Read the output above.');

  // Step 4: look at the result on the servers. uri runs on the target and asks nginx for the page.
  const web = step(['ansible', 'web', '-m', 'uri', '-a', 'url=http://localhost/ return_content=yes'], (r) => `${(r.stdout.match(/"status": 200/g) || []).length} web hosts answer with status 200 and their own page.`);
  const redis = step(['ansible', 'db', '-b', '-m', 'command', '-a', 'redis-cli ping'], (r) => `redis answers ${/PONG/.test(r.stdout) ? 'PONG' : 'nothing'}. (The command module says CHANGED here for the reason you saw in challenge 1: it cannot know that ping only reads.)`);

  const facts = {
    'c2.p1.tasks': names.length,
    'c2.p1.changed_run1': total(r1, 'changed'),
    'c2.p1.changed_run2': total(r2, 'changed'),
    'c2.p1.failed_run1': total(r1, 'failed'),
    'c2.p1.hosts_in_recap': Object.keys(r1).length,
    'c2.p1.web_status_200_count': (web.stdout.match(/"status": 200/g) || []).length,
    'c2.p1.redis_pong': /PONG/.test(redis.stdout),
    'c2.p1.reset_s': round(resetS, 1),
    'c2.p1.playbook_file': PLAYBOOK,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/site.yml; the paths below show site.yml' : ''}`);
    const bars = [];
    for (const h of ['web1', 'web2', 'db1']) bars.push({ label: `${h}, first run`, value: r1[h]?.changed ?? 0 });
    for (const h of ['web1', 'web2', 'db1']) bars.push({ label: `${h}, second run`, value: r2[h]?.changed ?? 0 });
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({ title: 'Changes the same playbook made on each host, first run and second run', unit: 'changes', bars }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
