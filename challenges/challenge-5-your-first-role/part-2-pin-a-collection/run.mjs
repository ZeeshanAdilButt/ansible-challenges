// Challenge 5, part 2: pin a collection.
// Run: node challenges/challenge-5-your-first-role/part-2-pin-a-collection/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the fixed requirements.yml in reference/ (for maintainers).
// This part needs the internet: it downloads one small collection (about 170 KB) from Ansible Galaxy.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round, timed } from '../../../toolkit/stats.js';
import { controlExec, fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { parseRecap, total } from '../recap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 5, part 2: pin a collection');
const CHALLENGE = 5;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-5-your-first-role/part-2-pin-a-collection';
const REQ = `${PART}/${reference ? 'reference/' : ''}requirements.yml`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shownPath = (text) => text.replaceAll('/reference/', '/');
const COLLECTIONS = 'collections';

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

// The version of ansible.posix that "collection list" prints, or '' when it is not there.
const versionIn = (text) => (text.match(/^ansible\.posix\s+(\S+)\s*$/m) || [])[1] ?? '';
const wipe = (path) => controlExec(['rm', '-rf', path]);
const installArgs = (file, path) => ['ansible-galaxy', 'collection', 'install', '-r', file, '-p', path];

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. New targets and no collections folder.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);
  wipe(COLLECTIONS);

  // The pin must be an exact version: three numbers, no operator.
  const reqText = readFileSync(join(here, '..', '..', '..', REQ), 'utf8');
  const codeText = reqText.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const pinInFile = (codeText.match(/^\s+version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m) || [])[1];
  if (!pinInFile) {
    throw new Error('requirements.yml has no exact version yet. Do the TODO: add the line  version: "2.1.0"  under the collection name.');
  }

  // 1. A playbook that uses a module from a collection that is not installed yet.
  const missing = step(['ansible-playbook', `${PART}/use-it.yml`], (r) => `Exit code ${r.code}. The module ansible.posix.sysctl is not part of ansible-core, and no collection is installed yet.`);
  const missingMsg = (missing.stdout.match(/couldn't resolve module\/action[^\n]*/) || [])[0] ?? '';

  // 2. What you get without a pin: the newest version today. Then the folder is emptied again.
  step(['ansible-galaxy', 'collection', 'install', 'ansible.posix', '-p', COLLECTIONS], 'No version given: Galaxy picks the newest one.');
  const latestList = step(['ansible-galaxy', 'collection', 'list', '-p', COLLECTIONS], (r) => `The newest version today is ${versionIn(r.stdout)}. A pin keeps you on the version you tested.`);
  const latestVersion = versionIn(latestList.stdout);

  // 3. Install the pinned collection. Three times, each from an empty folder, so the time means something.
  const times = [];
  let firstInstall;
  for (let i = 0; i < 3; i++) {
    wipe(COLLECTIONS);
    const { ms, value } = await timed(() => ansible(installArgs(REQ, COLLECTIONS)));
    if (value.code !== 0) throw new Error(`The install failed. Read this and fix requirements.yml:\n${value.stdout}`);
    times.push(ms / 1000);
    if (i === 0) firstInstall = value;
  }
  const quoteArg = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(shownPath(`node toolkit/ansible.mjs ${installArgs(REQ, COLLECTIONS).map(quoteArg).join(' ')}`), compactOutput(firstInstall.stdout), `Downloaded from Galaxy and unpacked into ${COLLECTIONS}/. Run three times from an empty folder: ${times.map((t) => round(t, 1)).join(' s, ')} s.`);

  // 4. What is installed now.
  const list = step(['ansible-galaxy', 'collection', 'list', '-p', COLLECTIONS], 'The collection list shows the exact version that is on disk.');
  const pinned = versionIn(list.stdout);

  // 5. Use a module from it, twice.
  const use1 = step(['ansible-playbook', `${PART}/use-it.yml`], (r) => `Changed ${total(parseRecap(r.stdout), 'changed')}: the module from the collection ran on each web host.`);
  const use2 = step(['ansible-playbook', `${PART}/use-it.yml`], (r) => `Changed ${total(parseRecap(r.stdout), 'changed')}: the module is idempotent.`);

  // 6. Install again: nothing happens, even if Galaxy has a newer version.
  const again = step(installArgs(REQ, COLLECTIONS), 'A second install does nothing when the pinned version is already there.');

  // 7. An impossible pin.
  const bad = step(installArgs(`${PART}/bad-requirements.yml`, COLLECTIONS), (r) => `Exit code ${r.code}. Galaxy has no version 99.0.0, so the install stops. Nothing on disk changed.`);
  const badMsg = (bad.stdout.match(/\[ERROR\][^\n]*\n\* [^\n]*/) || [])[0]?.replace('\n', ' ') ?? '';


  if (pinned !== pinInFile) throw new Error(`requirements.yml says ${pinInFile} but the installed version is ${pinned || 'missing'}. Look at the output above.`);

  const facts = {
    'c5.p2.pinned_version': pinned,
    'c5.p2.install_s': round(median(times), 1),
    'c5.p2.latest_version': latestVersion,
    'c5.p2.missing_collection_exit_code': missing.code,
    'c5.p2.missing_collection_message': missingMsg.slice(0, 160),
    'c5.p2.use_changed_first': total(parseRecap(use1.stdout), 'changed'),
    'c5.p2.use_changed_second': total(parseRecap(use2.stdout), 'changed'),
    'c5.p2.second_install_nothing': /Nothing to do|already installed/i.test(again.stdout),
    'c5.p2.bad_pin_exit_code': bad.code,
    'c5.p2.bad_pin_message': badMsg.slice(0, 260),
    'c5.p2.reset_s': round(resetS, 1),
    'c5.p2.requirements_file': REQ,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1 || v === '') throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/requirements.yml; the paths below show requirements.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Seconds to install the pinned collection (three installs)',
        unit: 's',
        bars: times.map((t, i) => ({ label: `install ${i + 1}`, value: round(t, 1) })),
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
