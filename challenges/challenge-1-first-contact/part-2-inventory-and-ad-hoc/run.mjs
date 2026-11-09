// Challenge 1, part 2: the inventory and ad hoc commands.
// Run: node challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the fixed inventory in reference/ (for maintainers).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 1, part 2: the inventory and ad hoc commands');
const CHALLENGE = 1;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc';
const INV = `${PART}/${reference ? 'reference/' : ''}my-inventory.ini`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shownPath = (text) => text.replaceAll('/reference/my-inventory.ini', '/my-inventory.ini');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Run one ansible command, record it, and return the result. The command text is what you could type yourself.
function step(argv, note, { env, shown } = {}) {
  const r = ansible(argv, { env });
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  const prefix = env ? `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ')} ` : '';
  rec.step(shownPath(`${prefix}node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), shown ?? compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}

const hostsIn = (text) => Number((text.match(/hosts \((\d+)\):/) || [])[1] ?? -1);
const countChanged = (text) => countLines(text, /^\S+ \| CHANGED/);

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. Three new targets, no nginx, nothing changed by hand.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // Your inventory must name hosts before anything else makes sense.
  const list = ansible(['ansible-inventory', '-i', INV, '--list'], { merge: false });
  let parsed = null;
  try {
    parsed = JSON.parse(list.stdout);
  } catch {
    /* handled below */
  }
  const names = parsed ? Object.keys(parsed._meta?.hostvars ?? {}) : [];
  if (names.length === 0) {
    throw new Error(`${INV} has no hosts yet. Open it, add the groups web (web1, web2) and db (db1), and run this again.\n${(list.stderr || '').trim()}`);
  }

  // Step 1: the inventory as a tree.
  step(['ansible-inventory', '-i', INV, '--graph'], 'The inventory is a tree. The group all holds every host. web and db are groups you made.');

  // Step 2: list hosts, and patterns.
  const all = step(['ansible', 'all', '-i', INV, '--list-hosts'], (r) => `all selects ${hostsIn(r.stdout)} hosts.`);
  const web = step(['ansible', 'web', '-i', INV, '--list-hosts'], (r) => `web selects ${hostsIn(r.stdout)} hosts.`);
  const notDb = step(['ansible', 'all:!db', '-i', INV, '--list-hosts'], (r) => `all:!db means "all, except db". It selects ${hostsIn(r.stdout)} hosts.`);
  const webAndDb = step(['ansible', 'web:&db', '-i', INV, '--list-hosts'], (r) => `web:&db means "in web and also in db". No host is in both, so it selects ${hostsIn(r.stdout)}.`);

  // Step 3: facts about the targets, filtered.
  step(['ansible', 'all', '-i', INV, '-m', 'setup', '-a', 'filter=ansible_distribution*'], 'The setup module gathers facts. filter= keeps only the names that match.');
  const py = step(['ansible', 'all', '-i', INV, '-m', 'setup', '-a', 'filter=ansible_python_version'], 'The Python that Ansible found on each target. It runs the modules with this one.');
  const targetPython = (py.stdout.match(/"ansible_python_version": "([0-9.]+)"/) || [])[1];

  // Step 4: the interpreter discovery warning, without and with the setting in ansible.cfg.
  const cfg = ansible(['ansible-config', 'dump', '--only-changed']);
  rec.step('node toolkit/ansible.mjs ansible-config dump --only-changed', cfg.stdout, 'ansible.cfg sets interpreter_python to auto_silent. This shows the settings that differ from the defaults.');
  const warnDefault = step(['ansible', 'all', '-i', INV, '-m', 'ping'], (r) => `With interpreter_python on its default (auto), Ansible printed ${countLines(r.stdout, /discovered Python interpreter/)} warning lines.`, { env: { ANSIBLE_PYTHON_INTERPRETER: 'auto' } });
  const warnSet = step(['ansible', 'all', '-i', INV, '-m', 'ping'], (r) => `With auto_silent from ansible.cfg, it printed ${countLines(r.stdout, /discovered Python interpreter/)} warning lines.`);

  // Step 5: one real change, on web only.
  const noBecome = ansible(['ansible', 'web', '-i', INV, '-m', 'apt', '-a', 'name=nginx state=present']);
  rec.step(shownPath('node toolkit/ansible.mjs ansible web -i ' + INV) + " -m apt -a 'name=nginx state=present'", compactOutput(noBecome.stdout), 'It fails: the user ansible is not root, and installing a package needs root. This is why we add -b (become).');
  const first = step(['ansible', 'web', '-i', INV, '-b', '-m', 'apt', '-a', 'name=nginx state=present'], (r) => `${countChanged(r.stdout)} hosts changed: nginx was installed on web1 and web2 only.`);
  const second = step(['ansible', 'web', '-i', INV, '-b', '-m', 'apt', '-a', 'name=nginx state=present'], (r) => `${countChanged(r.stdout)} hosts changed. The same command, run twice, changes things once. That is idempotence.`);

  // Step 6: a command that only reads.
  const uptime = step(['ansible', 'all', '-i', INV, '-m', 'command', '-a', 'uptime'], (r) => `${countChanged(r.stdout)} of 3 hosts say CHANGED, although uptime only reads. The command module cannot know, so it always says changed.`);

  const facts = {
    'c1.p2.hosts_all': hostsIn(all.stdout),
    'c1.p2.hosts_web': hostsIn(web.stdout),
    'c1.p2.hosts_not_db': hostsIn(notDb.stdout),
    'c1.p2.hosts_web_and_db': hostsIn(webAndDb.stdout),
    'c1.p2.adhoc_changed_first': countChanged(first.stdout),
    'c1.p2.adhoc_changed_second': countChanged(second.stdout),
    'c1.p2.command_changed': countChanged(uptime.stdout),
    'c1.p2.target_python': targetPython,
    'c1.p2.warning_lines_default': countLines(warnDefault.stdout, /discovered Python interpreter/),
    'c1.p2.warning_lines_set': countLines(warnSet.stdout, /discovered Python interpreter/),
    'c1.p2.reset_s': round(resetS, 1),
    'c1.p2.inventory_file': INV,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/my-inventory.ini; the paths below show my-inventory.ini' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Hosts each pattern selects, and hosts the nginx command changed',
        unit: 'hosts',
        bars: [
          { label: 'all', value: facts['c1.p2.hosts_all'] },
          { label: 'web', value: facts['c1.p2.hosts_web'] },
          { label: 'all:!db', value: facts['c1.p2.hosts_not_db'] },
          { label: 'web:&db', value: facts['c1.p2.hosts_web_and_db'] },
          { label: 'nginx, first run', value: facts['c1.p2.adhoc_changed_first'] },
          { label: 'nginx, second run', value: facts['c1.p2.adhoc_changed_second'] },
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
