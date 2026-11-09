// Challenge 9, part 1: the pipeline, stage by stage, on your own machine.
// Run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against reference/guard.yml (for maintainers).
// This run takes several minutes. The slow stage is Molecule.

import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset, execIn, root } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';
import { STAGES } from './ci.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 9, part 1: the stages, locally');

const CHALLENGE = 9;
// Folder of this part as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-9-your-pipeline/part-1-stages-locally';
const CI = `${PART}/ci.mjs`;
const GUARD = join(here, 'guard.yml');
const REF_GUARD = join(here, 'reference', 'guard.yml');
const stageKey = (s) => s.replaceAll('-', '_');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const quote = (a) => (/[\s:&!*"{},]/.test(a) ? `'${a}'` : a);
// Run an ansible command from the root of the repository, like a learner does, and record it.
// Files of this part are written with the folder in front: P('guard.yml').
const P = (file) => `${PART}/${file}`;
function play(argv, note) {
  const r = ansible(argv);
  rec.step(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`, compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}

// Run ci.mjs on the host with Node, like a learner does. Returns { code, stdout }.
function ci(extra) {
  const r = spawnSync(process.execPath, [join(here, 'ci.mjs'), ...extra], { cwd: root, encoding: 'utf8', timeout: 1_800_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return { code: r.status ?? 1, stdout: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
// Read the stage table that ci.mjs prints.
function parseTable(text) {
  const rows = {};
  for (const m of text.matchAll(/^(PASSED|FAILED|SKIPPED)\s+(\S+)\s+([\d.]+) s\s+(.*)$/gm)) rows[m[2]] = { status: m[1].toLowerCase(), seconds: Number(m[3]), detail: m[4] };
  return rows;
}
// ci.mjs prints a failing stage's last lines; keep results.md short.
const trimCi = (text) => compactOutput(text);

try {
  cleanup(CHALLENGE);

  // The learner must have written the guard.
  const guardText = readFileSync(reference ? REF_GUARD : GUARD, 'utf8');
  if (/^\s*-\s*false\s*$/m.test(guardText)) {
    throw new Error('guard.yml still has "- false" as its test. Open it, read the TODO, and write the real test (deploy_environment must equal "practice").');
  }
  // --reference: use the maintainer's guard for this run, then put the learner's file back.
  let savedGuard = null;
  if (reference) {
    savedGuard = readFileSync(GUARD, 'utf8');
    copyFileSync(REF_GUARD, GUARD);
  }

  try {
    const resetS = await fleetReset();
    console.log(`Fleet ready in ${round(resetS, 1)} s`);

    // 1. The guard: practice passes, production is refused before any SSH connection, an unset variable is refused.
    const okRun = play(['ansible-playbook', '-i', P('inventory/practice.ini'), P('guard.yml')], (r) => `The guard passes for the practice inventory (exit code ${r.code}).`);
    const t0 = process.hrtime.bigint();
    const refused = play(['ansible-playbook', '-i', P('inventory/production.ini'), P('site.yml')], (r) => `The guard refuses the fake production inventory (exit code ${r.code}). The banner play never started.`);
    const refusedS = Number(process.hrtime.bigint() - t0) / 1e9;
    const verbose = ansible(['ansible-playbook', '-i', P('inventory/production.ini'), P('site.yml'), '-vvv']);
    const sshAttempts = countLines(verbose.stdout, /ESTABLISH SSH CONNECTION/);
    rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${P('inventory/production.ini')} ${P('site.yml')} -vvv | grep -c "ESTABLISH SSH CONNECTION"`, String(sshAttempts), `${sshAttempts} SSH connections were opened. The guard runs with connection: local, so it stops the run before Ansible reaches any host.`);
    const unset = play(['ansible-playbook', '-i', 'web1,', P('guard.yml')], (r) => `An inventory that does not set deploy_environment at all is refused too (exit code ${r.code}).`);
    const guardRefused = refused.code !== 0 && /Refusing to run/.test(refused.stdout) && /production/.test(refused.stdout);
    const guardPasses = okRun.code === 0;
    const guardRefusesUnset = unset.code !== 0 && /not set/.test(unset.stdout);

    // 2. The whole pipeline.
    const full = ci([]);
    rec.step(`node ${CI}`, trimCi(full.stdout), `The six stages, in order, exit code ${full.code}.`);
    const t = parseTable(full.stdout);
    for (const s of STAGES) if (t[s]?.status !== 'passed') throw new Error(`Stage ${s} did not pass in the full pipeline run:\n${full.stdout}`);

    // 3. A broken playbook stops at lint.
    const broken = ci(['--playbook', 'broken-site.yml']);
    rec.step(`node ${CI} --playbook broken-site.yml`, trimCi(broken.stdout), `The lint stage fails (exit code ${broken.code}), and the five stages after it are skipped. Nothing touched the fleet.`);
    const tb = parseTable(broken.stdout);
    const failedStage = Object.keys(tb).find((s) => tb[s].status === 'failed') ?? 'none';
    const skipped = Object.values(tb).filter((r) => r.status === 'skipped').length;

    // 4. The pipeline refuses production at the first stage that would connect.
    const prod = ci(['--inventory', 'inventory/production.ini', '--only', 'check-mode']);
    rec.step(`node ${CI} --inventory inventory/production.ini --only check-mode`, trimCi(prod.stdout), `The check-mode stage fails at the guard (exit code ${prod.code}).`);
    const prodRefused = prod.code !== 0 && /Refusing to run/.test(prod.stdout);

    // 5. The state of the fleet now.
    const banner = ['web1', 'web2'].map((h) => execIn(h, ['cat', '/etc/banner.d/welcome.txt']).stdout.trim().split('\n')[0]);
    rec.step('docker exec anp-web1 cat /etc/banner.d/welcome.txt', execIn('web1', ['cat', '/etc/banner.d/welcome.txt']).stdout.trim(), 'What the role wrote on web1. web2 has the same file with its own name.');

    const num = (re, text) => Number((text.match(re) || [])[1] ?? -1);
    const facts = {
      'c9.p1.guard_file': reference ? 'reference/guard.yml' : 'guard.yml',
      'c9.p1.guard_refused': guardRefused,
      'c9.p1.guard_passes_practice': guardPasses,
      'c9.p1.guard_refuses_unset': guardRefusesUnset,
      'c9.p1.guard_ssh_attempts': sshAttempts,
      'c9.p1.guard_refused_s': round(refusedS, 1),
      'c9.p1.stages_passed': Object.values(t).filter((r) => r.status === 'passed').length,
      'c9.p1.lint_profile': 'production',
      'c9.p1.check_would_change': num(/check mode ran, (\d+) hosts would change/, full.stdout),
      'c9.p1.apply_changed': num(/applied, (\d+) hosts changed/, full.stdout),
      'c9.p1.second_run_changed': num(/second run changed (\d+) hosts/, full.stdout),
      'c9.p1.broken_failed_stage': failedStage,
      'c9.p1.broken_skipped': skipped,
      'c9.p1.pipeline_refused_production': prodRefused,
    };
    for (const s of STAGES) facts[`c9.p1.stage_${stageKey(s)}_s`] = round(t[s].seconds, 1);
    for (const [k, v] of Object.entries(facts)) {
      if (v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
      setFact(k, v);
    }
    void banner;

    const left = leftovers(CHALLENGE);
    if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

    if (record) {
      rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/guard.yml' : ''}`);
      writeFileSync(
        join(here, 'chart.svg'),
        barsSvg({
          title: 'Seconds each pipeline stage took (one full run)',
          unit: 's',
          bars: STAGES.map((s) => ({ label: s, value: round(t[s].seconds, 1) })),
        }),
      );
      console.log('\nWrote results.md and chart.svg');
    }
  } finally {
    if (savedGuard !== null) {
      writeFileSync(GUARD, savedGuard);
      void renameSync;
    }
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
