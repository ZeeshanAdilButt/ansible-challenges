// Challenge 3, part 2: facts.
// Run: node challenges/challenge-3-one-template-three-hosts/part-2-facts/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run the fixed playbook in reference/ (for maintainers).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 3, part 2: facts');
const CHALLENGE = 3;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-3-one-template-three-hosts/part-2-facts';
const FACTS_YML = `${PART}/${reference ? 'reference/' : ''}facts.yml`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shown = (text) => text.replaceAll('/reference/facts.yml', '/facts.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Run one command, record it, return the result.
function step(argv, note, { env } = {}) {
  const r = ansible(argv, { env });
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  const prefix = env ? `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ')} ` : '';
  rec.step(shown(`${prefix}node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), shown(compactOutput(r.stdout)), typeof note === 'function' ? note(r) : note);
  return r;
}

// One labelled message per host: { web1: 'Debian', ... } for the label DISTRIBUTION and so on.
function labelled(text, label) {
  const out = {};
  for (const m of text.matchAll(new RegExp(`ok: \\[(\\w+)\\] => \\{\\s*"msg": "${label}=([^"]*)"`, 'g'))) out[m[1]] = m[2];
  return out;
}

// Average seconds of one module call, from time-gather.yml: { full, min, ping }.
// The playbook times five calls of each on every host. We take the mean over the three hosts.
function perCall(env) {
  const r = ansible(['ansible-playbook', `${PART}/time-gather.yml`], { env });
  if (r.code !== 0) throw new Error(`time-gather.yml failed. Output:\n${r.stdout}`);
  const mean = (label) => {
    const v = [...r.stdout.matchAll(new RegExp(`${label}_S=([0-9.]+)`, 'g'))].map((m) => Number(m[1]));
    if (v.length !== 3) throw new Error(`Expected 3 values for ${label}, got ${v.length}.`);
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  return { full: mean('FULL'), min: mean('MIN'), ping: mean('PING') };
}

try {
  cleanup(CHALLENGE);

  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  const syntax = ansible(['ansible-playbook', FACTS_YML, '--syntax-check']);
  if (syntax.code !== 0) throw new Error(`${FACTS_YML} is not a valid playbook yet. Ansible says:\n${syntax.stdout.trim()}`);

  // Step 1: a fact that is missing. New servers have no ip command, so there is no default_ipv4.
  const missing = step(['ansible-playbook', `${PART}/missing-fact.yml`], 'On new servers the IPv4 fact does not exist, and nothing warned you when the facts were gathered. The error comes only when a task asks for it.');

  // Step 2: your playbook: install ip, gather again, print four facts.
  const facts1 = step(['ansible-playbook', FACTS_YML], 'Four facts from three hosts, read with ansible_facts[...].');
  if (facts1.code !== 0) {
    throw new Error(/'TODO' is undefined/.test(facts1.stdout)
      ? 'facts.yml still has the word TODO inside {{ }}. Replace it in all four debug tasks (see the TODO lines at the top of the file).'
      : 'facts.yml failed. Read the output above.');
  }
  const dist = labelled(facts1.stdout, 'DISTRIBUTION');
  const ipv4 = labelled(facts1.stdout, 'IPV4');
  const mem = labelled(facts1.stdout, 'MEMORY_MB');
  const pkg = labelled(facts1.stdout, 'PKG_MGR');
  const hosts = Object.keys(dist);
  if (hosts.length !== 3) throw new Error(`Expected facts from 3 hosts, found ${hosts.length}. Keep the labels DISTRIBUTION=, IPV4=, MEMORY_MB=, PKG_MGR=.`);

  // Step 3: the old way, and what Ansible says about it.
  const old = step(['ansible-playbook', `${PART}/old-style.yml`], (r) => `The old way still works. Ansible printed ${(r.stdout.match(/^\[DEPRECATION WARNING\]/gm) || []).length} deprecation warnings: one for each task that uses an injected fact, not one for each host.`);
  const depLines = (old.stdout.match(/^\[DEPRECATION WARNING\].*$/gm) || []);
  const depText = depLines[0] ?? '';
  const remedy = (old.stdout.match(/^Use `ansible_facts.*$/m) || [])[0] ?? '';

  // Step 4: the same playbook with injection switched off, as it will be after the removal.
  const off = step(['ansible-playbook', `${PART}/old-style.yml`], 'With injection off, the old name does not exist. This is what "removed" will look like.', { env: { ANSIBLE_INJECT_FACT_VARS: 'false' } });

  // Step 5: all facts against the minimal subset: how many facts you get.
  const full = step(['ansible-playbook', `${PART}/gather-full.yml`], (r) => `All facts: ${labelled(r.stdout, 'FACT_COUNT').web1} facts per host, and the IPv4 fact is there.`);
  const min = step(['ansible-playbook', `${PART}/gather-min.yml`], (r) => `gather_subset: min: ${labelled(r.stdout, 'FACT_COUNT').web1} facts per host, and no IPv4 fact.`);

  // Step 6: what does it cost? time-gather.yml times five calls of each on each host. Three runs, median.
  // First with the settings as they are, then with SSH pipelining on (fewer SSH round trips per module call).
  const modes = { default: {}, pipelined: { ANSIBLE_PIPELINING: 'True' } };
  const times = {};
  for (const [mode, env] of Object.entries(modes)) {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(perCall(env));
    times[mode] = { full: median(runs.map((x) => x.full)), min: median(runs.map((x) => x.min)), ping: median(runs.map((x) => x.ping)), runs };
  }
  const row = (mode, key, label) => `${label.padEnd(30)} ${times[mode].runs.map((x) => x[key].toFixed(2)).join('  ')}   median ${times[mode][key].toFixed(2)} s`;
  const table = (mode) => [row(mode, 'full', 'all facts'), row(mode, 'min', 'gather_subset: min'), row(mode, 'ping', 'ping, no facts')].join('\n');
  rec.step(
    'node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/time-gather.yml   (three runs; mean of the three hosts per run)',
    `Settings as they are (seconds per module call):\n${table('default')}\n\nWith ANSIBLE_PIPELINING=True (seconds per module call):\n${table('pipelined')}`,
    'Seconds for one call of the module on one host, measured inside the playbook (five calls, averaged), so starting Ansible is not counted. Every call still pays for the SSH trip, which the ping row shows.',
  );

  const out = {
    'c3.p2.hosts_reported': hosts.length,
    'c3.p2.distribution': [...new Set(Object.values(dist))].join(','),
    'c3.p2.pkg_mgr': [...new Set(Object.values(pkg))].join(','),
    'c3.p2.default_ipv4_web1': ipv4.web1,
    'c3.p2.memtotal_mb_web1': Number(mem.web1),
    'c3.p2.memtotal_same_on_all_hosts': new Set(Object.values(mem)).size === 1,
    'c3.p2.missing_fact_error': /has no attribute 'default_ipv4'/.test(missing.stdout),
    'c3.p2.deprecation_lines': depLines.length,
    'c3.p2.deprecation_text': depText.replace(/^\[DEPRECATION WARNING\]: /, ''),
    'c3.p2.deprecation_remedy': remedy,
    'c3.p2.deprecation_removal_version': (depText.match(/ansible-core version ([\d.]+)/) || [])[1],
    'c3.p2.inject_off_error': /'ansible_distribution' is undefined/.test(off.stdout),
    'c3.p2.fact_count_full': Number(labelled(full.stdout, 'FACT_COUNT').web1),
    'c3.p2.fact_count_min': Number(labelled(min.stdout, 'FACT_COUNT').web1),
    'c3.p2.min_has_default_ipv4': labelled(min.stdout, 'HAS_DEFAULT_IPV4').web1 === 'True',
    'c3.p2.gather_full_s': round(times.default.full, 2),
    'c3.p2.gather_min_s': round(times.default.min, 2),
    'c3.p2.gather_ping_s': round(times.default.ping, 2),
    'c3.p2.gather_full_pipelined_s': round(times.pipelined.full, 2),
    'c3.p2.gather_min_pipelined_s': round(times.pipelined.min, 2),
    'c3.p2.gather_ping_pipelined_s': round(times.pipelined.ping, 2),
    'c3.p2.reset_s': round(resetS, 1),
    'c3.p2.playbook_file': FACTS_YML,
  };
  for (const [k, v] of Object.entries(out)) {
    if (v === undefined || v === '' || Number.isNaN(v)) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/facts.yml; the paths below show facts.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Seconds for one module call on one host: all facts, minimal facts, ping (median of three runs)',
        unit: 's',
        bars: [
          { label: 'all facts', value: out['c3.p2.gather_full_s'] },
          { label: 'min facts', value: out['c3.p2.gather_min_s'] },
          { label: 'ping', value: out['c3.p2.gather_ping_s'] },
          { label: 'all facts, pipelined', value: out['c3.p2.gather_full_pipelined_s'] },
          { label: 'min facts, pipelined', value: out['c3.p2.gather_min_pipelined_s'] },
          { label: 'ping, pipelined', value: out['c3.p2.gather_ping_pipelined_s'] },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
