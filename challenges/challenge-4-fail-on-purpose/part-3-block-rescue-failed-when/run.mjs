// Challenge 4, part 3: block, rescue, always, failed_when and ignore_errors.
// Run: node challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the fixed playbooks in reference/ (for maintainers).

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
import { hostsThatRan, parseRecap, total } from '../recap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 4, part 3: block, rescue, failed_when and ignore_errors');
const CHALLENGE = 4;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when';
// The files you write. A --reference run uses the fixed copies, but results.md shows the path a learner types.
const mine = (name) => `${PART}/${reference ? 'reference/' : ''}${name}`;
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

const ANNOUNCE = 'Announce the deploy';
const summary = (r) => {
  const recap = parseRecap(r.stdout);
  return `Exit code ${r.code}. Over the three hosts: ok ${total(recap, 'ok')}, changed ${total(recap, 'changed')}, failed ${total(recap, 'failed')}, rescued ${total(recap, 'rescued')}, ignored ${total(recap, 'ignored')}. The last task ran on ${hostsThatRan(r.stdout, ANNOUNCE).length} host(s).`;
};

try {
  cleanup(CHALLENGE);

  // Step 0: a known start, then the app version file on the web hosts (db1 has none, on purpose).
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);
  const setup = step(['ansible-playbook', `${PART}/setup.yml`], 'web1 and web2 now have /srv/app/version. db1 does not.');
  if (setup.code !== 0) throw new Error('setup.yml failed. Read the error above.');

  // Version 1: nothing handles the error.
  const plain = step(['ansible-playbook', `${PART}/plain.yml`], summary);

  // Version 2: ignore_errors.
  const ignore = step(['ansible-playbook', mine('ignore.yml')], summary);

  // Version 3: block, rescue, always.
  const rescue = step(['ansible-playbook', mine('block-rescue.yml')], summary);
  const marker = step(['ansible', 'db1', '-m', 'command', '-a', 'cat /tmp/needs-deploy'], 'The rescue part ran on db1 and left this file.');

  // Version 4: failed_when.
  const failedWhen = step(['ansible-playbook', mine('failed-when.yml')], summary);

  const R = {
    plain: parseRecap(plain.stdout),
    ignore: parseRecap(ignore.stdout),
    rescue: parseRecap(rescue.stdout),
    failedwhen: parseRecap(failedWhen.stdout),
  };
  const out = { plain, ignore, rescue, failedwhen: failedWhen };

  // Say in plain words what is missing, before the numbers are saved.
  if (total(R.ignore, 'ignored') !== 1) throw new Error('ignore.yml: no task was ignored. Do the TODO: add ignore_errors: true to the task that reads the version.');
  if (total(R.rescue, 'rescued') !== 1) throw new Error('block-rescue.yml: nothing was rescued. Do the TODO: put the two tasks in a block with a rescue and an always.');
  if (total(R.failedwhen, 'failed') !== 2) throw new Error(`failed-when.yml: ${total(R.failedwhen, 'failed')} host(s) failed, expected 2 (web2 has version 2.4.0, db1 has no file). Do the TODO: add failed_when.`);

  const facts = {
    'c4.p3.reset_s': round(resetS, 1),
    'c4.p3.files_folder': reference ? 'reference' : '.',
    'c4.p3.marker_written': marker.code === 0 && /needs a deploy/.test(marker.stdout),
  };
  for (const [name, recap] of Object.entries(R)) {
    for (const key of ['ok', 'changed', 'failed', 'rescued', 'ignored']) facts[`c4.p3.${name}_${key}`] = total(recap, key);
    facts[`c4.p3.${name}_exit_code`] = out[name].code;
    facts[`c4.p3.${name}_announce_hosts`] = hostsThatRan(out[name].stdout, ANNOUNCE).length;
  }
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used the files in reference/; the paths below show the files without it' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Failed hosts and hosts that reached the last task, per version',
        unit: 'hosts',
        bars: [
          { label: 'plain: failed', value: facts['c4.p3.plain_failed'] },
          { label: 'plain: reached last task', value: facts['c4.p3.plain_announce_hosts'] },
          { label: 'ignore_errors: failed', value: facts['c4.p3.ignore_failed'] },
          { label: 'ignore_errors: reached last task', value: facts['c4.p3.ignore_announce_hosts'] },
          { label: 'rescue: failed', value: facts['c4.p3.rescue_failed'] },
          { label: 'rescue: reached last task', value: facts['c4.p3.rescue_announce_hosts'] },
          { label: 'failed_when: failed', value: facts['c4.p3.failedwhen_failed'] },
          { label: 'failed_when: reached last task', value: facts['c4.p3.failedwhen_announce_hosts'] },
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
