// Helpers shared by the four parts of challenge 10 (the capstone). Plain Node, no packages.
//
// The system you work on is capstone-stack/ (inventory, roles, playbooks, ci.mjs). Every part runs against YOUR files.
// Maintainers pass --reference (or set ANP_USE_REFERENCE=1) to run the same part against a scratch copy of the stack
// with the fixed files of every part's reference/ folder laid over it. The scratch copy is capstone-stack-reference/
// (next to capstone-stack, so ci.mjs finds the toolkit at the same relative path). It is git-ignored and removed afterwards.

import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { factsPath } from '../../toolkit/facts.js';

export const CHALLENGE = 10;
export const root = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(root, '..', '..');
export const starterDir = join(root, 'capstone-stack');
export const referenceDir = join(root, 'capstone-stack-reference');
export const PART_DIRS = ['part-1-configure', 'part-2-break-it', 'part-3-recover-it', 'part-4-defend-it'];
/** The password of the practice vault in the reference stack. It protects a made-up database password. */
export const PRACTICE_VAULT_PASSWORD = 'capstone-practice-vault-password';
export const HOSTS = ['web1', 'web2', 'db1'];

export const useReference = () => process.argv.includes('--reference') || process.env.ANP_USE_REFERENCE === '1';

/**
 * Open the stack to work on. Yours, or (with --reference) a scratch copy with every reference file laid over it.
 * Returns { dir, rel, ci } where ci is the module ci.mjs of that stack. Call closeStack(s) when you are done.
 */
export async function openStack() {
  let dir = starterDir;
  if (useReference()) {
    rmSync(referenceDir, { recursive: true, force: true });
    cpSync(starterDir, referenceDir, { recursive: true });
    for (const p of PART_DIRS) {
      const ref = join(root, p, 'reference', 'capstone-stack');
      if (existsSync(ref)) cpSync(ref, referenceDir, { recursive: true });
    }
    writeFileSync(join(referenceDir, '.vault-pass'), `${PRACTICE_VAULT_PASSWORD}\n`);
    dir = referenceDir;
  }
  const ci = await import(pathToFileURL(join(dir, 'ci.mjs')).href);
  return { dir, rel: relative(repoRoot, dir).split(sep).join('/'), ci, reference: dir === referenceDir };
}
export function closeStack(s) {
  if (s?.reference) rmSync(referenceDir, { recursive: true, force: true });
}

export const text = (s, file) => (existsSync(join(s.dir, file)) ? readFileSync(join(s.dir, file), 'utf8') : '');

/** Text that is not a comment: the learner's real lines. */
export const code = (s, file) => text(s, file).split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export function readFacts() {
  const file = factsPath();
  return existsSync(file) && readFileSync(file, 'utf8').trim() ? JSON.parse(readFileSync(file, 'utf8')) : {};
}
/** Remove every fact that starts with the prefix, so a run starts clean. */
export function clearFacts(prefix) {
  const all = readFacts();
  for (const k of Object.keys(all)) if (k.startsWith(prefix)) delete all[k];
  mkdirSync(dirname(factsPath()), { recursive: true });
  writeFileSync(factsPath(), `${JSON.stringify(all, null, 2)}\n`);
}
/** Save many facts in one write (the toolkit's setFact writes one at a time). */
export function saveFacts(facts) {
  const all = readFacts();
  Object.assign(all, facts);
  const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  mkdirSync(dirname(factsPath()), { recursive: true });
  writeFileSync(factsPath(), `${JSON.stringify(sorted, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Keep the first and last lines of long output, and say what was left out. */
export function clip(output, maxLines = 40) {
  const lines = output.trimEnd().split(/\r?\n/);
  if (lines.length <= maxLines) return lines.join('\n');
  const head = Math.ceil(maxLines / 2);
  const tail = maxLines - head;
  return [...lines.slice(0, head), `... (${lines.length - maxLines} lines left out) ...`, ...lines.slice(-tail)].join('\n');
}

/** The lines of an ansible-playbook run that matter: the task headers that failed, the failures, and the recap. */
export function digest(output) {
  const lines = output.split(/\r?\n/);
  const keep = [];
  let task = '';
  for (const l of lines) {
    if (/^(PLAY|TASK|RUNNING HANDLER) \[/.test(l)) task = l;
    if (/^(fatal|FAILED|failed|changed|ok|skipping):/.test(l) && /^(fatal|changed)/.test(l)) keep.push(`${task}\n${l}`);
    else if (/^\[(ERROR|WARNING)\]/.test(l) || /^PLAY RECAP/.test(l) || /^\S+\s+: ok=/.test(l)) keep.push(l);
  }
  return keep.join('\n');
}

/** Which hosts ran in each batch of a serial play: the hosts that printed a result before the next "PLAY [name]" line. */
export function batches(output, playName) {
  const out = [];
  let current = null;
  for (const l of output.split(/\r?\n/)) {
    const play = /^PLAY \[(.*?)\] \*+$/.exec(l);
    if (play) {
      current = play[1] === playName ? new Set() : null;
      if (current) out.push(current);
      continue;
    }
    const r = /^(?:ok|changed|fatal|skipping|failed): \[([^\]]+)\]/.exec(l);
    if (r && current) current.add(r[1]);
  }
  return out.map((s) => [...s]);
}

/** Every text file of the stack (not collections, caches, or the vault files), for a plain-text search. */
export function stackFiles(dir) {
  const skip = new Set(['collections', '.cache', 'node_modules', '.git', '.vault-pass']);
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (skip.has(name)) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------------------
// Secrets and pins: the facts the secrets and pin criteria read
// ---------------------------------------------------------------------------

/** The values stored in the vault file (decrypted with the vault password). Short values are ignored. */
export function readSecrets(s) {
  const file = join(s.dir, 'group_vars', 'all', 'vault.yml');
  if (!existsSync(file)) return [];
  const r = s.ci.play(['ansible-vault', 'view', `${s.rel}/group_vars/all/vault.yml`], {}, { merge: false });
  if (r.code !== 0) return [];
  return [...r.stdout.matchAll(/^\s*[A-Za-z_][\w]*:\s*["']?(.+?)["']?\s*$/gm)].map((m) => m[1]).filter((v) => v.length >= 8);
}

/** How many times any of the values appears in the text. */
export const occurrences = (haystack, values) => values.reduce((n, v) => n + haystack.split(v).length - 1, 0);

export function vaultFacts(s, outputs) {
  const file = join(s.dir, 'group_vars', 'all', 'vault.yml');
  const secrets = readSecrets(s);
  const encrypted = existsSync(file) && readFileSync(file, 'utf8').startsWith('$ANSIBLE_VAULT;');
  let inFiles = 0;
  for (const f of stackFiles(s.dir)) {
    if (f === file) continue;
    try {
      inFiles += occurrences(readFileSync(f, 'utf8'), secrets);
    } catch {
      /* not text */
    }
  }
  const ignored = spawnSync('git', ['check-ignore', '-q', `${s.rel}/.vault-pass`], { cwd: repoRoot }).status === 0;
  return {
    vault_encrypted: encrypted,
    vault_secrets_count: secrets.length,
    secret_in_files_count: secrets.length ? inFiles : 99,
    secret_in_output_count: secrets.length ? occurrences(outputs, secrets) : 99,
    vault_pass_ignored: ignored,
  };
}

/** requirements.yml: every collection has one exact version (1.2.3), and the roles use a module from it. */
export function pinFacts(s) {
  const req = text(s, 'requirements.yml');
  const versions = [...req.matchAll(/^\s*version:\s*"?([^"\s#]+)"?/gm)].map((m) => m[1]);
  const names = [...req.matchAll(/^\s*-?\s*name:\s*(\S+)/gm)].map((m) => m[1]);
  const exact = versions.length > 0 && versions.length === names.length && versions.every((v) => /^\d+\.\d+\.\d+$/.test(v));
  let used = 0;
  for (const f of stackFiles(join(s.dir, 'roles'))) {
    const t = readFileSync(f, 'utf8');
    for (const n of names) used += t.split(`${n}.`).length - 1;
  }
  return { collection_pinned: exact, collection_count: names.length, collection_used_count: used };
}

/**
 * A --reference run works in capstone-stack-reference/, but results.md must show the paths a learner types.
 * Call once after creating the Recorder: every step is written with capstone-stack in place of capstone-stack-reference.
 */
export function showLearnerPaths(rec) {
  const step = rec.step.bind(rec);
  const fix = (s) => String(s).replaceAll('capstone-stack-reference', 'capstone-stack');
  rec.step = (command, output, note) => step(fix(command), fix(output), fix(note));
  return rec;
}

/** Part 1 comes first. Say so before a fleet is started, if a role still holds only the TODO comments. */
export function assertRoles(s) {
  for (const role of ['web', 'app', 'db']) {
    if (code(s, `roles/${role}/tasks/main.yml`).replace(/---/g, '').trim() === '') {
      throw new Error(`Part 1 comes first: roles/${role}/tasks/main.yml has no tasks yet. Write the roles, make part 1 pass, then come back.`);
    }
  }
}
