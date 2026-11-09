// Helpers shared by the three parts of challenge 6 (find the leak).
//
// Every secret in this challenge is FAKE and says so. The vault password is a throwaway:
// the first part makes one random password in a git-ignored file called .vault-pass, and all parts use it.
//
// Why the password is copied into the container:
//   Docker Desktop shows every file of a Windows folder as executable inside a container. Ansible runs
//   an executable password file as a program, and fails with "Exec format error". So the password is
//   copied to the container's own home folder with mode 600, and the commands read it from there.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ansible } from '../../toolkit/ansible.mjs';
import { ALL_TARGETS, controlExec, execIn } from '../../toolkit/fleet.mjs';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The fake secrets. The second one is what the secret is rotated to in part 3. */
export const SECRET_OLD = 'demo-secret-not-real-0001';
export const SECRET_NEW = 'demo-secret-not-real-0002';

/** Where the password lives inside the control container. */
export const CONTAINER_PASS = '/home/learner/.vault-pass';

/** The folder of a part as the control container sees it, for example challenges/challenge-6-find-the-leak/part-1-vault. */
export const partRel = (dir) => relative(repoRoot, dir).split('\\').join('/');

/** The throwaway password file, shared by the three parts. Git ignores it (.vault-pass is in .gitignore). */
export const PASSWORD_FILE = join(dirname(fileURLToPath(import.meta.url)), '.vault-pass');

/** Copy .vault-pass into the container with mode 600. The file must exist. */
export function installPassword() {
  const r = controlExec(['install', '-m', '600', `/work/${partRel(dirname(PASSWORD_FILE))}/.vault-pass`, CONTAINER_PASS]);
  if (r.code !== 0) throw new Error(`Could not copy the password into the control container. Is the fleet running? node toolkit/fleet.mjs up
${r.stderr}`);
}

/** Make .vault-pass if it is not there (a random throwaway), then copy it into the container. */
export function makePassword() {
  let made = false;
  if (!existsSync(PASSWORD_FILE)) {
    writeFileSync(PASSWORD_FILE, `throwaway-${randomBytes(12).toString('hex')}
`);
    made = true;
  }
  installPassword();
  return { file: PASSWORD_FILE, made };
}

/** Encrypt text into a vault file (path inside the repository) with the container's password. Nothing plain touches the disk. */
export function vaultEncryptText(text, destRel) {
  const r = ansible(['ansible-vault', 'encrypt', '--vault-password-file', CONTAINER_PASS, '--output', destRel, '-'], { interactive: true, input: text });
  if (r.code !== 0) throw new Error(`ansible-vault encrypt failed:\n${r.stdout}`);
}

/** The body of the fake secrets file. */
export const secretsYaml = (secret) => `# FAKE value for the course. It is not a real secret.\ndb_password: ${secret}\n`;

export const isVaultText = (text) => text.startsWith('$ANSIBLE_VAULT;');

export function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

// ---------------------------------------------------------------------------------------------
// The scanner: where does the secret show up?
// ---------------------------------------------------------------------------------------------

/**
 * Each place is the task whose name matches. The playbooks name their tasks the same way,
 * so before and after can be compared place by place.
 */
export const PLACES = [
  { key: 'debug', label: 'a debug task', task: /Show the database password/ },
  { key: 'loop', label: 'a loop item', task: /Create the service accounts/ },
  { key: 'registered', label: 'a registered result under -v', task: /Read the config back/ },
];

/** Count the lines of a playbook run that show the secret, per task, then per place. */
export function scanOutput(text, secret) {
  const perTask = {};
  let task = '(before the first task)';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^TASK \[(.*?)\]/);
    if (m) task = m[1];
    if (line.includes(secret)) perTask[task] = (perTask[task] ?? 0) + 1;
  }
  const places = Object.fromEntries(PLACES.map((p) => [p.key, 0]));
  places.other = 0;
  for (const [name, n] of Object.entries(perTask)) {
    const place = PLACES.find((p) => p.task.test(name));
    places[place ? place.key : 'other'] += n;
  }
  return { places, perTask };
}

/** Lines of `ps -eo args` on the web hosts that show the secret. A command line is visible to every user on the host. */
export function scanProcesses(secret, hosts = ['web1', 'web2']) {
  let n = 0;
  const lines = [];
  for (const h of hosts) {
    const r = execIn(h, ['ps', '-eo', 'args']);
    for (const l of r.stdout.split(/\r?\n/)) {
      if (l.includes(secret)) {
        n += 1;
        lines.push(`${h}: ${l.trim()}`);
      }
    }
  }
  return { count: n, lines };
}

/**
 * The secret in a git repository: files in the working tree that contain it, and lines of `git log --all -p` that show it
 * (one line where it was added, one where it was removed).
 * Run in the control container (git is installed there).
 */
export function scanRepo(dirRel, secret) {
  if (!existsSync(join(repoRoot, dirRel, '.git'))) return { worktree: 0, history: 0, commits: [] };
  const script = [
    'cd "/work/$1" || exit 2',
    'wt=$(grep -rIlF --exclude-dir=.git -e "$2" . | wc -l)',
    'hist=$(git log --all -p | grep -cF -e "$2" || true)',
    'list=$(git log --all -S"$2" --format=%h:%s | tr " " "_" | tr "\\n" " ")',
    'echo "$wt $hist $list"',
  ].join('\n');
  const r = controlExec(['sh', '-c', script, 'sh', dirRel, secret]);
  const [wt, hist, ...commits] = r.stdout.trim().split(/\s+/);
  return { worktree: Number(wt) || 0, history: Number(hist) || 0, commits };
}

/** All of it: output, processes on the targets, repository. */
export function scanAll({ output, secret, repoRel, hosts }) {
  const out = scanOutput(output, secret);
  const ps = scanProcesses(secret, hosts);
  const repo = scanRepo(repoRel, secret);
  const parts = { ...out.places, ps: ps.count, git_worktree: repo.worktree, git_history: repo.history };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, total, perTask: out.perTask, psLines: ps.lines, commits: repo.commits };
}

/** A small text table of a scan, for the terminal and for results.md. */
export function scanTable(scan, secret) {
  const label = { debug: 'debug task', loop: 'loop item', registered: 'registered result (-v)', other: 'any other task', ps: 'process list on the targets', git_worktree: 'files in the repository now', git_history: 'lines in git history (log -p)' };
  const rows = Object.entries(scan.parts).map(([k, v]) => `${String(v).padStart(3)}  ${label[k] ?? k}`);
  return [`Searched for: ${secret}`, ...rows, `${String(scan.total).padStart(3)}  TOTAL`].join('\n');
}

/**
 * Build a small throwaway project with a git history, inside the part folder (git-ignored).
 * Commit 1 adds settings.env with the secret. Commit 2 deletes it. The secret is gone from the files and still in the history.
 */
export function buildHistoryRepo(dirRel, secret) {
  const script = String.raw`
set -e
rm -rf "/work/$1"
mkdir -p "/work/$1"
cd "/work/$1"
git init -q -b main
git config user.name "Demo Developer"
git config user.email "dev@example.invalid"
printf 'APP_HOST=web1\n' > app.env
git add app.env
git commit -q -m "Add app.env"
printf 'APP_HOST=web1\n# FAKE value for the course\nDB_PASSWORD=%s\n' "$2" > settings.env
git add settings.env
git commit -q -m "Add settings.env for the db"
git rm -q settings.env
printf 'The database password now comes from the vault.\n' > NOTES.txt
git add NOTES.txt
git commit -q -m "Remove settings.env, use the vault"
`;
  const r = controlExec(['sh', '-c', script, 'sh', dirRel, secret]);
  if (r.code !== 0) throw new Error(`Could not build the demo repository:\n${r.stdout}${r.stderr}`);
}

export { ALL_TARGETS, mkdirSync };
