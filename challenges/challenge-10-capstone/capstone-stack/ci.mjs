// The stage runner for this stack. It is the same list of checks a CI server would run, in the same order:
//
//   deps         install the pinned collections from requirements.yml (skipped when they are already there)
//   lint         ansible-lint, profile from .ansible-lint
//   syntax       ansible-playbook --syntax-check on every playbook
//   apply        site.yml for real, with --diff: it must not fail
//   idempotence  site.yml again: it must report changed=0 on every host
//   check        site.yml in check mode with --diff: no failure and changed=0 (a drift check on the finished fleet)
//   health       GET /health through the proxy must answer 200 with the app and the database behind it
//
// Run it (the fleet must be running):   node challenges/challenge-10-capstone/capstone-stack/ci.mjs
// Run some stages:                       node .../ci.mjs --only lint,syntax
// The first stage that fails stops the run (exit code 1). Every stage that did not run is shown as "skipped".
// The vault password is read from .vault-pass in this folder, through vault-pass.sh.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ansible } from '../../../toolkit/ansible.mjs';
import { controlExec } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
/** This folder as the control container sees it (the repository is mounted at /work). */
export const REL = relative(root, here).split(sep).join('/');
export const STAGES = ['deps', 'lint', 'syntax', 'apply', 'idempotence', 'check', 'health'];
const PLAYBOOKS = ['site.yml', 'rollout.yml', 'recover.yml'].filter((f) => existsSync(resolve(here, f)));

// Collections go in the control container home, not in the shared folder: on Docker Desktop for Windows
// the shared folder is so slow that unpacking one collection takes more than an hour (see NOTES.md).
export const COLLECTIONS = "/home/learner/.ansible/collections";

/** The settings every Ansible command of the stack gets. */
export const stackEnv = () => ({
  ANSIBLE_PIPELINING: '1',
  ANSIBLE_VAULT_PASSWORD_FILE: `/work/${REL}/vault-pass.sh`,
  ANSIBLE_COLLECTIONS_PATH: COLLECTIONS,
});

/** One ansible command in the control container, with the stack settings. */
export const play = (argv, extraEnv = {}, opts = {}) => ansible(argv, { ...opts, env: { ...stackEnv(), ...extraEnv } });

/** The PLAY RECAP lines: { web1: { ok, changed, unreachable, failed, skipped, rescued, ignored }, ... }. */
export function parseRecap(text) {
  const hosts = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\S+)\s*:\s+ok=(\d+)\s+changed=(\d+)\s+unreachable=(\d+)\s+failed=(\d+)\s+skipped=(\d+)\s+rescued=(\d+)\s+ignored=(\d+)/.exec(line);
    if (m) hosts[m[1]] = { ok: +m[2], changed: +m[3], unreachable: +m[4], failed: +m[5], skipped: +m[6], rescued: +m[7], ignored: +m[8] };
  }
  return hosts;
}
export const sum = (hosts, key) => Object.values(hosts).reduce((a, h) => a + h[key], 0);

/** GET a URL from inside the control container. Returns { status, body, headers }. status 0 means no answer. */
export function get(url) {
  const code = [
    'import json, sys, urllib.request, urllib.error',
    'try:',
    '    r = urllib.request.urlopen(sys.argv[1], timeout=5)',
    '    print(json.dumps({"status": r.status, "body": r.read().decode(), "headers": dict(r.headers)}))',
    'except urllib.error.HTTPError as e:',
    '    print(json.dumps({"status": e.code, "body": e.read().decode(), "headers": dict(e.headers)}))',
    'except Exception as e:',
    '    print(json.dumps({"status": 0, "body": str(e), "headers": {}}))',
  ].join('\n');
  const r = controlExec(['python3', '-c', code, url]);
  try {
    return JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {
    return { status: 0, body: r.stderr || r.stdout, headers: {} };
  }
}

const tail = (text, n = 20) => text.trim().split(/\r?\n/).slice(-n).join('\n');

function stageDeps() {
  const listed = play(['ansible-galaxy', 'collection', 'list', '-p', COLLECTIONS, '--format', 'json'], {}, { merge: false });
  let have = {};
  try {
    have = Object.values(JSON.parse(listed.stdout)).reduce((a, v) => ({ ...a, ...v }), {});
  } catch {
    /* nothing installed yet */
  }
  // Unpacking a collection on a shared Windows folder takes minutes, so skip the install when the pins are already met.
  const wanted = [...readFileSync(resolve(here, 'requirements.yml'), 'utf8').matchAll(/name:\s*(\S+)\s*\n\s*version:\s*"?([^"\s]+)"?/g)].map((m) => [m[1], m[2]]);
  const installed = Object.entries(have).map(([n, v]) => `${n} ${v.version}`);
  if (wanted.length > 0 && wanted.every(([n, v]) => have[n]?.version === v)) {
    return { ok: true, output: '', detail: `already installed: ${installed.join(', ')}` };
  }
  const r = play(['ansible-galaxy', 'collection', 'install', '-r', `${REL}/requirements.yml`, '-p', COLLECTIONS]);
  return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? `installed: ${wanted.map(([n, v]) => `${n} ${v}`).join(', ')}` : tail(r.stdout, 8) };
}

function stageLint() {
  const r = play(['ansible-lint'], {}, { cwd: REL });
  return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? (tail(r.stdout, 3).split('\n').find((l) => /Passed|failures|warnings/.test(l)) ?? 'passed') : tail(r.stdout, 15) };
}

function stageSyntax() {
  const r = play(['ansible-playbook', '-i', `${REL}/inventory.ini`, '--syntax-check', ...PLAYBOOKS.map((p) => `${REL}/${p}`)]);
  return { ok: r.code === 0, output: r.stdout, detail: r.code === 0 ? `${PLAYBOOKS.join(', ')}` : tail(r.stdout, 10) };
}

function runSite(extra) {
  return play(['ansible-playbook', '-i', `${REL}/inventory.ini`, `${REL}/site.yml`, ...extra]);
}

function stageCheck() {
  // Check mode needs a fleet that is already configured. On a new fleet it fails on the first task that needs a
  // package that is not there yet (see NOTES.md, error 4), so this stage runs after apply, as a drift check.
  const r = runSite(['--check', '--diff']);
  const recap = parseRecap(r.stdout);
  const hosts = Object.keys(recap).length;
  const changed = sum(recap, 'changed');
  const ok = r.code === 0 && hosts > 0 && sum(recap, 'failed') === 0 && sum(recap, 'unreachable') === 0 && changed === 0;
  return { ok, output: r.stdout, recap, detail: ok ? 'no drift: nothing would change' : (r.code === 0 ? `would change ${changed} task(s)` : tail(r.stdout, 15)) };
}

function stageApply() {
  const r = runSite(['--diff']);
  const recap = parseRecap(r.stdout);
  const ok = r.code === 0 && Object.keys(recap).length > 0 && sum(recap, 'failed') === 0;
  return { ok, output: r.stdout, recap, detail: ok ? `changed ${sum(recap, 'changed')} task(s) on ${Object.keys(recap).length} hosts` : tail(r.stdout, 15) };
}

function stageIdempotence() {
  const r = runSite([]);
  const recap = parseRecap(r.stdout);
  const changed = sum(recap, 'changed');
  const ok = r.code === 0 && Object.keys(recap).length > 0 && changed === 0;
  const which = Object.entries(recap).filter(([, h]) => h.changed > 0).map(([n, h]) => `${n}=${h.changed}`).join(' ');
  return { ok, output: r.stdout, recap, detail: ok ? 'changed=0 on every host' : `changed ${changed} task(s) (${which}). Run again with -v to see which task.` };
}

function stageHealth() {
  const r = get('http://web1/health');
  let body = {};
  try {
    body = JSON.parse(r.body);
  } catch {
    /* not JSON */
  }
  const ok = r.status === 200 && body.status === 'ok' && body.db === 'ok';
  return { ok, output: JSON.stringify(r), detail: ok ? `200, release ${body.release}, app ${body.host}, db ${body.db}` : `status ${r.status}: ${String(r.body).slice(0, 120)}` };
}

const RUNNERS = { deps: stageDeps, lint: stageLint, syntax: stageSyntax, check: stageCheck, apply: stageApply, idempotence: stageIdempotence, health: stageHealth };

/** Run the stages in order and stop at the first failure. Returns { ok, stages: [{ name, status, seconds, detail, output }] }. */
export function runCi({ only, onStage } = {}) {
  const names = STAGES.filter((s) => !only || only.includes(s));
  const stages = [];
  let failed = false;
  for (const name of names) {
    if (failed) {
      stages.push({ name, status: 'skipped', seconds: 0, detail: 'an earlier stage failed', output: '' });
      continue;
    }
    const t0 = Date.now();
    const r = RUNNERS[name]();
    const stage = { name, status: r.ok ? 'ok' : 'FAILED', seconds: Math.round((Date.now() - t0) / 100) / 10, detail: r.detail, output: r.output ?? '', recap: r.recap };
    stages.push(stage);
    onStage?.(stage);
    if (!r.ok) failed = true;
  }
  return { ok: !failed, stages };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const i = process.argv.indexOf('--only');
  const only = i > -1 ? process.argv[i + 1].split(',') : undefined;
  const bad = (only ?? []).filter((s) => !STAGES.includes(s));
  if (bad.length) {
    console.error(`Unknown stage: ${bad.join(', ')}. Stages: ${STAGES.join(', ')}`);
    process.exit(2);
  }
  const result = runCi({
    only,
    onStage: (s) => console.log(`${s.status.padEnd(8)} ${s.name.padEnd(12)} ${String(s.seconds).padStart(6)} s  ${s.detail.split('\n')[0]}`),
  });
  for (const s of result.stages.filter((x) => x.status === 'skipped')) console.log(`skipped  ${s.name}`);
  const failedStage = result.stages.find((s) => s.status === 'FAILED');
  if (failedStage) console.error(`\nStage ${failedStage.name} failed:\n${failedStage.detail}`);
  console.log(result.ok ? '\nAll stages passed.' : '\nThe pipeline stopped.');
  process.exit(result.ok ? 0 : 1);
}
