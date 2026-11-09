// Challenge 6, part 1: the vault.
// Run: node challenges/challenge-6-find-the-leak/part-1-vault/run.mjs
// First time only: node challenges/challenge-6-find-the-leak/part-1-vault/run.mjs --make-password
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to encrypt vars/secrets.yml for you (for maintainers; the plain file is put back afterwards).

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset, controlExec, execIn } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';
import { CONTAINER_PASS, SECRET_OLD, isVaultText, makePassword, partRel, vaultEncryptText } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 6, part 1: the vault');
const CHALLENGE = 6;
const PART = partRel(here);
const VARS = `${PART}/vars/secrets.yml`;
const VAULT = ['--vault-password-file', CONTAINER_PASS];
const varsFile = join(here, 'vars', 'secrets.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (process.argv.includes('--make-password')) {
  try {
    const { file, made } = makePassword();
    console.log(made ? `Made a throwaway vault password in ${file} (git ignores it) and copied it into the control container.` : `${file} already exists. Copied it into the control container again.`);
    console.log(`Inside the container the password file is ${CONTAINER_PASS}.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
}

const quote = (a) => (/[\s:&!*"$;]/.test(a) ? `'${a}'` : a);
function step(argv, note, { env, show, opts } = {}) {
  const r = ansible(argv, { env, ...opts });
  const prefix = env ? `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ')} ` : '';
  rec.step(`${prefix}node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`, show ? show(r.stdout) : compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}

const plainBefore = readFileSync(varsFile, 'utf8');
try {
  cleanup(CHALLENGE);
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  makePassword();
  if (reference) vaultEncryptText(plainBefore, VARS);

  const text = readFileSync(varsFile, 'utf8');
  if (!isVaultText(text)) {
    throw new Error(`${PART}/vars/secrets.yml is still plain text. Encrypt it first:\n  node toolkit/ansible.mjs ansible-vault encrypt --vault-password-file ${CONTAINER_PASS} ${VARS}\n(If the password is missing: node challenges/challenge-6-find-the-leak/part-1-vault/run.mjs --make-password)`);
  }

  // 1. One value at a time: encrypt_string.
  const es = step(['ansible-vault', 'encrypt_string', ...VAULT, SECRET_OLD, '--name', 'api_token'], 'encrypt_string turns one value into a block you can paste into any vars file. The first line says it is a vault.', {});
  const header = (es.stdout.match(/\$ANSIBLE_VAULT;[0-9.]+;[A-Z0-9]+/) || [])[0];

  // 2. Your encrypted file: what is on disk.
  const head = controlExec(['sh', '-c', `head -n 3 ${VARS}`]);
  const plainHits = Number(controlExec(['sh', '-c', `grep -c -F ${SECRET_OLD} ${VARS} || true`]).stdout.trim());
  rec.step(`head -n 3 ${VARS}`, head.stdout, `The file on disk starts with the vault header, then hex. The secret appears in it ${plainHits} times.`);

  // 3. view
  const view = step(['ansible-vault', 'view', ...VAULT, VARS], 'view decrypts to the screen. Nothing is written to disk.');

  // 4. edit, on a copy in the container, with a scripted editor (sed) so the run needs no keyboard.
  controlExec(['cp', `/work/${VARS}`, '/tmp/edit-demo.yml']);
  const noEditor = ansible(['ansible-vault', 'edit', ...VAULT, '/tmp/edit-demo.yml']);
  rec.step(`node toolkit/ansible.mjs ansible-vault edit ${VAULT.join(' ')} /tmp/edit-demo.yml`, noEditor.stdout, 'edit needs an editor. The control image has none (vi, nano and vim are not installed), so edit fails.');
  const editor = `sed -i s/${SECRET_OLD}/demo-secret-not-real-0002/`;
  const edit = ansible(['ansible-vault', 'edit', ...VAULT, '/tmp/edit-demo.yml'], { env: { EDITOR: editor } });
  rec.step(`docker exec -w /work -e "EDITOR=${editor}" anp-control ansible-vault edit ${VAULT.join(' ')} /tmp/edit-demo.yml`, edit.stdout, 'With EDITOR set to a sed command, edit decrypts to a temporary file, runs the editor on it and encrypts the result again. It printed nothing.');
  const viewEdit = step(['ansible-vault', 'view', ...VAULT, '/tmp/edit-demo.yml'], 'The copy now holds the changed value. Your real file was not touched.');
  const editWorked = noEditor.code !== 0 && edit.code === 0 && viewEdit.stdout.includes('demo-secret-not-real-0002');

  // 5. run with the password file.
  const run1 = step(['ansible-playbook', ...VAULT, `${PART}/site.yml`], (r) => `Run with the password file: ${countLines(r.stdout, /changed=[1-9]/)} hosts changed, ${countLines(r.stdout, /failed=[1-9]/)} failed.`);
  const run2 = step(['ansible-playbook', ...VAULT, `${PART}/site.yml`], (r) => `The second run changed ${countLines(r.stdout, /changed=[1-9]/)} hosts: the vault does not break idempotence.`);
  const mode = execIn('web1', ['stat', '-c', '%a %U', '/etc/demo-app/app.conf']);
  rec.step('docker exec anp-web1 stat -c "%a %U" /etc/demo-app/app.conf', mode.stdout, 'The password reached the target in a file only root can read (mode 600).');

  // 6. the wrong password, and no password.
  controlExec(['sh', '-c', 'printf "this-is-the-wrong-password\\n" > /tmp/wrong-pass && chmod 600 /tmp/wrong-pass']);
  const wrong = step(['ansible-playbook', '--vault-password-file', '/tmp/wrong-pass', `${PART}/site.yml`], (r) => `Exit code ${r.code}. Ansible stopped before it touched a host.`);
  const none = step(['ansible-playbook', `${PART}/site.yml`], (r) => `Without any password: exit code ${r.code}.`);
  const wrongOk = wrong.code !== 0 && /Decryption failed/.test(wrong.stdout) && countLines(wrong.stdout, /^TASK/) === 0;

  // 7. git: what a change to a vaulted file looks like in a diff.
  const gitScript = String.raw`
set -e
rm -rf /tmp/vault-git-demo && mkdir /tmp/vault-git-demo && cd /tmp/vault-git-demo
git init -q -b main
git config user.name "Demo Developer"; git config user.email "dev@example.invalid"
cp "/work/$1" vaulted.yml
printf '# FAKE value for the course\ndb_password: %s\n' "$2" > plain.yml
git add . && git commit -q -m "add both files"
EDITOR="sed -i s/$2/demo-secret-not-real-0002/" ansible-vault edit --vault-password-file "$3" vaulted.yml
sed -i "s/$2/demo-secret-not-real-0002/" plain.yml
git diff --stat
echo
echo "---- git diff plain.yml"
git diff plain.yml
echo "---- git diff vaulted.yml"
git diff vaulted.yml
`;
  const gitDemo = controlExec(['sh', '-c', gitScript, 'sh', VARS, SECRET_OLD, CONTAINER_PASS]);
  if (gitDemo.code !== 0) throw new Error(`The git demo failed:\n${gitDemo.stdout}${gitDemo.stderr}`);
  const vaultedDiff = gitDemo.stdout.split('---- git diff vaulted.yml')[1] ?? '';
  const plainDiff = gitDemo.stdout.split('---- git diff plain.yml')[1]?.split('---- git diff vaulted.yml')[0] ?? '';
  // Count what a learner counts: every removed and added line after the first @@ line, with the short last line of each block.
  // git diff --stat prints the same number for this file (9 removed and 9 added is 18).
  const vaultDiffLines = vaultedDiff.split('\n');
  const vaultChangedLines = vaultDiffLines.slice(vaultDiffLines.findIndex((l) => l.startsWith('@@')) + 1).filter((l) => /^[-+]/.test(l)).length;
  rec.step('git diff   (in a demo repository: the same change to a plain file and to a vaulted file)', gitDemo.stdout.replace(/\n+$/, ''), 'A plain file shows the old and the new secret in the diff. A vaulted file shows hex that changed from top to bottom. Nobody can review the change, but nobody can read it either.');
  controlExec(['rm', '-rf', '/tmp/vault-git-demo', '/tmp/edit-demo.yml', '/tmp/wrong-pass']);

  const facts = {
    'c6.p1.vars_file': reference ? `${PART}/reference/secrets.yml` : VARS,
    'c6.p1.header': header,
    'c6.p1.run_ok': run1.code === 0,
    'c6.p1.changed_first': countLines(run1.stdout, /changed=[1-9]/),
    'c6.p1.changed_second': countLines(run2.stdout, /changed=[1-9]/),
    'c6.p1.wrong_password_error': wrongOk,
    'c6.p1.no_password_exit_code': none.code,
    'c6.p1.plain_hits_in_vault_file': plainHits,
    'c6.p1.view_shows_secret': view.stdout.includes(SECRET_OLD),
    'c6.p1.edit_worked': editWorked,
    'c6.p1.edit_without_editor_fails': noEditor.code !== 0 && /Unable to execute the command/.test(noEditor.stdout),
    'c6.p1.target_file_mode': mode.stdout.trim().split(' ')[0],
    'c6.p1.diff_plain_shows_secret': plainDiff.includes(SECRET_OLD),
    'c6.p1.diff_vault_shows_secret': vaultedDiff.includes(SECRET_OLD),
    'c6.p1.diff_vault_changed_lines': vaultChangedLines,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}. All secrets are fake.`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Hosts changed by the vaulted run, and times the secret shows in the vault file',
        unit: 'count',
        bars: [
          { label: 'hosts changed, run 1', value: facts['c6.p1.changed_first'] },
          { label: 'hosts changed, run 2', value: facts['c6.p1.changed_second'] },
          { label: 'secret in vault file', value: facts['c6.p1.plain_hits_in_vault_file'] },
          { label: 'secret in plain diff', value: facts['c6.p1.diff_plain_shows_secret'] ? 1 : 0 },
          { label: 'secret in vault diff', value: facts['c6.p1.diff_vault_shows_secret'] ? 1 : 0 },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (reference) {
    // Keep the encrypted copy in reference/ (the test reads it) and put the plain starter file back.
    mkdirSync(join(here, 'reference'), { recursive: true });
    if (isVaultText(readFileSync(varsFile, 'utf8'))) copyFileSync(varsFile, join(here, 'reference', 'secrets.yml'));
    writeFileSync(varsFile, plainBefore);
  }
  cleanup(CHALLENGE);
}
