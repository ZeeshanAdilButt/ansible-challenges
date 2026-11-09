// Challenge 6, part 2: hunt the leaks.
// Run: node challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to compare against reference/my-hunt.txt instead of your my-hunt.txt (for maintainers).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset, controlExec } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { CONTAINER_PASS, SECRET_OLD, buildHistoryRepo, makePassword, partRel, scanAll, scanTable, vaultEncryptText, secretsYaml } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 6, part 2: hunt the leaks');
const CHALLENGE = 6;
const PART = partRel(here);
const REPO = `${PART}/scratch-repo`;
const OUTPUT_FILE = join(here, 'leaky-output.txt');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

/** Read my-hunt.txt: lines like debug=2. A blank or missing number is null. */
function readGuesses(file) {
  const guesses = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z_]+)\s*=\s*(\d*)\s*$/);
    if (m) guesses[m[1]] = m[2] === '' ? null : Number(m[2]);
  }
  return guesses;
}

try {
  cleanup(CHALLENGE);
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // The setup: a throwaway vault password, the secret in the vault, and a project with a git history.
  makePassword();
  mkdirSync(join(here, 'vars'), { recursive: true });
  vaultEncryptText(secretsYaml(SECRET_OLD), `${PART}/vars/secrets.yml`);
  buildHistoryRepo(REPO, SECRET_OLD);

  const view = ansible(['ansible-vault', 'view', '--vault-password-file', CONTAINER_PASS, `${PART}/vars/secrets.yml`]);
  rec.step(`node toolkit/ansible.mjs ansible-vault view --vault-password-file ${CONTAINER_PASS} ${PART}/vars/secrets.yml`, view.stdout, 'The secret sits in the vault. Nobody can read vars/secrets.yml without the password. Now watch what the playbook does with it.');

  const gitLog = controlExec(['git', '-C', REPO, 'log', '--oneline']);
  rec.step(`git -C ${REPO} log --oneline`, gitLog.stdout, 'The project has three commits. The last one deleted settings.env.');

  // The leaky run, with -v (a lot of people add -v when something looks wrong).
  const run = ansible(['ansible-playbook', '-v', '--vault-password-file', CONTAINER_PASS, `${PART}/leaky.yml`]);
  if (run.code !== 0) throw new Error(`The playbook failed:\n${run.stdout}`);
  writeFileSync(OUTPUT_FILE, run.stdout);
  rec.step(`node toolkit/ansible.mjs ansible-playbook -v --vault-password-file ${CONTAINER_PASS} ${PART}/leaky.yml`, compactOutput(run.stdout), 'The run saved to leaky-output.txt. Look for demo-secret-not-real-0001 in it.');

  const scan = scanAll({ output: run.stdout, secret: SECRET_OLD, repoRel: REPO });

  rec.step(`docker exec anp-web1 ps -eo args  (only the lines that show the secret)`, scan.psLines.join('\n') || '(none)', 'A command line is public on the host. Any user on web1 can run ps and read it while the job runs.');

  const gitSecret = controlExec(['sh', '-c', `cd /work/${REPO} && git log --all -p | grep -nF -e '${SECRET_OLD}'`]);
  rec.step(`git -C ${REPO} log --all -p | grep -n ${SECRET_OLD}`, gitSecret.stdout, 'Git history shows the secret where it was added (+) and where it was removed (-). Deleting the file did not remove the secret from the old commit.');

  // The scanner table holds the answers. It is stored here, in its place in results.md, but printed only after the learner's counts match.
  const scannerStep = {
    command: `node challenges/challenge-6-find-the-leak/scan.mjs ${PART}/leaky-output.txt ${REPO}`,
    output: scanTable(scan, SECRET_OLD).replace(/\r\n/g, '\n').trimEnd(),
    note: `The scanner counts lines that show the secret, per place: ${scan.total} in all.`,
  };
  rec.steps.push(scannerStep);

  // The learner's own count.
  const guessFile = join(here, reference ? 'reference/my-hunt.txt' : 'my-hunt.txt');
  const guesses = readGuesses(guessFile);
  const truth = {
    debug: scan.parts.debug,
    loop: scan.parts.loop,
    registered: scan.parts.registered,
    process_list: scan.parts.ps,
    git_history: scan.parts.git_history,
  };

  // The hint says which of the five numbers are right and which are not. It never says the true count.
  const wrong = [];
  for (const [k, v] of Object.entries(truth)) {
    if (guesses[k] === undefined || guesses[k] === null) wrong.push(`${k}: no number yet`);
    else if (guesses[k] !== v) wrong.push(`${k}: not right`);
  }
  const matched = wrong.length === 0;
  const showAnswers = matched || reference;
  if (showAnswers) console.log(`\n$ ${scannerStep.command}\n${scannerStep.output}\n-> ${scannerStep.note}`);

  // The counts are saved only when the learner's counts match (or in a maintainer run), so show-facts cannot be used to peek.
  const facts = { 'c6.p2.hunt_file': reference ? `${PART}/reference/my-hunt.txt` : `${PART}/my-hunt.txt` };
  if (showAnswers) {
    Object.assign(facts, {
      'c6.p2.leaks_total': scan.total,
      'c6.p2.leaks_debug': scan.parts.debug,
      'c6.p2.leaks_loop': scan.parts.loop,
      'c6.p2.leaks_registered': scan.parts.registered,
      'c6.p2.leaks_process_list': scan.parts.ps,
      'c6.p2.leaks_git_history': scan.parts.git_history,
      'c6.p2.leaks_git_files_now': scan.parts.git_worktree,
      'c6.p2.leaks_other_tasks': scan.parts.other,
      'c6.p2.places_leaking': Object.values(scan.parts).filter((n) => n > 0).length,
      'c6.p2.copy_task_leaked': scan.perTask['Write the app config'] ?? 0,
    });
  }
  for (const [k, v] of Object.entries(facts)) setFact(k, v);
  setFact('c6.p2.my_hunt_correct', matched);
  if (!matched) {
    console.log(`\nYour counts in ${reference ? 'reference/my-hunt.txt' : 'my-hunt.txt'} do not match yet:\n  ${wrong.join('\n  ')}\nLook again at the places marked "not right" (see the README), fix the numbers and run again. The true counts are shown when all five are right.`);
  } else {
    console.log('\nYour counts match the scanner.');
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}. All secrets are fake.`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Lines that show the secret, per place',
        unit: 'lines',
        bars: [
          { label: 'debug task', value: scan.parts.debug },
          { label: 'loop item', value: scan.parts.loop },
          { label: 'registered, -v', value: scan.parts.registered },
          { label: 'process list', value: scan.parts.ps },
          { label: 'git history', value: scan.parts.git_history },
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
