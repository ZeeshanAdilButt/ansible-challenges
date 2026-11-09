// Search for a secret: in a saved playbook run, in the process lists of the targets, in a git repository.
//
//   node challenges/challenge-6-find-the-leak/scan.mjs <output-file> <repo-folder> [secret]
//
// The secret is the fake demo-secret-not-real-0001 unless you pass another one.
// It prints how many lines show the secret, per place. Run it after a playbook run saved its output.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SECRET_OLD, partRel, repoRoot, scanAll, scanTable } from './shared.mjs';

const [outFile, repoDir, secret = SECRET_OLD] = process.argv.slice(2);
if (!outFile || !repoDir) {
  console.error('Usage: node challenges/challenge-6-find-the-leak/scan.mjs <output-file> <repo-folder> [secret]');
  process.exit(2);
}
if (!existsSync(outFile)) {
  console.error(`No file ${outFile}. Run the playbook first and save its output.`);
  process.exit(1);
}
const repoRel = partRel(resolve(repoRoot, repoDir));
const scan = scanAll({ output: readFileSync(outFile, 'utf8'), secret, repoRel });
console.log(scanTable(scan, secret));
if (scan.psLines.length) console.log(`\nProcess list lines:\n${scan.psLines.join('\n')}`);
