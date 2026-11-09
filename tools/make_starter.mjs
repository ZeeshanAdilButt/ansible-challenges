// Make the learner starter from the reference tree.
// Run: node tools/make_starter.mjs <target folder>
//
// It copies everything except:
//   - every folder named "reference" (fixed answers and solutions)
//   - every file named NOTES.md and RUBRIC-FOR-MENTORS.md (notes for the people who write and review the course)
//   - facts.json (numbers from the reference machine)
//   - keys/ and collections/ at the top (your own practice key, installed collections)
//   - every .vault-pass (a vault password) and every capstone-stack-reference folder (a maintainer's scratch copy)
//   - .git and node_modules
// The target must not exist, or must be empty. Nothing in the source is changed.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ANP_SOURCE_ROOT lets the test use a small fake tree.
const root = resolve(process.env.ANP_SOURCE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..'));
const targetArg = process.argv[2];

if (!targetArg) {
  console.error('Usage: node tools/make_starter.mjs <target folder>');
  process.exit(2);
}

const target = resolve(targetArg);
if (target === root || target.startsWith(root + sep) || root.startsWith(target + sep)) {
  console.error(`The target must be outside the reference tree and must not contain it: ${target}`);
  process.exit(2);
}
if (existsSync(target) && (!statSync(target).isDirectory() || readdirSync(target).length > 0)) {
  console.error(`The target exists and is not empty: ${target}. Use a new or empty folder.`);
  process.exit(2);
}

// .vault-pass and capstone-stack-reference (a maintainer's scratch copy of the capstone, challenge 10) are left out wherever they are.
const SKIP_NAMES = new Set(['reference', '.git', 'node_modules', 'NOTES.md', 'RUBRIC-FOR-MENTORS.md', '.vault-pass', 'capstone-stack-reference']);
const SKIP_AT_ROOT = new Set(['facts.json', 'keys', 'collections', '.vault-pass']);
const skipped = [];
let copied = 0;

function skip(path) {
  const rel = relative(root, path);
  if (rel === '') return false;
  const name = basename(path);
  if (SKIP_NAMES.has(name) || SKIP_AT_ROOT.has(rel)) {
    skipped.push(rel.split(sep).join('/'));
    return true;
  }
  return false;
}

mkdirSync(target, { recursive: true });
cpSync(root, target, {
  recursive: true,
  filter: (src) => {
    if (skip(src)) return false;
    if (statSync(src).isFile()) copied += 1;
    return true;
  },
});

console.log(`Starter written to ${target}`);
console.log(`Files copied: ${copied}`);
console.log(`Left out (${skipped.length}): ${skipped.length ? skipped.join(', ') : 'nothing'}`);
