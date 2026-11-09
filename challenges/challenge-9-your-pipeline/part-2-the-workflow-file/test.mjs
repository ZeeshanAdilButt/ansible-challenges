// Challenge 9, part 2 test.
// Run: node --test challenges/challenge-9-your-pipeline/part-2-the-workflow-file/test.mjs
// It fails until you have fixed the three files and run run.mjs once. That is on purpose.
// The workflow itself is not run here. GitHub runs it. The test checks its structure and its pins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning, controlExec } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { STAGES } from '../part-1-stages-locally/ci.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-9-your-pipeline/part-2-the-workflow-file';
const hint = `Run: node ${PART}/run.mjs`;
// A maintainer run used the files in reference/. Read the same files here.
const dir = getFact('c9.p2.files_used') === 'reference' ? 'reference/' : '';
const workflowPath = dir ? 'reference/ansible.yml' : '.github/workflows/ansible.yml';
const dockerfilePath = dir ? 'reference/Dockerfile' : 'ci/Dockerfile';
const scriptPath = dir ? 'reference/hosts_inventory.py' : 'inventory/hosts_inventory.py';

test('the workflow is valid YAML and runs the stages in the order of ci.mjs', () => {
  const parse = controlExec(['python3', '-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))', `/work/${PART}/${workflowPath}`]);
  assert.equal(parse.code, 0, `The workflow is not valid YAML (or the fleet is not running: node toolkit/fleet.mjs up):\n${parse.stderr}`);
  const wf = JSON.parse(parse.stdout);
  const names = (wf.jobs?.pipeline?.steps ?? []).map((s) => s.name).filter((n) => STAGES.includes(n));
  assert.deepEqual(names, STAGES, `The stage steps are in the order [${names}]. ci.mjs runs them in the order [${STAGES}]. Move the steps in .github/workflows/ansible.yml.`);
  assert.equal(getFact('c9.p2.stages'), STAGES.join(','), hint);
});

test('every action in the workflow is pinned by a 40-character commit', () => {
  const total = getFact('c9.p2.actions_total');
  assert.ok(total >= 2, `The workflow should use at least 2 actions (checkout and setup-node). ${hint}`);
  assert.equal(getFact('c9.p2.actions_pinned'), total, `Some actions are pinned by a tag, not by a commit. ${hint}`);
  const text = readFileSync(join(here, workflowPath), 'utf8');
  assert.doesNotMatch(text, /^\s*(- )?uses:\s*\S+@v\d/m, 'An action is pinned by a version tag. Use the commit.');
});

test('the control image is pinned by digest, and the digest is the real one', () => {
  const text = readFileSync(join(here, dockerfilePath), 'utf8');
  assert.doesNotMatch(text, /sha256:TODO/, 'ci/Dockerfile still has sha256:TODO. The comment at the top of the file says how to find the digest.');
  assert.match(text, /^FROM python:3\.12-slim-bookworm@sha256:[0-9a-f]{64}\s*$/m, 'The FROM line must be: FROM python:3.12-slim-bookworm@sha256:<64 hex characters>');
  assert.match(String(getFact('c9.p2.base_digest')), /^[0-9a-f]{64}$/, hint);
  assert.equal(getFact('c9.p2.digest_matches_local'), true, `The digest is not the digest of python:3.12-slim-bookworm on this machine. Check it with: docker image inspect python:3.12-slim-bookworm --format '{{index .RepoDigests 0}}'. ${hint}`);
  assert.equal(getFact('c9.p2.pins_agree'), true, `The pip pins in ci/Dockerfile and fleet/control/Dockerfile must be the same four versions. ${hint}`);
});

test('the dynamic inventory script gives Ansible three hosts in two groups', () => {
  const r = ansible(['ansible-inventory', '-i', `${PART}/${scriptPath}`, '--list'], { merge: false });
  assert.equal(r.code, 0, `ansible-inventory could not use the script. Is the fleet running? ${r.stderr}`);
  const inv = JSON.parse(r.stdout);
  assert.deepEqual([...(inv.web?.hosts ?? [])].sort(), ['web1', 'web2'], 'Group web should hold web1 and web2. Write the loop in build_inventory (TODO).');
  assert.deepEqual([...(inv.db?.hosts ?? [])].sort(), ['db1'], 'Group db should hold db1.');
  assert.equal(inv._meta.hostvars.web1.ansible_user, 'ansible', 'Each host needs the login variables (COMMON_VARS).');
  assert.equal(getFact('c9.p2.inventory_hosts'), 3, hint);
  assert.equal(getFact('c9.p2.inventory_groups'), 'db,web', hint);
  assert.equal(getFact('c9.p2.inventory_hosts_other_file'), 4, `ANP_HOSTS_FILE should change which hosts the script reads. ${hint}`);
});

test('the fleet is running', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(9), { containers: 0, networks: 0, volumes: 0 });
});

test('the README links the safety rules and says the workflow was also run on GitHub', () => {
  const readme = readFileSync(join(here, 'README.md'), 'utf8');
  assert.match(readme, /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
  assert.match(readme, /ran the reference version on GitHub/i, 'The README must say that the maintainer ran the reference workflow on GitHub.');
});

test('results.md and chart.svg exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  const svg = readFileSync(join(here, 'chart.svg'), 'utf8');
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">/);
  assert.match(svg, /<desc id="d">/);
});
