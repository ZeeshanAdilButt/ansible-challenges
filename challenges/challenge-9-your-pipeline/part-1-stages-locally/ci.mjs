// ci.mjs: your pipeline, run on your own machine.
//
// It runs six stages in order and stops at the first one that fails:
//   lint  ->  syntax-check  ->  molecule  ->  check-mode  ->  apply  ->  second-run
//
// Run it from the root folder of the repository:
//   node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs
//   node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --playbook broken-site.yml
//   node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --inventory inventory/production.ini
//
// Options (all optional):
//   --playbook <file>    the playbook, relative to this folder (default site.yml)
//   --inventory <file>   the inventory, relative to this folder (default inventory/practice.ini)
//   --profile <name>     the ansible-lint profile (default production)
//   --only <stage>       run just one stage
//
// The exit code is 0 when every stage passed, 1 when a stage failed.
// The fleet must be running (node toolkit/fleet.mjs up) for the last three stages.

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ansible, countLines } from '../../../toolkit/ansible.mjs';
import { root } from '../../../toolkit/fleet.mjs';
import { installCollections, moleculeDown, moleculeExec, moleculeUp } from '../../../toolkit/molecule.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/** The folder of this part as the control container sees it (the repository is mounted at /work). */
export const PART = relative(root, here).split(/[\\/]/).join('/');
export const STAGES = ['lint', 'syntax-check', 'molecule', 'check-mode', 'apply', 'second-run'];

const CHALLENGE = 9;
const ROLE_DIR = `${PART}/roles/banner`; // the role with the Molecule scenario, a folder in the repository
const sinceStart = (t0) => Number(process.hrtime.bigint() - t0) / 1e9;

/**
 * Run one stage. Returns { ok, output, detail }.
 * detail is one short line saying what the stage found.
 */
async function runStage(stage, { playbook, inventory, profile }) {
  const inPart = { cwd: PART };
  if (stage === 'lint') {
    const r = ansible(['ansible-lint', '--profile', profile, playbook], inPart);
    return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? `ansible-lint passed the "${profile}" profile` : `ansible-lint found problems (exit code ${r.code})` };
  }
  if (stage === 'syntax-check') {
    const r = ansible(['ansible-playbook', '-i', inventory, '--syntax-check', playbook], inPart);
    return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? 'the playbook parses' : `syntax check failed (exit code ${r.code})` };
  }
  if (stage === 'molecule') {
    // The Molecule container is the one in this course (with challenge 7) that gets the Docker socket. It is the same
    // container and the same method as in challenge 7: toolkit/molecule.mjs. It runs as a normal user, not root.
    // It is started for this stage and removed when the stage ends, so nothing with the socket stays running.
    let r;
    try {
      await moleculeUp(CHALLENGE);
      installCollections(CHALLENGE);
      r = moleculeExec(CHALLENGE, ['molecule', 'test'], { cwd: ROLE_DIR, timeoutMs: 900_000 });
    } catch (e) {
      r = { code: 1, stdout: String(e.message) };
    } finally {
      moleculeDown(CHALLENGE);
    }
    const output = r.stdout;
    const m = output.match(/default\s+: actions=(\d+)\s+successful=(\d+)/);
    return { ok: r.code === 0, output, detail: r.code === 0 ? `molecule test passed (${m ? `${m[2]} of ${m[1]} actions successful` : 'no recap found'})` : `molecule test failed (exit code ${r.code})` };
  }
  if (stage === 'check-mode') {
    const r = ansible(['ansible-playbook', '-i', inventory, '--check', '--diff', playbook], inPart);
    return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? `check mode ran, ${countLines(r.stdout, /changed=[1-9]/)} hosts would change` : `check mode failed (exit code ${r.code})` };
  }
  if (stage === 'apply') {
    const r = ansible(['ansible-playbook', '-i', inventory, playbook], inPart);
    return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? `applied, ${countLines(r.stdout, /changed=[1-9]/)} hosts changed` : `apply failed (exit code ${r.code})` };
  }
  if (stage === 'second-run') {
    const r = ansible(['ansible-playbook', '-i', inventory, playbook], inPart);
    const changed = countLines(r.stdout, /changed=[1-9]/);
    const ok = r.code === 0 && changed === 0;
    return { ok, output: r.stdout, detail: ok ? 'second run changed 0 hosts' : r.code !== 0 ? `second run failed (exit code ${r.code})` : `second run still changed ${changed} hosts: the playbook is not idempotent` };
  }
  throw new Error(`Unknown stage ${stage}`);
}

/**
 * Run the pipeline. Returns a list, one entry per stage: { stage, status: 'passed' | 'failed' | 'skipped', seconds, detail, output }.
 * After the first failed stage the rest are 'skipped'. onStage is called after each stage.
 */
export async function pipeline({ playbook = 'site.yml', inventory = 'inventory/practice.ini', profile = 'production', only = null, onStage = () => {} } = {}) {
  const results = [];
  let failed = false;
  for (const stage of STAGES) {
    if (only && stage !== only) continue;
    if (failed) {
      const entry = { stage, status: 'skipped', seconds: 0, detail: 'not run, an earlier stage failed', output: '' };
      results.push(entry);
      onStage(entry);
      continue;
    }
    const t0 = process.hrtime.bigint();
    const r = await runStage(stage, { playbook, inventory, profile });
    const entry = { stage, status: r.ok ? 'passed' : 'failed', seconds: sinceStart(t0), detail: r.detail, output: r.output };
    if (!r.ok) failed = true;
    results.push(entry);
    onStage(entry);
  }
  return results;
}

export function table(results) {
  const rows = results.map((r) => `${r.status.toUpperCase().padEnd(8)} ${r.stage.padEnd(13)} ${r.seconds.toFixed(1).padStart(6)} s   ${r.detail}`);
  return ['STATUS   STAGE          TIME   WHAT HAPPENED', ...rows].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const results = await pipeline({
    playbook: opt('--playbook', 'site.yml'),
    inventory: opt('--inventory', 'inventory/practice.ini'),
    profile: opt('--profile', 'production'),
    only: opt('--only', null),
    onStage: (e) => {
      console.log(`${e.status.toUpperCase().padEnd(8)} ${e.stage.padEnd(13)} ${e.seconds.toFixed(1).padStart(6)} s   ${e.detail}`);
      if (e.status === 'failed') console.log(`\n${e.output.trim().split('\n').slice(-25).join('\n')}\n`);
    },
  });
  const bad = results.filter((r) => r.status === 'failed').length;
  console.log(`\n${bad === 0 ? 'The pipeline passed.' : 'The pipeline failed. Fix the stage that failed, then run it again.'}`);
  process.exit(bad === 0 ? 0 : 1);
}
