// Challenge 9, part 2: the workflow file and a dynamic inventory.
// Run: node challenges/challenge-9-your-pipeline/part-2-the-workflow-file/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to check the files in reference/ in place of yours (for maintainers).
// This part does not run the workflow: GitHub does that. It reads and checks the files.

import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers, run } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { fleetReset, controlExec } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { STAGES } from '../part-1-stages-locally/ci.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 9, part 2: the workflow file and a dynamic inventory');

const CHALLENGE = 9;
const PART = 'challenges/challenge-9-your-pipeline/part-2-the-workflow-file';
const WORKFLOW = join(here, '.github', 'workflows', 'ansible.yml');
const DOCKERFILE = join(here, 'ci', 'Dockerfile');
const SCRIPT = join(here, 'inventory', 'hosts_inventory.py');
const SWAPS = [
  [WORKFLOW, join(here, 'reference', 'ansible.yml')],
  [DOCKERFILE, join(here, 'reference', 'Dockerfile')],
  [SCRIPT, join(here, 'reference', 'hosts_inventory.py')],
];

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const saved = new Map();
try {
  cleanup(CHALLENGE);

  // --reference: put the maintainer's files in place for this run, and put yours back afterwards.
  if (reference) {
    for (const [mine, ref] of SWAPS) {
      saved.set(mine, readFileSync(mine));
      copyFileSync(ref, mine);
    }
  }
  const dockerfile = readFileSync(DOCKERFILE, 'utf8');
  if (/sha256:TODO/.test(dockerfile)) throw new Error('ci/Dockerfile still has "sha256:TODO". Find the digest of python:3.12-slim-bookworm and put it in (the comment at the top says how).');
  if (/TODO/.test(readFileSync(SCRIPT, 'utf8'))) throw new Error('inventory/hosts_inventory.py still has a TODO in build_inventory. Write the loop.');
  if (/TODO/.test(readFileSync(WORKFLOW, 'utf8'))) throw new Error('.github/workflows/ansible.yml still has the TODO about the order of the stage steps. Reorder them, then delete the TODO comment.');

  await fleetReset(); // the control container must run; the targets are not used here

  // 1. The dynamic inventory.
  const INV = `${PART}/inventory/hosts_inventory.py`;
  const graph = ansible(['ansible-inventory', '-i', INV, '--graph']);
  rec.step(`node toolkit/ansible.mjs ansible-inventory -i ${INV} --graph`, graph.stdout, 'The groups and hosts that the script built from hosts.txt.');
  const list = ansible(['ansible-inventory', '-i', INV, '--list'], { merge: false });
  rec.step(`node toolkit/ansible.mjs ansible-inventory -i ${INV} --list`, list.stdout, 'Ansible turned the script output into its own inventory JSON, with the login variables on each host.');
  let inv = {};
  try {
    inv = JSON.parse(list.stdout);
  } catch {
    throw new Error(`ansible-inventory could not read your script:\n${list.stdout}\n${list.stderr}`);
  }
  const hostNames = Object.keys(inv._meta?.hostvars ?? {}).sort();
  const groups = Object.keys(inv).filter((g) => !['_meta', 'all', 'ungrouped'].includes(g)).sort();

  // The same script with another hosts file: the environment variable ANP_HOSTS_FILE.
  const OTHER = join(here, 'other-hosts.txt');
  writeFileSync(OTHER, '# a second hosts file, made by run.mjs\nweb1 web\nweb2 web\nweb3 web\ndb1 db\n');
  let otherHosts = -1;
  try {
    const o = ansible(['ansible-inventory', '-i', INV, '--list'], { env: { ANP_HOSTS_FILE: `/work/${PART}/other-hosts.txt` }, merge: false });
    otherHosts = Object.keys(JSON.parse(o.stdout)._meta.hostvars).length;
    rec.step(`ANP_HOSTS_FILE=/work/${PART}/other-hosts.txt node toolkit/ansible.mjs ansible-inventory -i ${INV} --graph`, ansible(['ansible-inventory', '-i', INV, '--graph'], { env: { ANP_HOSTS_FILE: `/work/${PART}/other-hosts.txt` } }).stdout, `The script reads whatever file the variable names: ${otherHosts} hosts now. (The toolkit passes variables that start with ANSIBLE_ by itself. This one is passed by run.mjs.)`);
  } finally {
    rmSync(OTHER, { force: true });
  }

  // 2. The workflow: parse it with the YAML library that comes with Ansible (the control container has it), then check it.
  const parse = controlExec(['python3', '-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))', `/work/${PART}/.github/workflows/ansible.yml`]);
  if (parse.code !== 0) throw new Error(`The workflow is not valid YAML:\n${parse.stderr || parse.stdout}`);
  const wf = JSON.parse(parse.stdout);
  const steps = wf.jobs?.pipeline?.steps ?? [];
  const stageSteps = steps.map((s) => s.name).filter((n) => STAGES.includes(n));
  const uses = steps.filter((s) => s.uses).map((s) => s.uses);
  const pinned = uses.filter((u) => /@[0-9a-f]{40}$/.test(u));
  rec.step(
    `grep -nE "^\\s+(- name|uses|run):" ${PART}/.github/workflows/ansible.yml`,
    readFileSync(WORKFLOW, 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /^\s+(- name|uses|run):/.test(l)).map(([i, l]) => `${i}:${l}`).join('\n'),
    `The workflow parses as YAML. Its stage steps, in order: ${stageSteps.join(', ')}. ${pinned.length} of ${uses.length} actions are pinned by a 40-character commit. It was not run on GitHub.`,
  );

  // 3. The pinned control image: the digest, and the pip pins against the fleet's own Dockerfile.
  const digest = (dockerfile.match(/^FROM python:3\.12-slim-bookworm@sha256:([0-9a-f]{64})/m) || [])[1] ?? '';
  const local = run(['image', 'inspect', 'python:3.12-slim-bookworm', '--format', '{{json .RepoDigests}}']);
  rec.step("docker image inspect python:3.12-slim-bookworm --format '{{json .RepoDigests}}'", local.stdout.trim() || local.stderr.trim(), 'The digest of the image on this machine. This is how a learner finds the digest for ci/Dockerfile.');
  const digestMatchesLocal = digest !== '' && local.stdout.includes(`sha256:${digest}`);
  const pins = (text) => [...text.matchAll(/"([a-z-]+(?:\[[a-z]+\])?==[0-9.]+)"/g)].map((m) => m[1]).sort();
  const fleetDockerfile = readFileSync(join(here, '..', '..', '..', 'fleet', 'control', 'Dockerfile'), 'utf8');
  const pinsAgree = JSON.stringify(pins(dockerfile)) === JSON.stringify(pins(fleetDockerfile)) && pins(dockerfile).length === 4;
  rec.step('grep -h "==" fleet/control/Dockerfile ' + `${PART}/ci/Dockerfile`, `${pins(fleetDockerfile).join(' ')}\n${pins(dockerfile).join(' ')}`, `The four pip pins in the two Dockerfiles ${pinsAgree ? 'agree' : 'DIFFER'}.`);

  const facts = {
    'c9.p2.files_used': reference ? 'reference' : 'yours',
    'c9.p2.stages': stageSteps.join(','),
    'c9.p2.inventory_hosts': hostNames.length,
    'c9.p2.inventory_groups': groups.join(','),
    'c9.p2.inventory_hosts_other_file': otherHosts,
    'c9.p2.actions_total': uses.length,
    'c9.p2.actions_pinned': pinned.length,
    'c9.p2.base_digest': digest,
    'c9.p2.digest_matches_local': digestMatchesLocal,
    'c9.p2.pins_agree': pinsAgree,
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used the files in reference/' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'What the pipeline files hold: hosts, stages, pinned actions',
        unit: '',
        bars: [
          { label: 'hosts from hosts.txt', value: hostNames.length },
          { label: 'hosts from other-hosts.txt', value: otherHosts },
          { label: 'stage steps in the workflow', value: stageSteps.length },
          { label: 'actions pinned by commit', value: pinned.length },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  for (const [file, content] of saved) writeFileSync(file, content);
  cleanup(CHALLENGE);
}
void compactOutput;
