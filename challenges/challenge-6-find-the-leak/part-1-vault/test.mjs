// Challenge 6, part 1 test.
// Run: node --test challenges/challenge-6-find-the-leak/part-1-vault/test.mjs
// It fails until you have encrypted vars/secrets.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning, execIn } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { CONTAINER_PASS, PASSWORD_FILE, SECRET_OLD, installPassword, repoRoot } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-6-find-the-leak/part-1-vault';
const hint = `Run: node ${PART}/run.mjs`;
// A maintainer run with --reference records which file it used.
const varsRel = getFact('c6.p1.vars_file') ?? `${PART}/vars/secrets.yml`;

test('vars/secrets.yml is a vault: it starts with the vault header and does not hold the secret in plain text', () => {
  const text = readFileSync(join(repoRoot, varsRel), 'utf8');
  assert.ok(text.startsWith('$ANSIBLE_VAULT;'), `${varsRel} is still plain text. Encrypt it:\n  node toolkit/ansible.mjs ansible-vault encrypt --vault-password-file ${CONTAINER_PASS} ${varsRel}\n(No password yet? node ${PART}/run.mjs --make-password)`);
  assert.ok(!text.includes(SECRET_OLD), 'The secret is still in the file in plain text.');
});

test('the vault password file exists and is not tracked by git', () => {
  assert.ok(existsSync(PASSWORD_FILE), `No .vault-pass in challenges/challenge-6-find-the-leak/. Run: node ${PART}/run.mjs --make-password`);
  assert.match(readFileSync(join(repoRoot, '.gitignore'), 'utf8'), /^\.vault-pass$/m, '.vault-pass must be in .gitignore');
});

test('the vault opens with the password in the control container', () => {
  installPassword();
  const r = ansible(['ansible-vault', 'view', '--vault-password-file', CONTAINER_PASS, varsRel], { merge: false });
  assert.equal(r.code, 0, `ansible-vault view failed. Is the fleet running, and was run.mjs started once? ${hint}\n${r.stderr}`);
  assert.match(r.stdout, /db_password: demo-secret-not-real-0001/);
});

test('run.mjs saved the vault facts', () => {
  assert.equal(getFact('c6.p1.header'), '$ANSIBLE_VAULT;1.1;AES256', `c6.p1.header is missing or wrong. ${hint}`);
  assert.equal(getFact('c6.p1.run_ok'), true, `The playbook run with the password file did not succeed. ${hint}`);
  assert.equal(getFact('c6.p1.changed_first'), 2, `The first run should change web1 and web2. ${hint}`);
  assert.equal(getFact('c6.p1.changed_second'), 0, `The second run should change nothing. ${hint}`);
  assert.equal(getFact('c6.p1.wrong_password_error'), true, `The wrong password should stop the run with "Decryption failed". ${hint}`);
  assert.equal(getFact('c6.p1.plain_hits_in_vault_file'), 0, `The vault file must not show the secret. ${hint}`);
  assert.equal(getFact('c6.p1.edit_worked'), true, `The ansible-vault edit step did not work. ${hint}`);
});

test('a vaulted file shows no secret in git diff, a plain file does', () => {
  assert.equal(getFact('c6.p1.diff_plain_shows_secret'), true);
  assert.equal(getFact('c6.p1.diff_vault_shows_secret'), false);
});

test('the config file on web1 and web2 is mode 600', () => {
  for (const host of ['web1', 'web2']) {
    const r = execIn(host, ['stat', '-c', '%a', '/etc/demo-app/app.conf']);
    assert.equal(r.stdout.trim(), '600', `${host}: /etc/demo-app/app.conf should be mode 600. This part leaves that file on the fleet; another part's run, or fleet reset, removes it. ${hint}`);
  }
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(6), { containers: 0, networks: 0, volumes: 0 });
});

test('the README links the safety rules', () => {
  assert.match(readFileSync(join(here, 'README.md'), 'utf8'), /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
});

test('results.md and chart.svg exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  const svg = readFileSync(join(here, 'chart.svg'), 'utf8');
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">/);
  assert.match(svg, /<desc id="d">/);
});
