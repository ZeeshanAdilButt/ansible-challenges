// Challenge 3, part 1: the precedence ladder.
// Run: node challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to use the fixed guess in reference/ (for maintainers).
//
// The run builds a small project in work/, adds one place at a time where app_port can be set
// (see ladder.mjs), runs a playbook after each step and records which place won on web1 and web2.

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
import { SOURCES, render, winners } from './ladder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 3, part 1: the precedence ladder');
const CHALLENGE = 3;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder';
const WORK = `${PART}/work`;
const GUESS = join(here, reference ? 'reference' : '.', 'my-guess.txt');

// The six places in the guess file, and the ladder place each name stands for.
const GUESS_NAMES = {
  'role-defaults': 'role-defaults',
  'group_vars-all': 'playbook-group_vars-all',
  'group_vars-web': 'playbook-group_vars-web',
  'host_vars-web2': 'playbook-host_vars-web2',
  'play-vars': 'play-vars',
  'extra-vars': 'extra-vars',
};

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Run the probe playbook once, record it, return the result.
function probe(note, extra = []) {
  const argv = ['ansible-playbook', '-i', `${WORK}/inv/inventory.ini`, `${WORK}/site.yml`, ...extra];
  const r = ansible(argv);
  rec.step(`node toolkit/ansible.mjs ${argv.join(' ')}`, compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}

try {
  cleanup(CHALLENGE);

  // Your guess comes first. You need six names, each once.
  const lines = readFileSync(GUESS, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const unknown = lines.filter((l) => !(l in GUESS_NAMES));
  if (lines.length !== 6 || unknown.length > 0 || new Set(lines).size !== 6) {
    throw new Error(`my-guess.txt needs these six names, each once, one per line: ${Object.keys(GUESS_NAMES).join(', ')}. It has ${lines.length} name(s)${unknown.length ? ` and does not know: ${unknown.join(', ')}` : ''}. Write your guess, weakest place first, and run this again.`);
  }

  // A known start. The probe does not change the servers, but every part begins with new ones.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // Add one place at a time, weakest first (the order of the documentation), and record the winner.
  const on = new Set();
  const winnersWeb1 = [];
  const winnersWeb2 = [];
  let mismatches = 0;
  for (const [i, s] of SOURCES.entries()) {
    on.add(s.id);
    const { extra } = render(join(here, 'work'), on);
    const r = probe((res) => {
      const w = winners(res.stdout);
      return `Step ${i + 1}, added: ${s.label}. Winner on web1: ${w.play.web1}. Winner on web2: ${w.play.web2}.${s.id === 'role-params' ? ` Inside the role: web1 ${w.role.web1}, web2 ${w.role.web2}. A task after the role cannot see role params.` : ''}`;
    }, extra);
    if (r.code !== 0) throw new Error(`The playbook failed at step ${i + 1} (${s.id}). Read the output above.`);
    const w = winners(r.stdout);
    // Role params exist only inside the role, so that step is judged by the task inside the role.
    const view = s.id === 'role-params' ? w.role : w.play;
    winnersWeb1.push(view.web1);
    winnersWeb2.push(view.web2);
    for (const h of ['web1', 'web2']) {
      const applies = !s.hosts || s.hosts.includes(h);
      if (applies && view[h] !== s.id) {
        mismatches += 1;
        console.log(`  NOTE: the documentation says ${s.id} beats everything before it on ${h}, but ${view[h]} won.`);
      }
    }
  }

  // The finished project, for you to read.
  for (const file of ['site.yml', 'inv/inventory.ini']) {
    rec.step(`cat ${WORK}/${file}`, readFileSync(join(here, 'work', file), 'utf8'), `This file, as it is when all ${SOURCES.length} places are switched on.`);
  }

  // Role params: visible only inside the role. Switch on nothing else and look at both tasks.
  render(join(here, 'work'), new Set(['role-params']));
  const only = probe('Only role params are set. The task inside the role sees them. The task after the role does not: the variable is undefined there, and the play stops.');
  const roleOnly = winners(only.stdout);
  const outside = /'app_port' is undefined/.test(only.stdout);

  // A place the documentation does not list: vars: written under a role in roles:.
  render(join(here, 'work'), new Set(['role-entry-vars', 'role-vars']));
  const entryVsFile = winners(probe('vars: under the role entry, against a vars/main.yml file inside the role.').stdout);
  render(join(here, 'work'), new Set(['role-entry-vars', 'include_vars']));
  const entryVsInclude = winners(probe('vars: under the role entry, against an include_vars task that ran before the role.').stdout);

  const ids = SOURCES.map((s) => s.id);
  const core = Object.values(GUESS_NAMES);
  // Order of the six core places as measured: their position in the ladder.
  const measuredCore = core.slice().sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
  const guessIds = lines.map((l) => GUESS_NAMES[l]);
  let pairsRight = 0;
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) if (measuredCore.indexOf(guessIds[a]) < measuredCore.indexOf(guessIds[b])) pairsRight += 1;
  const nameOf = (id) => Object.keys(GUESS_NAMES).find((k) => GUESS_NAMES[k] === id);
  console.log(`\nYour guess had ${pairsRight} of 15 pairs in the right order. Measured order, weakest first: ${measuredCore.map(nameOf).join(', ')}`);

  const facts = {
    'c3.p1.sources_tested': SOURCES.length,
    'c3.p1.winners_web1': winnersWeb1.join(','),
    'c3.p1.winners_web2': winnersWeb2.join(','),
    'c3.p1.docs_mismatches': mismatches,
    'c3.p1.core_order': measuredCore.map(nameOf).join(','),
    'c3.p1.role_params_inside_role': roleOnly.role.web2,
    'c3.p1.role_params_visible_after_role': !outside,
    'c3.p1.role_entry_vars_beats_role_vars_file': entryVsFile.role.web2 === 'role-entry-vars',
    'c3.p1.include_vars_beats_role_entry_vars': entryVsInclude.role.web2 === 'include_vars',
    'c3.p1.guess_pairs_right': pairsRight,
    'c3.p1.guess_file': reference ? `${PART}/reference/my-guess.txt` : `${PART}/my-guess.txt`,
    'c3.p1.reset_s': round(resetS, 1),
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    // Put the finished project back so that work/ shows every place.
    render(join(here, 'work'), new Set(ids));
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Rank of the place that wins on web2 as each place is added (18 is the strongest)',
        unit: '',
        bars: SOURCES.map((s, i) => ({ label: `${i + 1} ${s.id}`, value: ids.indexOf(winnersWeb2[i]) + 1 })),
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  } else {
    render(join(here, 'work'), new Set(ids));
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
