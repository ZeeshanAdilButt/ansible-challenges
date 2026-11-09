// Challenge 8, part 1: serial batches.
// Run: node challenges/challenge-8-roll-it-out/part-1-serial-batches/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against reference/rollout.yml (for maintainers).
// Helpers are described in toolkit/README.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round, timed } from '../../../toolkit/stats.js';
import { fleetReset, fleetRunning, fleetUp, execIn, ROLLOUT_HOSTS } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 8, part 1: serial batches');

const CHALLENGE = 8;
// Folder of this part as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-8-roll-it-out/part-1-serial-batches';
const ROLLOUT = `${PART}/${reference ? 'reference/' : ''}rollout.yml`;
const INV = 'inventory/rollout.ini';
const WEB = ['web1', 'web2', 'web3', 'web4', 'web5', 'web6'];
const shown = (text) => text.replaceAll('/reference/rollout.yml', '/rollout.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// One batch is one PLAY header in the output. The hosts of the batch are the ones that print a task result.
function batchesOf(text) {
  return text
    .split(/^PLAY \[/m)
    .slice(1)
    .filter((seg) => !seg.startsWith('RECAP'))
    .map((seg) => [...new Set([...seg.matchAll(/^(?:changed|ok|failed|fatal|skipping): \[(\w+)\]/gm)].map((m) => m[1]))].sort());
}
const sizes = (b) => b.map((h) => h.length).join(',');
const quote = (a) => (/[\s:&!*"{]/.test(a) ? `'${a}'` : a);

// Run a playbook, record it, return { r, b } where b is the batch list.
function play(file, extra, note, { record: save = true } = {}) {
  const argv = ['ansible-playbook', '-i', INV, file, ...extra];
  const r = ansible(argv);
  const b = batchesOf(r.stdout);
  if (save) rec.step(shown(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), compactOutput(r.stdout), typeof note === 'function' ? note(r, b) : note);
  return { r, b };
}
const planArg = (plan) => ['-e', JSON.stringify({ plan })];

try {
  cleanup(CHALLENGE);

  // The learner must have written the serial line.
  const text = readFileSync(join(here, reference ? 'reference/rollout.yml' : 'rollout.yml'), 'utf8');
  if (!/^\s*serial:/m.test(text)) {
    throw new Error('rollout.yml has no "serial:" line yet. Open it, read the TODO, add the line, and run this again.');
  }

  // Known start: six web hosts and the database host, all new.
  if (!ROLLOUT_HOSTS.every((h) => fleetRunning().includes(h))) await fleetUp({ rollout: true });
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // 1. The learner's own rollout.yml.
  const mine = play(ROLLOUT, [], (r, b) => `${b.length} batches, sizes ${sizes(b)}. Each PLAY line is one batch. Inside a batch the order of the lines can change from run to run.`);
  if (mine.r.code !== 0) throw new Error(`rollout.yml failed:\n${mine.r.stdout}`);

  // 2. The result on the hosts.
  const cat = ansible(['ansible', 'web', '-i', INV, '-m', 'command', '-a', 'cat /etc/anp-app.conf']);
  rec.step(`node toolkit/ansible.mjs ansible web -i ${INV} -m command -a 'cat /etc/anp-app.conf'`, compactOutput(cat.stdout), 'All six web hosts hold the new config.');
  const newConfig = WEB.filter((h) => execIn(h, ['cat', '/etc/anp-app.conf']).stdout.trim() === 'version=2').length;

  // 3. Other plans. A plan is the value of serial.
  const VARIANTS = `${PART}/variants.yml`;
  const two = play(VARIANTS, planArg(2), (r, b) => `serial: 2 gives ${b.length} batches of sizes ${sizes(b)}.`);
  const pct = play(VARIANTS, planArg('30%'), (r, b) => `serial: "30%" on 6 hosts is 1.8 hosts. The real run made ${b.length} batches of sizes ${sizes(b)}, so Ansible rounds a percentage DOWN (and never goes below 1).`);
  const list = play(VARIANTS, planArg([1, 2]), (r, b) => `serial: [1, 2] gives sizes ${sizes(b)}. The last number repeats until every host has had its turn.`);
  const none = play(VARIANTS, planArg([]), (r, b) => `An empty list means no serial: ${b.length} batch of ${sizes(b)} hosts. (The docs say Ansible works on 5 hosts at a time by default. That limit is called forks. It is a different setting from serial.)`);

  // 4. What does it cost in time? Median of three runs per plan.
  const times = {};
  let lastOut = '';
  for (const [key, plan] of [['none', []], ['serial_1_2_3', [1, 2, 3]], ['serial_1', 1]]) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const t = await timed(() => ansible(['ansible-playbook', '-i', INV, VARIANTS, ...planArg(plan)]));
      if (t.value.code !== 0) throw new Error(`timing run failed:\n${t.value.stdout}`);
      runs.push(t.ms / 1000);
      lastOut = t.value.stdout;
    }
    times[key] = { median: round(median(runs), 1), runs: runs.map((x) => round(x, 1)) };
  }
  rec.step(
    `node toolkit/ansible.mjs ansible-playbook -i ${INV} ${VARIANTS} -e '{"plan": 1}'`,
    compactOutput(lastOut),
    `Wall-clock time of the whole command, median of three runs each: no serial ${times.none.median} s (runs ${times.none.runs.join(', ')}), serial [1, 2, 3] ${times.serial_1_2_3.median} s (runs ${times.serial_1_2_3.runs.join(', ')}), serial 1 ${times.serial_1.median} s (runs ${times.serial_1.runs.join(', ')}). The output shown is the last serial 1 run. Smaller batches are safer and slower.`,
  );

  const facts = {
    'c8.p1.playbook_file': ROLLOUT,
    'c8.p1.batches': mine.b.length,
    'c8.p1.batch_sizes': sizes(mine.b),
    'c8.p1.batch_hosts': mine.b.map((h) => h.join(',')).join(' | '),
    'c8.p1.hosts_with_new_config': newConfig,
    'c8.p1.sizes_serial_2': sizes(two.b),
    'c8.p1.sizes_percent_30': sizes(pct.b),
    'c8.p1.sizes_list_1_2': sizes(list.b),
    'c8.p1.sizes_no_serial': sizes(none.b),
    'c8.p1.seconds_no_serial': times.none.median,
    'c8.p1.seconds_serial_1_2_3': times.serial_1_2_3.median,
    'c8.p1.seconds_serial_1': times.serial_1.median,
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/rollout.yml; the paths below show rollout.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Seconds to change six web hosts, by batch plan (median of 3 runs)',
        unit: 's',
        bars: [
          { label: 'no serial', value: times.none.median },
          { label: 'serial [1, 2, 3]', value: times.serial_1_2_3.median },
          { label: 'serial 1', value: times.serial_1.median },
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
