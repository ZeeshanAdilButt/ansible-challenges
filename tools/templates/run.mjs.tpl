// Challenge @@N@@, part @@M@@: @@TITLE@@.
// Run: node challenges/@@CHALLENGE_DIR@@/@@PART_DIR@@/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the fixed files in reference/ (for maintainers).
// Helpers are described in toolkit/README.md.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round, timed } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const rec = new Recorder('Challenge @@N@@, part @@M@@: @@TITLE@@');

const CHALLENGE = @@N@@;
// Folder of this part as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/@@CHALLENGE_DIR@@/@@PART_DIR@@';

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

try {
  cleanup(CHALLENGE); // leftovers of an earlier run (extra containers only, never the fleet)
  const seconds = await fleetReset(); // known start: three new targets, or the fleet is started
  console.log(`Fleet ready in ${round(seconds, 1)} s`);

  // TODO: replace this example with the real experiment.
  const times = [];
  let out = '';
  for (let i = 0; i < 3; i++) {
    const t = await timed(() => ansible(['ansible', 'all', '-m', 'ping']));
    if (t.value.code !== 0) throw new Error(`ansible failed:\n${t.value.stdout}`);
    times.push(t.ms);
    if (i === 0) out = t.value.stdout;
  }
  const pongs = countLines(out, /"ping": "pong"/);
  const secondsPing = round(median(times) / 1000, 2);
  rec.step('ansible all -m ping', out, `${pongs} hosts answered. One run took ${secondsPing} s (median of 3).`);

  // Name facts c<N>.p<M>.<what>_<unit>. Never type a number in by hand.
  setFact('c@@N@@.p@@M@@.example_s', secondsPing);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}`);
    writeFileSync(join(here, 'chart.svg'), barsSvg({ title: 'Example timing', unit: 's', bars: [{ label: 'One run', value: secondsPing }] }));
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
