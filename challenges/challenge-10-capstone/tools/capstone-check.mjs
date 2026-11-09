// The capstone check, headless: for CI and for you. It runs the four parts one after the other, then the rubric,
// and exits 0 only if EVERY automated criterion passes (70 of the 70 automated points).
//
//   node challenges/challenge-10-capstone/tools/capstone-check.mjs               run parts 1 to 3, read DEFENCE.md, score
//   node challenges/challenge-10-capstone/tools/capstone-check.mjs --skip-run    only read the saved facts and score
//   node challenges/challenge-10-capstone/tools/capstone-check.mjs --reference   use the reference files (maintainers)
//
// The workflow .github/workflows/capstone.yml builds the fleet on a CI runner and runs exactly this command on the tag capstone-1.
// Needs the fleet images (the first part builds them if they are missing), Docker, and Node 22 or newer. About 12 minutes on a quiet machine (11 minutes 21 seconds with the reference files here), longer when other work uses Docker.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { score } from '../rubric.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const skipRun = args.includes('--skip-run');
const pass = args.filter((a) => a === '--reference');
const PARTS = ['part-1-configure', 'part-2-break-it', 'part-3-recover-it', 'part-4-defend-it'];

if (!skipRun) {
  for (const part of PARTS) {
    console.log(`\n=== ${part} ===`);
    const r = spawnSync(process.execPath, [join(root, part, 'run.mjs'), ...pass], { stdio: 'inherit', env: process.env });
    if (r.status !== 0) {
      console.error(`\nThe capstone check stopped: ${part}/run.mjs exited with ${r.status}. Fix that part first.`);
      process.exit(1);
    }
  }
}

const s = score();
console.log('\n=== The rubric ===');
for (const r of s.rows) {
  const mark = r.mentor ? 'mentor' : r.status === 'pass' ? 'pass' : r.status === 'fail' ? 'FAIL' : 'NOT RUN';
  console.log(`${mark.padEnd(7)} ${String(r.points).padStart(2)}  ${r.id.padEnd(15)} ${r.title}${r.status === 'fail' || r.status === 'not run' ? `\n           -> ${r.detail}` : ''}`);
}
console.log(`\nAutomated: ${s.earned} of ${s.available} points (${s.percent} %). The mentor scores another ${s.mentorPoints}.`);
if (s.failing.length) {
  console.error(`${s.failing.length} automated criteria did not pass: ${s.failing.map((r) => r.id).join(', ')}`);
  process.exit(1);
}
console.log('Every automated criterion passed.');
