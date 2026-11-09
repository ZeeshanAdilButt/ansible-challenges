// Challenge 10, part 1: configure the fleet from the brief.
// Run: node challenges/challenge-10-capstone/part-1-configure/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the reference roles (for maintainers).
//
// It starts from a new fleet, runs the pipeline of capstone-stack/ci.mjs (deps, lint, syntax, check, apply, idempotence,
// health), then looks at the live fleet: the proxy, the database password, the user of the app, and where the secret shows up.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { CHALLENGE, showLearnerPaths, clearFacts, clip, closeStack, code, digest, openStack, pinFacts, saveFacts, vaultFacts } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const rec = showLearnerPaths(new Recorder('Challenge 10, part 1: configure the fleet'));
const facts = {};
const f = (name, v) => (facts[`c10.p1.${name}`] = v);

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

let S;
try {
  cleanup(CHALLENGE);
  S = await openStack();
  clearFacts('c10.p1.');
  const REL = S.rel;
  const INV = `${REL}/inventory.ini`;
  const adhoc = (argv, env) => S.ci.play(argv, env);

  // What must exist before anything runs, said in words.
  for (const role of ['web', 'app', 'db']) {
    if (code(S, `roles/${role}/tasks/main.yml`).replace(/---/g, '').trim() === '') {
      throw new Error(`roles/${role}/tasks/main.yml has no tasks yet. Open it, write the tasks the brief asks for (the TODO comments list them), and run this again.`);
    }
  }
  if (!code(S, 'group_vars/all/vault.yml') && !S.reference) {
    throw new Error('group_vars/all/vault.yml does not exist yet. Make the vault first: capstone-stack/README.md, "The secret", shows the three commands.');
  }
  if (!S.reference && !code(S, '.vault-pass').trim()) {
    throw new Error('capstone-stack/.vault-pass does not exist. It holds the vault password in one line. It is git-ignored. See capstone-stack/README.md, "The secret".');
  }

  // Step 0: a known start. Three new targets: no packages, no files, nothing changed by hand.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // Step 1: the pipeline.
  const outputs = [];
  const stageLines = [];
  const result = S.ci.runCi({
    onStage: (s) => {
      stageLines.push(`${s.status.padEnd(8)} ${s.name.padEnd(12)} ${String(s.seconds).padStart(6)} s  ${s.detail.split('\n')[0]}`);
      outputs.push(s.output);
    },
  });
  for (const s of result.stages) if (s.status === 'skipped') stageLines.push(`skipped  ${s.name}`);
  const by = Object.fromEntries(result.stages.map((s) => [s.name, s]));
  const recapOf = (n) => by[n]?.recap ?? {};
  const changed = (n) => Object.values(recapOf(n)).reduce((a, h) => a + h.changed, 0);
  const failedHosts = (n) => Object.values(recapOf(n)).reduce((a, h) => a + h.failed + h.unreachable, 0);

  const stop = result.stages.find((s) => s.status === 'FAILED');
  rec.step(
    `node ${REL.replace('-reference', '')}/ci.mjs`,
    [...stageLines, '', stop ? `The pipeline stopped at "${stop.name}":\n${stop.detail}` : 'All stages passed.'].join('\n'),
    stop ? `Stage ${stop.name} failed. The stages after it did not run.` : 'Seven stages, in order. The first one that fails stops the run, so the first red stage is the one to fix.',
  );

  for (const s of result.stages) f(`stage_${s.name}_s`, s.status === 'skipped' ? 0 : s.seconds);
  f('lint_ok', by.lint?.status === 'ok');
  f('syntax_ok', by.syntax?.status === 'ok');
  f('check_ok', by.check?.status === 'ok');
  f('check_failed_count', failedHosts('check'));
  f('check_changed_count', by.check?.recap ? changed('check') : 99);
  f('first_run_changed_count', changed('apply'));
  f('first_run_failed_count', failedHosts('apply'));
  f('second_run_changed_count', by.idempotence?.recap ? changed('idempotence') : 99);
  f('second_run_hosts_count', Object.keys(recapOf('idempotence')).length);
  f('hosts_ok_count', Object.values(recapOf('apply')).filter((h) => h.failed === 0 && h.unreachable === 0).length);
  f('stages_ok_count', result.stages.filter((s) => s.status === 'ok').length);
  f('stages_total_count', result.stages.length);
  // A run that reached 0 changed: the number of apply runs it took (the first changes things, the next must change nothing).
  f('runs_to_zero_count', by.idempotence?.status === 'ok' ? 2 : 99);

  if (by.apply?.status === 'ok') {
    rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${REL.replace('-reference', '')}/site.yml   (the apply stage, first run)`, clip(digest(by.apply.output), 40), `The first run changed ${changed('apply')} tasks on 3 hosts. Handlers ran once each.`);
  }
  if (by.idempotence?.recap) {
    rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${REL.replace('-reference', '')}/site.yml   (the idempotence stage, second run)`, clip(digest(by.idempotence.output), 20), changed('idempotence') === 0 ? 'The second run changed nothing: changed=0 on every host. That is idempotence.' : `The second run still changed ${changed('idempotence')} tasks. A task that reports changed every time is the one to find (run it with -v).`);
  }
  if (!result.ok) {
    saveFacts(facts);
    throw new Error(`The pipeline stopped at "${stop.name}". Fix it, then run this again.\n${stop.detail}`);
  }

  // Step 2: the live fleet. The proxy answers, with the app and the database behind it.
  const health = adhoc(['ansible', 'web', '-i', INV, '-m', 'ansible.builtin.uri', '-a', 'url=http://localhost/health return_content=true']);
  const probe = S.ci.get('http://web1/health');
  let body = {};
  try {
    body = JSON.parse(probe.body);
  } catch {
    /* not JSON */
  }
  f('health_status', probe.status);
  f('health_app_status', String(body.status ?? 'none'));
  f('health_db', String(body.db ?? 'none'));
  f('health_release', String(body.release ?? 'none'));
  f('health_app_host', String(body.host ?? 'none'));
  f('proxy_release_header', String(probe.headers?.['X-Capstone-Release'] ?? probe.headers?.['x-capstone-release'] ?? 'none'));
  rec.step(`node toolkit/ansible.mjs ansible web -i ${INV} -m ansible.builtin.uri -a 'url=http://localhost/health return_content=true'`, compactOutput(health.stdout), `The request goes to nginx on web1. nginx asks the app on ${body.host}. The app logs in to redis on db1 and sends PING. Answer: status ${probe.status}, db ${body.db}.`);

  // Step 3: redis must ask for the password; the app must not run as root.
  const noauth = adhoc(['ansible', 'db', '-i', INV, '-m', 'ansible.builtin.command', '-a', 'redis-cli -h 127.0.0.1 ping']);
  f('db_requires_password', /NOAUTH/.test(noauth.stdout));
  rec.step(`node toolkit/ansible.mjs ansible db -i ${INV} -m ansible.builtin.command -a 'redis-cli -h 127.0.0.1 ping'`, compactOutput(noauth.stdout), /NOAUTH/.test(noauth.stdout) ? 'redis refuses a PING without the password (NOAUTH). The password from the vault is in force.' : 'redis answered without a password. The config must set requirepass.');

  const who = adhoc(['ansible', 'app', '-i', INV, '-m', 'ansible.builtin.command', '-a', 'ps -o user=,args= -C python3']);
  const appUser = (who.stdout.match(/^(\S+)\s+\/usr\/bin\/python3 .*app\.py/m) || [])[1] ?? 'none';
  f('app_user', appUser);
  f('app_user_nonroot', appUser !== 'none' && appUser !== 'root');
  rec.step(`node toolkit/ansible.mjs ansible app -i ${INV} -m ansible.builtin.command -a 'ps -o user=,args= -C python3'`, compactOutput(who.stdout), `The app runs as "${appUser}".`);

  // Step 4: a diff on purpose. A changed file shows its text in --diff, so a missing diff: false would print the secret here.
  // (On a new fleet the diff of redis.conf is skipped: Ansible does not diff a file over 100 KB, and Debian's default one is.)
  const SHOWN_PLAY = `${REL.replace('-reference', '')}/site.yml`;
  const dprobe = adhoc(['ansible-playbook', '-i', INV, `${REL}/site.yml`, '--diff', '-e', 'db_maxmemory_mb=80', '-e', 'app_log_level=debug']);
  outputs.push(dprobe.stdout);
  const probeRecap = S.ci.parseRecap(dprobe.stdout);
  const probeChanged = Object.values(probeRecap).reduce((a, h) => a + h.changed, 0);
  f('diff_probe_changed_count', Object.keys(probeRecap).length ? probeChanged : 99);
  const diffLines = dprobe.stdout.split(/\r?\n/).filter((l) => /^(--- |\+\+\+ )|^[-+](maxmemory|log_level|requirepass|password)/.test(l));
  const recapLines = dprobe.stdout.split(/\r?\n/).filter((l) => /^PLAY RECAP|^\S+\s+: ok=/.test(l));
  rec.step(
    `node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN_PLAY} --diff -e db_maxmemory_mb=80 -e app_log_level=debug`,
    clip([...diffLines, ...recapLines].join('\n') || '(no diff lines)', 20),
    probeChanged > 0 ? `Two settings changed on purpose (${probeChanged} tasks). --diff printed ${diffLines.length} lines of file text. The last step below searches them for the password.` : 'Nothing changed, so this probe proved nothing. Check the roles.',
  );
  const back = adhoc(['ansible-playbook', '-i', INV, `${REL}/site.yml`]);
  const backRecap = S.ci.parseRecap(back.stdout);
  rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN_PLAY}`, clip(digest(back.stdout), 12), `The two settings are back to release 1 (${Object.values(backRecap).reduce((a, h) => a + h.changed, 0)} tasks changed). The fleet is in the state the next parts expect.`);

  // Step 5: where does the secret show up? In a file, or in what Ansible printed.
  const v = vaultFacts(S, outputs.join('\n'));
  for (const [k, val] of Object.entries(v)) f(k, val);
  const p = pinFacts(S);
  for (const [k, val] of Object.entries(p)) f(k, val);
  rec.step(
    'read the vault file, search every file of the stack and everything the pipeline printed for the secret',
    [
      `vault file encrypted:                ${v.vault_encrypted}`,
      `secret values in the vault:          ${v.vault_secrets_count}`,
      `times a secret appears in a file:    ${v.secret_in_files_count}`,
      `times a secret appears in the output: ${v.secret_in_output_count}`,
      `.vault-pass is git-ignored:          ${v.vault_pass_ignored}`,
      `requirements.yml pins exactly:       ${p.collection_pinned} (${p.collection_count} collection)`,
      `roles that call a module from it:    ${p.collection_used_count} place(s)`,
    ].join('\n'),
    v.secret_in_output_count === 0 && v.secret_in_files_count === 0 ? 'The secret is only in the encrypted file. The pipeline output, including the --diff run, never shows it.' : 'The secret shows up in plain text. Look for a template or copy task without diff: false or no_log: true.',
  );

  saveFacts(facts);
  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${S.reference ? '. The maintainer run used the reference roles; the paths above show capstone-stack' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Seconds each pipeline stage took on a new fleet',
        unit: 's',
        bars: result.stages.map((s) => ({ label: s.name, value: s.status === 'skipped' ? 0 : s.seconds })),
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
  console.log(`\nSecond run changed ${facts['c10.p1.second_run_changed_count']} tasks. See your numbers: node toolkit/show-facts.mjs c10.p1`);
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  closeStack(S);
  cleanup(CHALLENGE);
}
