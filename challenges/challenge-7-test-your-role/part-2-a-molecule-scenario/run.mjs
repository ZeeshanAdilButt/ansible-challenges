// Challenge 7, part 2: a Molecule scenario for a role.
// Run: node challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to use reference/verify.yml instead of your verify.yml (for maintainers; your file is put back afterwards).
//
// THE ONE EXCEPTION to "no Docker socket": Molecule runs in the container anp-c7-molecule, which has
// /var/run/docker.sock mounted. See toolkit/molecule.mjs and SAFETY.md.

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers, run } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round } from '../../../toolkit/stats.js';
import { COLLECTIONS, installCollections, moleculeDown, moleculeExec, moleculeUp } from '../../../toolkit/molecule.mjs';
import { CHALLENGE, countPassedAsserts, molecule, parseRecap, secondsSince } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 7, part 2: a Molecule scenario');
const PART = 'challenges/challenge-7-test-your-role/part-2-a-molecule-scenario';
const ROLE = `${PART}/roles/webserver`;
const verifyPath = join(here, 'roles', 'webserver', 'molecule', 'default', 'verify.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const assertTasks = (text) => (text.match(/ansible\.builtin\.assert:/g) ?? []).length;
const originalVerify = readFileSync(verifyPath, 'utf8');
try {
  cleanup(CHALLENGE);
  if (reference) copyFileSync(join(here, 'reference', 'verify.yml'), verifyPath);

  // Your verify.yml must have real assertions before we spend minutes on a test run.
  const nAsserts = assertTasks(readFileSync(verifyPath, 'utf8'));
  if (nAsserts < 3) {
    throw new Error(`verify.yml has ${nAsserts} assert task(s) and needs 3 (see the TODO comments in ${ROLE}/molecule/default/verify.yml). Write them first, then run this again.`);
  }

  // The Molecule container, with the Docker socket. Then the collections the Docker driver needs.
  const name = await moleculeUp(CHALLENGE);
  const gid = run(['inspect', '--format', '{{range .HostConfig.GroupAdd}}{{.}} {{end}}', name]).stdout.trim();
  const inspect = run(['inspect', '--format', '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}', name]).stdout.trim().split(/\r?\n/).filter((l) => /docker\.sock/.test(l)).join('\n');
  rec.step(`docker inspect ${name}  (the mount that holds the Docker socket, and the extra group)`, `${inspect}\nGroupAdd: ${gid}`, 'The one container with the Docker socket. It runs as the normal user, not root, and is not --privileged. The extra group is the group that owns the socket (0 on Docker Desktop).');

  const inst = installCollections(CHALLENGE);
  const list = moleculeExec(CHALLENGE, ['ansible-galaxy', 'collection', 'list']);
  rec.step('docker exec anp-c7-molecule ansible-galaxy collection list', list.stdout, `The Docker driver needs community.docker and ansible.posix. They are installed at run time at pinned versions${inst.installed ? ` (${round(inst.seconds, 1)} s)` : ' (already installed)'}. community.docker brings community.library_inventory_filtering_v1 with it.`);

  const drivers = moleculeExec(CHALLENGE, ['molecule', 'drivers']);
  rec.step('docker exec anp-c7-molecule molecule drivers', drivers.stdout, 'The driver list. docker is there because molecule-plugins[docker] is installed.');

  // The full test sequence, three times. The first run is recorded in full.
  const secs = [];
  let first = null;
  for (let i = 0; i < 3; i++) {
    const t0 = process.hrtime.bigint();
    const r = molecule(ROLE, ['test']);
    secs.push(secondsSince(t0));
    if (r.code !== 0) throw new Error(`molecule test failed (run ${i + 1}):\n${r.stdout.split('\n').slice(-60).join('\n')}`);
    if (i === 0) first = r;
  }
  const recap = parseRecap(first.stdout);
  const asserts = countPassedAsserts(first.stdout);
  const testS = round(median(secs), 1);
  const handlerRan = /RUNNING HANDLER \[acme\.webserver : Reload nginx\]/.test(first.stdout);
  rec.step(`node toolkit/molecule.mjs run 7 ${ROLE} molecule test`, compactOutput(first.stdout), `The whole sequence passed: ${recap.successful} steps successful, ${recap.actions - recap.successful} of the ${recap.actions} steps have no playbook (dependency, cleanup twice, prepare, side_effect), which the recap counts as ${recap.missing} missing because the dependency step lacks two files, ${asserts} assertions passed. Three runs took ${secs.join(', ')} s, median ${testS} s.`);

  // The instance is named and labelled, so cleanup can find it.
  molecule(ROLE, ['create']);
  const fmt = '{{.Names}} label anp.challenge={{.Label "anp.challenge"}} image {{.Image}}';
  const ps = run(['ps', '-a', '--filter', 'label=anp.challenge=7', '--filter', 'name=anp-c7-instance', '--format', fmt]);
  rec.step(`docker ps -a --filter label=anp.challenge=7 --filter name=anp-c7-instance --format '${fmt}'`, ps.stdout.trim(), 'While a scenario exists, its container carries the name anp-c7-instance and the label anp.challenge=7 from molecule.yml. Cleanup finds it by the label.');
  const instanceLabelled = /anp-c7-instance label anp\.challenge=7/.test(ps.stdout);
  molecule(ROLE, ['destroy']);

  const facts = {
    'c7.p2.steps_passed': recap.successful,
    'c7.p2.steps_missing': recap.missing,
    'c7.p2.steps_failed': recap.failed,
    'c7.p2.test_s': testS,
    'c7.p2.test_runs_s': secs.join(', '),
    'c7.p2.verify_asserts': asserts,
    'c7.p2.handler_ran_in_converge': handlerRan,
    'c7.p2.instance_labelled': instanceLabelled,
    'c7.p2.collections_install_s': inst.installed ? round(inst.seconds, 1) : 0,
    'c7.p2.collections_pinned': Object.entries(COLLECTIONS).map(([c, v]) => `${c}=${v}`).join(' '),
    'c7.p2.docker_socket_group': gid,
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  moleculeDown(CHALLENGE);
  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/verify.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Seconds for three full molecule test runs',
        unit: 's',
        bars: [...secs.map((s, i) => ({ label: `run ${i + 1}`, value: s })), { label: 'median', value: testS }],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (reference) writeFileSync(verifyPath, originalVerify);
  cleanup(CHALLENGE);
}
