// Tests for the toolkit and the shared base. Run: node --test toolkit/test.mjs
// Most tests need no Docker. The last ones skip themselves when Docker is not running.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, runAsync, waitFor, label, name, safeArgs, cleanup, leftovers, assertDocker } from './docker.js';
import { barsSvg } from './bars.js';
import { Recorder, compactOutput } from './record.js';
import { setFact, getFact, factsPath } from './facts.js';
import { median, round } from './stats.js';
import { checkSetup, formatTable } from './check-setup.mjs';
import { execArgs, countLines } from './ansible.mjs';
import { ALL_TARGETS, BASE_HOSTS, ROLLOUT_HOSTS, PROJECT, containerName } from './fleet.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const IMAGE = 'debian:bookworm-slim';
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const NL = String.fromCharCode(10);
const hasDocker = run(['version']).code === 0;

test('label and name build the right strings', () => {
  assert.deepEqual(label(3), ['--label', 'anp.challenge=3']);
  assert.equal(name(3, 'web'), 'anp-c3-web');
  assert.throws(() => label('x'));
  assert.throws(() => label(-1));
});

test('safeArgs caps memory, processes and disk, and has no privileged flag', () => {
  const a = safeArgs(0, 'x').join(' ');
  assert.match(a, /--memory 64m/);
  assert.match(a, /--pids-limit 50/);
  assert.match(a, /--tmpfs \/tmp:rw,size=16m/);
  assert.match(a, /max-size=1m/);
  assert.doesNotMatch(a, /privileged|docker\.sock/);
});

test('median and round', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(round(1.2345, 2), 1.23);
});

test('waitFor returns the value, and times out with a clear message', async () => {
  let n = 0;
  const v = await waitFor(() => ++n >= 3 && 'done', { intervalMs: 5, timeoutMs: 2000 });
  assert.equal(v, 'done');
  await assert.rejects(waitFor(() => false, { intervalMs: 5, timeoutMs: 50, what: 'nothing' }), /Timed out after 50 ms waiting for nothing/);
});

test('barsSvg is accessible, uses no hex colours and escapes text', () => {
  const svg = barsSvg({ title: 'Sizes <test>', unit: 'MB', bars: [{ label: 'a & b', value: 12 }, { label: 'c', value: 3.456 }] });
  assert.match(svg, /^<svg /);
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">Sizes &lt;test&gt;<\/title>/);
  assert.match(svg, /<desc id="d">a &amp; b: 12 MB\. c: 3\.46 MB<\/desc>/);
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,8}\b/);
  assert.match(svg, /currentColor/);
  assert.throws(() => barsSvg({ title: 't', bars: [] }));
  assert.throws(() => barsSvg({ title: 't', bars: [{ label: 'x', value: -1 }] }));
});

test('compactOutput shortens repeated line lists and long lines, and keeps everything else', () => {
  const raw = ['web1 | CHANGED => {', '    "changed": true,', '    "stdout": "' + 'x'.repeat(600) + '",', '    "stdout_lines": [', '        "a",', '        "b"', '    ],', '    "rc": 0', '}'].join(NL);
  const out = compactOutput(raw);
  assert.match(out, /"stdout_lines": \[ 2 lines, the same text as "stdout", left out \],/);
  assert.match(out, /\[217 more characters left out\]/);
  assert.match(out, /"rc": 0/);
  assert.equal(compactOutput('web1 | SUCCESS'), 'web1 | SUCCESS');
  const rec = new Recorder('t');
  rec.step('cmd', 'out', 'note');
  assert.match(rec.markdown('m'), /## Step 1/);
});

test('facts: write, read, sort and reject bad names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'anp-facts-'));
  const old = process.env.ANP_FACTS_PATH;
  process.env.ANP_FACTS_PATH = join(dir, 'facts.json');
  try {
    assert.equal(getFact('c1.p1.x_mb'), undefined);
    setFact('c2.p1.b_mb', 2);
    setFact('c10.p1.a_s', 1.5);
    setFact('c1.p1.a_mb', 7);
    setFact('c1.p2.ok', true);
    setFact('c3.p1.winners', 'role defaults');
    assert.equal(getFact('c1.p1.a_mb'), 7);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(factsPath(), 'utf8'))), ['c1.p1.a_mb', 'c1.p2.ok', 'c2.p1.b_mb', 'c3.p1.winners', 'c10.p1.a_s']);
    assert.deepEqual(readdirSync(dir), ['facts.json'], 'no temp file is left behind');
    assert.throws(() => setFact('bad name', 1), /Bad fact name/);
    assert.throws(() => setFact('c1.p1.x_mb', NaN));
  } finally {
    if (old === undefined) delete process.env.ANP_FACTS_PATH;
    else process.env.ANP_FACTS_PATH = old;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSetup returns rows and facts', () => {
  const { rows, facts, ok } = checkSetup();
  assert.ok(rows.length >= 5);
  assert.ok(facts.node_major >= 22);
  assert.equal(typeof ok, 'boolean');
  assert.match(formatTable(rows), /Node\.js/);
});

test('execArgs builds a docker exec for the control container and refuses other commands', () => {
  const a = execArgs(['ansible', 'all', '-m', 'ping']);
  assert.deepEqual(a.slice(0, 4), ['exec', '-w', '/work', `${PROJECT}-control`]);
  assert.ok(a.join(' ').endsWith('sh -c exec "$@" 2>&1 sh ansible all -m ping'));
  const b = execArgs(['ansible-playbook', 'site.yml'], { cwd: 'challenges/x', env: { ANSIBLE_DEBUG: '1' }, merge: false });
  assert.deepEqual(b, ['exec', '-w', '/work/challenges/x', '-e', 'ANSIBLE_DEBUG=1', `${PROJECT}-control`, 'ansible-playbook', 'site.yml']);
  assert.throws(() => execArgs(['sh', '-c', 'id']), /Only ansible commands/);
  assert.throws(() => execArgs([]), /Only ansible commands/);
  assert.equal(countLines('a\nb pong\nc pong', /pong/), 2);
});

test('the fleet has three base hosts and four rollout hosts, all named anp-<host>', () => {
  assert.deepEqual(BASE_HOSTS, ['web1', 'web2', 'db1']);
  assert.deepEqual(ROLLOUT_HOSTS, ['web3', 'web4', 'web5', 'web6']);
  assert.equal(containerName('web1'), `${PROJECT}-web1`);
  const compose = read('fleet/compose.yaml');
  for (const h of ALL_TARGETS) assert.ok(compose.includes(`container_name: \${ANP_PROJECT:-anp}-${h}\n`), `${h} is in compose.yaml`);
  assert.equal((compose.match(/profiles: \[rollout\]/g) ?? []).length, 4);
});

test('compose.yaml: labels, init, limits, no privileged mode, socket only mentioned in comments', () => {
  const compose = read('fleet/compose.yaml');
  assert.ok(compose.includes('\nname: ${ANP_PROJECT:-anp}\n'), 'the project is anp unless ANP_PROJECT says otherwise');
  assert.match(compose, /anp\.fleet: "1"/);
  assert.match(compose, /init: true/);
  assert.match(compose, /mem_limit: 256m/);
  assert.match(compose, /no-new-privileges:true/);
  const code = compose.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /privileged|docker\.sock|network_mode: host|\n\s+ports:/);
});

test('control Dockerfile pins the tools and the target Dockerfile has no systemd', () => {
  const control = read('fleet/control/Dockerfile');
  assert.match(control, /FROM python:3\.12-slim-bookworm/);
  for (const pin of ['ansible-core==2.21.6', 'ansible-lint==26.11.0', 'molecule==26.11.0', 'molecule-plugins\\[docker\\]==26.11.0']) {
    assert.match(control, new RegExp(pin), `${pin} is pinned`);
  }
  const target = read('fleet/target/Dockerfile');
  assert.match(target, /FROM debian:bookworm-slim/);
  assert.doesNotMatch(target, /apt-get install[^\n]*systemd/);
  assert.match(read('fleet/target/anp-target-entrypoint.sh'), /service ssh start/);
});

test('ansible.cfg and the inventories', () => {
  const cfg = read('ansible.cfg');
  assert.match(cfg, /^inventory = inventory\/fleet\.ini$/m);
  assert.match(cfg, /^interpreter_python = auto_silent$/m);
  assert.match(cfg, /^retry_files_enabled = False$/m);
  const hosts = (file) => {
    const groups = {};
    let g = null;
    for (const line of read(file).split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = t.match(/^\[(.+)\]$/);
      if (m) g = m[1];
      else if (g && !g.endsWith(':vars') && !t.includes('=')) (groups[g] ??= []).push(t);
    }
    return groups;
  };
  assert.deepEqual(hosts('inventory/fleet.ini'), { web: ['web1', 'web2'], db: ['db1'] });
  assert.deepEqual(hosts('inventory/rollout.ini'), { web: ['web1', 'web2', 'web3', 'web4', 'web5', 'web6'], db: ['db1'] });
  assert.match(read('inventory/fleet.ini'), /ansible_user=ansible/);
});

test('.gitignore keeps the key, vault password and collections out; .gitattributes keeps line endings LF', () => {
  const ignore = read('.gitignore');
  for (const line of ['keys/', '.vault-pass', 'collections/']) assert.ok(ignore.split('\n').includes(line), `${line} is ignored`);
  assert.match(read('.gitattributes'), /eol=lf/);
});

test('no em dash or en dash in any file of the repository', () => {
  const skip = new Set(['.git', 'node_modules', 'keys', 'collections']);
  const bad = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (!/\.(png|jpg|svg)$/.test(entry) || entry.endsWith('.svg')) {
        const text = readFileSync(p, 'utf8');
        if (DASHES.test(text)) bad.push(relative(root, p));
      }
    }
  };
  walk(root);
  assert.deepEqual(bad, [], 'these files contain an em dash or en dash');
});

test('assertDocker returns the engine version', { skip: !hasDocker && 'Docker is not running' }, () => {
  assert.match(assertDocker(), /^\d+\.\d+/);
  return runAsync(['version', '--format', '{{.Server.Version}}']).then((r) => assert.equal(r.code, 0));
});

test('cleanup removes only objects labelled for that challenge', { skip: !hasDocker && 'Docker is not running' }, () => {
  // Challenge number 97 is only for this test, so it cannot clash with the challenge tests.
  // The objects we expect to survive are removed by hand at the end.
  const other = name(97, 'tk-other-label'); // labelled for challenge 96, must survive cleanup(97)
  const plain = name(97, 'tk-no-label'); // no label at all, must survive cleanup(97)
  const plainVolume = name(97, 'tk-plain-vol');
  const mk = (...a) => run(['create', ...a, IMAGE, 'true']).code;
  try {
    cleanup(97);
    assert.equal(mk('--name', name(97, 'tk-mine'), ...label(97)), 0);
    assert.equal(mk('--name', other, ...label(96)), 0);
    assert.equal(mk('--name', plain), 0);
    assert.equal(run(['network', 'create', ...label(97), name(97, 'tk-net')]).code, 0);
    assert.equal(run(['volume', 'create', ...label(97), name(97, 'tk-vol')]).code, 0);
    assert.equal(run(['volume', 'create', plainVolume]).code, 0);

    assert.deepEqual(leftovers(97), { containers: 1, networks: 1, volumes: 1 });
    const removed = cleanup(97);
    assert.equal(removed.containers.length, 1);
    assert.equal(removed.networks.length, 1);
    assert.equal(removed.volumes.length, 1);
    assert.deepEqual(leftovers(97), { containers: 0, networks: 0, volumes: 0 });

    assert.equal(run(['inspect', other]).code, 0, 'container with another label is still there');
    assert.equal(run(['inspect', plain]).code, 0, 'container with no label is still there');
    assert.equal(run(['volume', 'inspect', plainVolume]).code, 0, 'volume with no label is still there');
  } finally {
    run(['rm', '-f', other, plain]);
    run(['volume', 'rm', '-f', plainVolume]);
    cleanup(97);
  }
});
