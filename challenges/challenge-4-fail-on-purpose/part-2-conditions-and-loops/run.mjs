// Challenge 4, part 2: conditions and loops.
// Run: node challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the fixed playbook in reference/ (for maintainers).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { itemCount, parseRecap, retriesFor, total } from '../recap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 4, part 2: conditions and loops');
const CHALLENGE = 4;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops';
const SITE = `${PART}/${reference ? 'reference/' : ''}site.yml`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shownPath = (text) => text.replaceAll('/reference/site.yml', '/site.yml');

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

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. Three new targets, nothing installed by hand.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // 1. The playbook: loops, conditions on group names and on a fact, and a wait with until.
  const run1 = step(['ansible-playbook', SITE], (r) => {
    const recap = parseRecap(r.stdout);
    return `Exit code ${r.code}. Skipped tasks: db1 ${recap.db1?.skipped}, web1 ${recap.web1?.skipped}, web2 ${recap.web2?.skipped}. The wait task retried ${retriesFor(r.stdout, 'web1')} times on web1.`;
  });
  const recap = parseRecap(run1.stdout);

  // The learner's playbook must do the four jobs. Say which one is missing, in plain words.
  const pkgItems = itemCount(run1.stdout, 'Install the common packages', 'web1');
  const userItems = itemCount(run1.stdout, 'Create the users', 'web1');
  if (run1.code !== 0 && /Wait until nginx answers/.test(run1.stdout) && retriesFor(run1.stdout, 'web1') === 0) {
    throw new Error('The wait task failed on its first try: nginx was not up yet. Do TODO 4 in site.yml (until, retries, delay) and run this again.');
  }
  if (run1.code !== 0) throw new Error('site.yml failed. Read the error above, fix site.yml and run this again.');
  if (pkgItems !== 2) throw new Error(`"Install the common packages" ran ${pkgItems} time(s) per host. It should run 2 times (tree and jq). Do TODO 1 in site.yml (loop).`);
  if (userItems !== 3) throw new Error(`"Create the users" ran ${userItems} time(s) per host. It should run 3 times (alice, bob, carol). Do TODO 2 in site.yml (loop and loop_control).`);
  if (recap.db1?.skipped !== 2 || recap.web1?.skipped !== 2) {
    throw new Error(`The skipped counts are db1 ${recap.db1?.skipped}, web1 ${recap.web1?.skipped}. They should be 2 and 2. Do TODO 3 in site.yml (when on group_names).`);
  }

  // 2. Ask each host what it has now (one real check that the loop and the conditions did their work).
  const check = step(['ansible-playbook', `${PART}/report.yml`], 'Each host lists the packages and users it has. nginx is on the web hosts only, sqlite3 on db1 only. The three users are everywhere.');
  const has = {};
  for (const m of check.stdout.matchAll(/ok: \[(\w+)\] => \{\s+"msg": "packages: \[([^\]]*)\], users: \[([^\]]*)\]"/g)) {
    has[m[1]] = { packages: m[2].replace(/'/g, '').split(', ').filter(Boolean), users: m[3].replace(/'/g, '').split(', ').filter(Boolean) };
  }
  const hostsWith = (pkg) => Object.keys(has).filter((h) => has[h].packages.includes(pkg)).sort().join(',');

  // 3. The same wait with too few tries: it fails, and the message says how many attempts were made.
  const few = step(['ansible-playbook', `${PART}/too-few-retries.yml`], (r) => `Exit code ${r.code}. The task retried ${retriesFor(r.stdout, 'web1')} times on web1 and then failed, because nginx needs 25 seconds and the tries ran out first.`);
  const attempts = Number((few.stdout.match(/"attempts": (\d+)/) || [])[1] ?? -1);
  if (few.code === 0) throw new Error('too-few-retries.yml was supposed to fail, but it passed. Something is wrong with the fleet state. Run: node toolkit/fleet.mjs reset');

  // 4. How many times did the task really run? Count with a file on the host.
  const count = step(['ansible-playbook', `${PART}/count-attempts.yml`], (r) => `Exit code ${r.code}. The failure message says attempts: ${(r.stdout.match(/"attempts": (\d+)/) || [])[1]}.`);
  const reportedAttempts = Number((count.stdout.match(/"attempts": (\d+)/) || [])[1] ?? -1);
  const counter = step(['ansible', 'web1', '-m', 'command', '-a', 'cat /tmp/attempts'], 'The file on the host counted the real runs of the check.');
  const realAttempts = Number((counter.stdout.match(/>>\s*(\d+)/) || [])[1] ?? -1);

  const retriesUsed = Math.max(retriesFor(run1.stdout, 'web1'), retriesFor(run1.stdout, 'web2'));
  const facts = {
    'c4.p2.loop_items': pkgItems,
    'c4.p2.user_items': userItems,
    'c4.p2.skipped': total(recap, 'skipped'),
    'c4.p2.skipped_db1': recap.db1.skipped,
    'c4.p2.skipped_web1': recap.web1.skipped,
    'c4.p2.changed': total(recap, 'changed'),
    'c4.p2.nginx_hosts': hostsWith('nginx'),
    'c4.p2.sqlite3_hosts': hostsWith('sqlite3'),
    'c4.p2.hosts_with_all_users': Object.keys(has).filter((h) => has[h].users.length === 3).length,
    'c4.p2.retries_used': retriesUsed,
    'c4.p2.few_retries_exit_code': few.code,
    'c4.p2.few_retries_attempts': attempts,
    'c4.p2.count_reported_attempts': reportedAttempts,
    'c4.p2.count_real_attempts': realAttempts,
    'c4.p2.few_retries_failed_hosts': Object.values(parseRecap(few.stdout)).filter((row) => row.failed > 0).length,
    'c4.p2.reset_s': round(resetS, 1),
    'c4.p2.playbook_file': SITE,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/site.yml; the paths below show site.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Loops, skips and retries in one run',
        unit: 'count',
        bars: [
          { label: 'packages per host', value: facts['c4.p2.loop_items'] },
          { label: 'users per host', value: facts['c4.p2.user_items'] },
          { label: 'skipped tasks (all hosts)', value: facts['c4.p2.skipped'] },
          { label: 'retries used (web1)', value: facts['c4.p2.retries_used'] },
          { label: 'attempts when retries: 3', value: facts['c4.p2.few_retries_attempts'] },
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
