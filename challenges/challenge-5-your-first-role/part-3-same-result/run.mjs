// Challenge 5, part 3: the playbook and the role give the same result.
// Run: node challenges/challenge-5-your-first-role/part-3-same-result/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the finished role and file list in reference/ folders (for maintainers).
// This part needs part 1: it runs before.yml and the role you built there.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { parseRecap, total } from '../recap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 5, part 3: the playbook and the role give the same result');
const CHALLENGE = 5;

// Folders as the control container sees them (the repository is mounted at /work).
const PART = 'challenges/challenge-5-your-first-role/part-3-same-result';
const PART1 = 'challenges/challenge-5-your-first-role/part-1-move-to-a-role';
const BEFORE = `${PART1}/before.yml`;
const SITE = `${PART1}/${reference ? 'reference/' : ''}site.yml`;
const LIST = `${PART}/${reference ? 'reference/' : ''}files-to-compare.txt`;
// A --reference run uses the fixed files, but results.md shows the paths a learner types.
const shownPath = (text) => text.replaceAll('/reference/', '/');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Run one ansible command, record it, and return the result. The command text is what you could type yourself.
function step(argv, note) {
  const r = ansible(argv);
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(shownPath(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}
const changedSum = (r) => total(parseRecap(r.stdout), 'changed');

// The sha256 of each file on each host, from "sha256sum" output: { web1: { '/etc/...': 'abc...' } }.
function hashes(text) {
  const out = {};
  let host = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^(\S+) \| \w+ \| rc=\d+ >>/);
    if (h) {
      host = h[1];
      out[host] = {};
      continue;
    }
    const m = line.match(/^([0-9a-f]{64})\s+(\S+)$/);
    if (m && host) out[host][m[2]] = m[1];
  }
  return out;
}

try {
  cleanup(CHALLENGE);

  // Which files do we compare? You wrote the list.
  const files = readFileSync(join(repo, LIST), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (files.length === 0) {
    throw new Error('files-to-compare.txt has no paths yet. Do the TODO: list the files that before.yml writes (look for dest:).');
  }
  const hashCmd = `sha256sum ${files.join(' ')}`;

  // The role must exist: this part compares it with the playbook.
  const tasksList = ansible(['ansible-playbook', SITE, '--list-tasks']);
  if (!/^\s+webserver : /m.test(tasksList.stdout)) {
    throw new Error('Part 1 is not finished: the role webserver has no tasks. Finish part 1 first, then run this again.');
  }

  // 1. The old playbook on new targets.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);
  const old = step(['ansible-playbook', BEFORE], (r) => `Changed ${changedSum(r)}.`);
  if (old.code !== 0) throw new Error('before.yml failed. Read the error above.');
  const oldHash = step(['ansible', 'web', '-m', 'command', '-a', hashCmd], 'The fingerprint (sha256) of each file the playbook wrote.');
  const oldSecond = step(['ansible-playbook', BEFORE], (r) => `Changed ${changedSum(r)} on the second run.`);

  // 2. The role on new targets.
  await fleetReset();
  const role = step(['ansible-playbook', SITE], (r) => `Changed ${changedSum(r)}.`);
  if (role.code !== 0) throw new Error('The role run failed. Read the error above.');
  const roleHash = step(['ansible', 'web', '-m', 'command', '-a', hashCmd], 'The same fingerprints, from the role.');
  const roleSecond = step(['ansible-playbook', SITE], (r) => `Changed ${changedSum(r)} on the second run.`);

  const a = hashes(oldHash.stdout);
  const b = hashes(roleHash.stdout);
  const hostsCompared = Object.keys(a).sort();
  const equal = hostsCompared.length === 2 && JSON.stringify(a) === JSON.stringify(b) && hostsCompared.every((h) => Object.keys(a[h]).length === files.length);

  // 3. A check that the check can fail: change the port in the role run. The config file must now differ.
  await fleetReset();
  const changedRun = step(['ansible-playbook', SITE, '-e', 'site_port=9090'], (r) => `Changed ${changedSum(r)}. This run has a different port on purpose.`);
  const changedHash = step(['ansible', 'web', '-m', 'command', '-a', hashCmd], 'The config file has a different fingerprint now. The index page does not.');
  const c = hashes(changedHash.stdout);
  const differs = (file) => Object.keys(a).some((h) => a[h][file] !== c[h]?.[file]);
  const differingFiles = files.filter(differs);

  const facts = {
    'c5.p3.hashes_equal': equal,
    'c5.p3.files_compared': files.length,
    'c5.p3.hosts_compared': hostsCompared.length,
    'c5.p3.changed_playbook': changedSum(old),
    'c5.p3.changed_role': changedSum(role),
    'c5.p3.changed_playbook_second': changedSum(oldSecond),
    'c5.p3.changed_role_second': changedSum(roleSecond),
    'c5.p3.changed_port_run': changedSum(changedRun),
    'c5.p3.differing_files_with_other_port': differingFiles.join(','),
    'c5.p3.hashes_differ_with_other_port': differingFiles.length > 0,
    'c5.p3.reset_s': round(resetS, 1),
    'c5.p3.files_list': LIST,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1 || v === '') throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used the files in reference/; the paths below show the files without it' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Changed tasks per run: playbook, role, and second runs',
        unit: 'changed',
        bars: [
          { label: 'playbook, first run', value: facts['c5.p3.changed_playbook'] },
          { label: 'role, first run', value: facts['c5.p3.changed_role'] },
          { label: 'playbook, second run', value: facts['c5.p3.changed_playbook_second'] },
          { label: 'role, second run', value: facts['c5.p3.changed_role_second'] },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
