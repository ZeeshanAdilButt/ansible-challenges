// Challenge 6, part 3: fix the leaks and scan again.
// Run: node challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run reference/fixed.yml instead of your fixed.yml (for maintainers; your file is put back afterwards).

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset, execIn } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';
import { CONTAINER_PASS, SECRET_NEW, SECRET_OLD, buildHistoryRepo, makePassword, partRel, scanAll, scanOutput, scanRepo, scanTable, secretsYaml, vaultEncryptText } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 6, part 3: fix the leaks and scan again');
const CHALLENGE = 6;
const PART = partRel(here);
const REPO = `${PART}/scratch-repo`;
const VAULT = ['--vault-password-file', CONTAINER_PASS];
const fixedPath = join(here, 'fixed.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
const trim = (l, n = 230) => (l.length > n ? `${l.slice(0, n)} ... [${l.length - n} more characters left out]` : l);

/** Run a playbook, record it, return the raw result. `show` can replace the recorded output. */
function play(args, note, { env, show } = {}) {
  const r = ansible(['ansible-playbook', ...args], { env });
  const prefix = env ? `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ')} ` : '';
  const out = show ? show(r.stdout) : compactOutput(r.stdout);
  rec.step(`${prefix}node toolkit/ansible.mjs ansible-playbook ${args.map(quote).join(' ')}`, out, typeof note === 'function' ? note(r) : note);
  return r;
}

/** The lines of text that show the secret, cut short, at most `max` of them. */
const secretLines = (text, secret, max = 6) => {
  const hits = text.split(/\r?\n/).filter((l) => l.includes(secret));
  return `${hits.slice(0, max).map((l) => trim(l)).join('\n')}${hits.length > max ? `\n... and ${hits.length - max} more lines` : ''}` || '(no line shows the secret)';
};
const countSecret = (text, secret) => text.split(/\r?\n/).filter((l) => l.includes(secret)).length;

const originalFixed = readFileSync(fixedPath, 'utf8');
try {
  cleanup(CHALLENGE);
  if (reference) copyFileSync(join(here, 'reference', 'fixed.yml'), fixedPath);
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // Setup: a throwaway password, the OLD secret in the vault, a project whose history holds the old secret.
  makePassword();
  mkdirSync(join(here, 'vars'), { recursive: true });
  vaultEncryptText(secretsYaml(SECRET_OLD), `${PART}/vars/secrets.yml`);
  buildHistoryRepo(REPO, SECRET_OLD);

  // 1. Before: the leaky playbook, as in part 2.
  const before = play(['-v', ...VAULT, `${PART}/leaky.yml`], 'The leaky run from part 2, as a starting point.', { show: (t) => secretLines(t, SECRET_OLD, 12) });
  if (before.code !== 0) throw new Error(`leaky.yml failed:\n${before.stdout}`);
  writeFileSync(join(here, 'leaky-output.txt'), before.stdout);
  const scanBefore = scanAll({ output: before.stdout, secret: SECRET_OLD, repoRel: REPO });
  rec.step(`node challenges/challenge-6-find-the-leak/scan.mjs ${PART}/leaky-output.txt ${REPO}`, scanTable(scanBefore, SECRET_OLD), `Before: ${scanBefore.total} lines show the secret. The line above this note lists only the lines that do.`);

  // 2. Rotate. The old secret is in the git history and in logs. Deleting it there does not make it safe. A new value does.
  vaultEncryptText(secretsYaml(SECRET_NEW), `${PART}/vars/secrets.yml`);
  const view = ansible(['ansible-vault', 'view', ...VAULT, `${PART}/vars/secrets.yml`]);
  rec.step(`node toolkit/ansible.mjs ansible-vault view ${VAULT.join(' ')} ${PART}/vars/secrets.yml`, view.stdout, 'The secret is rotated: the vault now holds a new fake value. The old one must be treated as burnt.');

  // 3. After: the learner's fixed.yml on fresh targets.
  await fleetReset();
  const after = play(['-v', ...VAULT, `${PART}/fixed.yml`], 'Your fixed playbook, run with -v again.');
  if (after.code !== 0) throw new Error(`fixed.yml failed:\n${after.stdout}`);
  writeFileSync(join(here, 'fixed-output.txt'), after.stdout);
  const scanAfter = scanAll({ output: after.stdout, secret: SECRET_NEW, repoRel: REPO });
  rec.step(`node challenges/challenge-6-find-the-leak/scan.mjs ${PART}/fixed-output.txt ${REPO} ${SECRET_NEW}`, scanTable(scanAfter, SECRET_NEW), `After: ${scanAfter.total} lines show the new secret.`);
  const oldInHistory = scanRepo(REPO, SECRET_OLD).history;
  const oldInOutput = countSecret(after.stdout, SECRET_OLD);
  rec.step(`git -C ${REPO} log --all -p | grep -c ${SECRET_OLD}`, String(oldInHistory), 'The old secret is still in git history. A fix in the code cannot remove it. That is why the secret was rotated.');

  // 4. What loop_control label does and does not do.
  const labelV = play(['-v', ...VAULT, `${PART}/label-only.yml`], (r) => `With only a label, -v shows the secret on ${countSecret(r.stdout, SECRET_NEW)} lines: the label changes the (item=...) text, and the item is still inside the result.`, { show: (t) => secretLines(t, SECRET_NEW) });
  const labelPlain = play([...VAULT, `${PART}/label-only.yml`], (r) => `Without -v, the same playbook shows the secret on ${countSecret(r.stdout, SECRET_NEW)} lines.`, { show: (t) => t.split(/\r?\n/).filter((l) => /^(TASK|changed|ok)/.test(l)).join('\n') });

  // 5. What no_log hides, and what it does not.
  const NL = `${PART}/what-no-log-hides.yml`;
  const diffRun = play(['--diff', '--skip-tags', 'error-text', ...VAULT, NL], 'With --diff, a copy task without no_log prints the file content it wrote. The one with no_log does not.', { show: (t) => t.split(/\r?\n/).filter((l) => /^(TASK|\+\+\+|\+DB|---|changed|ok)/.test(l)).join('\n') });
  const diffPerTask = scanOutput(diffRun.stdout, SECRET_NEW).perTask;
  const vRun = play(['-v', '--skip-tags', 'error-text', ...VAULT, NL], (r) => `With no_log and -v, ${countSecret(r.stdout, SECRET_NEW)} lines show the secret. The result says it was hidden.`, { show: (t) => t.split(/\r?\n/).filter((l) => /^(TASK|changed|ok|fatal)/.test(l)).join('\n') });
  const errRun = play(['--tags', 'error-text', ...VAULT, NL], (r) => `The task failed with no_log on. The result line is censored, but the [ERROR] block printed the secret on ${countSecret(r.stdout, SECRET_NEW)} lines.`, { show: (t) => secretLines(t, SECRET_NEW) });
  const dbgRun = play(['--skip-tags', 'error-text', ...VAULT, NL], (r) => `With ANSIBLE_DEBUG=1 the output has ${r.stdout.split('\n').length} lines and ${countSecret(r.stdout, SECRET_NEW)} of them show the secret, although every task that holds it has no_log: true or hides the content.`, { env: { ANSIBLE_DEBUG: '1' }, show: (t) => secretLines(t, SECRET_NEW, 4) });
  const v4Run = play(['-vvvv', '--skip-tags', 'error-text', ...VAULT, NL], (r) => `With -vvvv, ${countSecret(r.stdout, SECRET_NEW)} lines show the secret.`, { show: (t) => secretLines(t, SECRET_NEW, 4) });

  // 6. On the target the file is readable by design: the app has to read its password.
  const readRoot = execIn('web1', ['cat', '/etc/demo-app/hidden.conf']);
  rec.step('docker exec anp-web1 cat /etc/demo-app/hidden.conf', readRoot.stdout, 'The file that no_log kept out of the output is plain text on the target. That is by design: the app must read it.');
  const readOther = execIn('web1', ['cat', '/etc/demo-app/hidden.conf'], { user: 'nobody' });
  rec.step('docker exec --user nobody anp-web1 cat /etc/demo-app/hidden.conf', `${readOther.stdout}${readOther.stderr}`.trim(), 'Mode 0600 keeps other users out. The file mode is the protection on the target, not the vault and not no_log.');

  const facts = {
    'c6.p3.fixed_file': reference ? `${PART}/reference/fixed.yml` : `${PART}/fixed.yml`,
    'c6.p3.leaks_before': scanBefore.total,
    'c6.p3.leaks_after': scanAfter.total,
    'c6.p3.leaks_after_old_secret_in_output': oldInOutput,
    'c6.p3.old_secret_history_lines': oldInHistory,
    'c6.p3.debug_leak': countSecret(dbgRun.stdout, SECRET_NEW) > 0,
    'c6.p3.debug_leak_lines': countSecret(dbgRun.stdout, SECRET_NEW),
    'c6.p3.vvvv_leak_lines': countSecret(v4Run.stdout, SECRET_NEW),
    'c6.p3.error_text_leak_lines': countSecret(errRun.stdout, SECRET_NEW),
    'c6.p3.no_log_v_lines': countSecret(vRun.stdout, SECRET_NEW),
    'c6.p3.diff_lines_without_no_log': diffPerTask['Write a file without no_log'] ?? 0,
    'c6.p3.diff_lines_with_no_log': diffPerTask['Write a file with no_log'] ?? 0,
    'c6.p3.label_only_lines_v': countSecret(labelV.stdout, SECRET_NEW),
    'c6.p3.label_only_lines_plain': countSecret(labelPlain.stdout, SECRET_NEW),
    'c6.p3.target_file_has_secret': readRoot.stdout.includes(SECRET_NEW),
    'c6.p3.target_file_denied_other_user': readOther.code !== 0 && /Permission denied/.test(readOther.stdout + readOther.stderr),
    'c6.p3.fixed_run_changed_hosts': countLines(after.stdout, /changed=[1-9]/),
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  console.log(`\nBefore: ${facts['c6.p3.leaks_before']} leaks. After: ${facts['c6.p3.leaks_after']}.`);
  if (scanAfter.total > 0) {
    const left = Object.entries(scanAfter.parts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(', ');
    console.log(`Still leaking: ${left}. Look at the TODO comments in fixed.yml and at fixed-output.txt.`);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}. All secrets are fake.`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Lines that show the secret, before and after the fix',
        unit: 'lines',
        bars: [
          { label: 'before the fix', value: facts['c6.p3.leaks_before'] },
          { label: 'after the fix', value: facts['c6.p3.leaks_after'] },
          { label: 'error text, no_log on', value: facts['c6.p3.error_text_leak_lines'] },
          { label: 'ANSIBLE_DEBUG=1, no_log on', value: facts['c6.p3.debug_leak_lines'] },
          { label: 'old secret in git history', value: facts['c6.p3.old_secret_history_lines'] },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (reference) writeFileSync(fixedPath, originalFixed);
  cleanup(CHALLENGE);
}
