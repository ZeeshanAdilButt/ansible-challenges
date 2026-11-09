// Challenge 1, part 1: check your setup and start the fleet.
// Run: node challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/run.mjs
// Add --record to also write results.md and chart.svg next to this file.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers, run } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round } from '../../../toolkit/stats.js';
import { checkSetup, formatTable } from '../../../toolkit/check-setup.mjs';
import { CONTROL, IMAGES, controlExec, ensureKeys, fleetBuild, fleetDown, fleetStatus, fleetUp, imageSizesMb } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const record = process.argv.includes('--record');
const rec = new Recorder('Challenge 1, part 1: check your setup and start the fleet');
const CHALLENGE = 1;

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

try {
  cleanup(CHALLENGE);

  // Step 1: is this machine ready?
  const setup = checkSetup({ dir: root });
  rec.step('node toolkit/check-setup.mjs', `${formatTable(setup.rows)}\n\n${setup.ok ? 'All hard checks passed.' : 'A check failed.'}`, setup.ok ? 'No FAIL lines, so the machine is ready.' : 'Fix every FAIL line, then run this again.');
  if (!setup.ok) throw new Error('The setup check failed. Fix the FAIL lines first.');

  // Step 2: build the two images (cached layers make a second build fast).
  fleetBuild({ quiet: true });
  const sizes = imageSizesMb();
  const list = run(['image', 'ls', '--filter', 'label=anp.fleet=1', '--format', 'table {{.Repository}}:{{.Tag}}\t{{.Size}}']);
  rec.step('docker compose -f fleet/compose.yaml build control web1', `${list.stdout.trim()}`, `Two images: the control node is ${sizes.control} MB and a target is ${sizes.target} MB on disk.`);

  // Step 3: the practice key. It is made once, with ssh-keygen from the control image.
  ensureKeys();

  // Step 4: start the fleet three times from nothing and keep the median.
  const ups = [];
  for (let i = 0; i < 3; i++) {
    fleetDown();
    ups.push(await fleetUp());
  }
  const upS = round(median(ups), 1);
  rec.step('node toolkit/fleet.mjs up', `${fleetStatus()}\n\nThe fleet answers on SSH after ${ups[2].toFixed(1)} s.`, `Four containers run. Starting from nothing took ${ups.map((u) => u.toFixed(1)).join(', ')} s in three tries; the median is ${upS} s. The images were already built.`);

  // Step 5: the key inside the control container has mode 600 (ssh insists on that).
  const key = controlExec(['sh', '-c', 'ls -l "$HOME"/.ssh']);
  rec.step('docker exec anp-control ls -l /home/learner/.ssh', key.stdout, 'The private key is mode 600 (only you can read it). ssh refuses a key that others can read.');

  // Step 6: ssh from control to each host, by hand.
  const SSH_OPTS = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=ERROR'];
  for (const host of ['web1', 'web2', 'db1']) {
    const remote = 'hostname; id -un; sudo -n id -un';
    const r = run(['exec', CONTROL, 'ssh', ...SSH_OPTS, `ansible@${host}`, remote]);
    if (r.code !== 0) throw new Error(`ssh to ${host} failed: ${(r.stderr || r.stdout).trim()}`);
    rec.step(`docker exec ${CONTROL} ssh ${SSH_OPTS.join(' ')} ansible@${host} '${remote}'`, r.stdout, `${host} let the key in. The three lines are the host name, the user, and the user after sudo.`);
  }

  // Step 7: which Ansible is this?
  const ver = ansible(['ansible', '--version']);
  rec.step('node toolkit/ansible.mjs ansible --version', ver.stdout, 'The control node runs the pinned version, on Python 3.12.');
  const ansibleVersion = (ver.stdout.match(/\[core ([0-9.]+)\]/) || [])[1];

  // Step 8: the first real Ansible command.
  const ping = ansible(['ansible', 'all', '-m', 'ping']);
  if (ping.code !== 0) throw new Error(`ansible all -m ping failed:\n${ping.stdout}`);
  const pongs = countLines(ping.stdout, /"ping": "pong"/);
  rec.step('node toolkit/ansible.mjs ansible all -m ping', ping.stdout, `${pongs} of 3 hosts answered pong. ping here is not a network ping: it logs in over SSH and runs a small Python module.`);

  setFact('c1.p1.control_image_mb', sizes.control);
  setFact('c1.p1.target_image_mb', sizes.target);
  setFact('c1.p1.fleet_up_s', upS);
  setFact('c1.p1.ping_ok_count', pongs);
  if (ansibleVersion) setFact('c1.p1.ansible_core_version', ansibleVersion);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Size of the two fleet images',
        unit: 'MB',
        bars: [
          { label: `control (${IMAGES.control})`, value: sizes.control },
          { label: `target (${IMAGES.target})`, value: sizes.target },
        ],
      }),
    );
    writeFileSync(
      join(here, 'chart-fleet-up.svg'),
      barsSvg({
        title: 'Seconds from nothing to a fleet that answers SSH',
        unit: 's',
        bars: ups.map((u, i) => ({ label: `try ${i + 1}`, value: round(u, 1) })),
      }),
    );
    console.log('\nWrote results.md, chart.svg and chart-fleet-up.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
