// Find learner starter files that are byte-identical to their reference answer.
// Run: node tools/starter_twins.mjs
//
// A starter holds a task with TODO lines. If a starter file is the same as the file in the part's
// reference/ folder, the learner already holds the solution and the test cannot fail first.
//
// How a twin is found: for every file under a folder named "reference", look in the same part for a
// file outside any reference/ folder that has the same relative path (reference/a/b.yml and a/b.yml).
// If there is none, use files with the same name anywhere in the part (reference/verify.yml and
// roles/webserver/molecule/default/verify.yml). Part folders are challenges/challenge-N-name/part-M-name.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Starter files that are legitimately equal to their reference twin: nothing in them is for the learner to
// write. Each entry is a path from the repository root and the reason. Add to this list only with a reason.
export const EXEMPT = {
  'challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/fix-me/files/nginx.conf':
    'a given file that is already correct. The learner fixes the role and the playbook, not this config file. The reference holds the whole fix-me tree, so it holds a copy.',
};

function walk(dir, out = [], insideReference = false) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out, insideReference || name === 'reference');
    else out.push({ path, insideReference });
  }
  return out;
}

function partFolders(root) {
  const parts = [];
  const challenges = join(root, 'challenges');
  if (!existsSync(challenges)) return parts;
  for (const c of readdirSync(challenges)) {
    const cdir = join(challenges, c);
    if (!statSync(cdir).isDirectory()) continue;
    for (const p of readdirSync(cdir)) {
      const pdir = join(cdir, p);
      if (statSync(pdir).isDirectory() && /^part-\d+/.test(p)) parts.push(pdir);
    }
  }
  return parts;
}

const same = (a, b) => readFileSync(a).equals(readFileSync(b));
const posix = (root, path) => relative(root, path).split(sep).join('/');

// Returns [{ reference, starter }] with paths from the repository root, for every identical pair.
export function findIdenticalTwins(root) {
  const found = [];
  for (const part of partFolders(root)) {
    const files = walk(part);
    const starters = files.filter((f) => !f.insideReference).map((f) => f.path);
    for (const ref of files.filter((f) => f.insideReference).map((f) => f.path)) {
      const refDir = join(part, 'reference');
      const rel = relative(refDir, ref);
      const samePath = join(part, rel);
      const twins = starters.includes(samePath) ? [samePath] : starters.filter((s) => basename(s) === basename(ref));
      for (const s of twins) if (same(ref, s)) found.push({ reference: posix(root, ref), starter: posix(root, s) });
    }
  }
  return found;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const twins = findIdenticalTwins(root);
  const bad = twins.filter((t) => !EXEMPT[t.starter]);
  for (const t of twins) console.log(`${EXEMPT[t.starter] ? 'exempt ' : 'FLAGGED'} ${t.starter}  ==  ${t.reference}`);
  if (!twins.length) console.log('No starter file is identical to its reference twin.');
  process.exit(bad.length ? 1 : 0);
}
