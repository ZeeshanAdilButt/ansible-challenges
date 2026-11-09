// Challenge 3, part 3: one template, three hosts.
// Run: node challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to render the fixed template in reference/ (for maintainers).

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 3, part 3: one template, three hosts');
const CHALLENGE = 3;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-3-one-template-three-hosts/part-3-template-per-host';
const PLAYBOOK = `${PART}/render.yml`;
const TEMPLATE = join(here, 'app.conf.j2');
const REFERENCE_TEMPLATE = join(here, 'reference', 'app.conf.j2');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// The PLAY RECAP lines: one per host.
function recap(text) {
  const rows = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\S+)\s*: ok=(\d+)\s+changed=(\d+)\s+unreachable=(\d+)\s+failed=(\d+)\s+skipped=(\d+)/);
    if (m) rows[m[1]] = { ok: +m[2], changed: +m[3], unreachable: +m[4], failed: +m[5], skipped: +m[6] };
  }
  return rows;
}
const total = (rows, key) => Object.values(rows).reduce((a, r) => a + r[key], 0);

// Run one command, record it, return the result.
function step(argv, note) {
  const r = ansible(argv);
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`, compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}

// The text of /etc/myapp/app.conf on each host, from the output of an ad hoc "cat".
function files(r) {
  const out = {};
  const parts = r.stdout.split(/^(\S+) \| \w+ \| rc=\d+ >>\n/m);
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1].replace(/\s+$/, '');
  return out;
}
const lineCount = (text) => (text ? text.split('\n').length : 0);

let savedTemplate = null;
try {
  cleanup(CHALLENGE);

  // A --reference run renders the fixed template. The learner's file is put back at the end.
  if (reference) {
    savedTemplate = readFileSync(TEMPLATE);
    copyFileSync(REFERENCE_TEMPLATE, TEMPLATE);
  }

  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // The template must be valid before anything is copied to a server.
  const syntax = ansible(['ansible-playbook', PLAYBOOK, '--syntax-check']);
  if (syntax.code !== 0) throw new Error(`The playbook or the template has a problem. Ansible says:\n${syntax.stdout.trim()}`);
  step(['ansible-playbook', PLAYBOOK, '--syntax-check'], 'Syntax check: the playbook is valid. (It does not read the template; a template mistake shows when the template task runs.)');

  // Step 1: render on all three hosts.
  const first = step(['ansible-playbook', PLAYBOOK], (r) => `First run: ${total(recap(r.stdout), 'changed')} changes in total (2 tasks on 3 hosts: the folder and the file).`);
  if (first.code !== 0) throw new Error('The first run failed. If the message says "Syntax error in template" or "is undefined", look at app.conf.j2 at the line it names.');

  // Step 2: read the three files back.
  const cat = step(['ansible', 'all', '-b', '-m', 'command', '-a', 'cat /etc/myapp/app.conf'], (r) => {
    const f = files(r);
    return `The three files, line by line: web1 has ${lineCount(f.web1)} lines, web2 has ${lineCount(f.web2)}, db1 has ${lineCount(f.db1)}. One template made all three. (command says CHANGED because it always does.)`;
  });
  const f = files(cat);
  for (const h of ['web1', 'web2', 'db1']) if (!f[h]) throw new Error(`No file text came back from ${h}. Look at the output above.`);

  // Step 3: run again. Same template, same variables: nothing to change.
  const second = step(['ansible-playbook', PLAYBOOK], (r) => `Second run: ${total(recap(r.stdout), 'changed')} changes. The files already match.`);

  // Step 4: change one value on one host and look at the diff.
  const diff = step(['ansible-playbook', PLAYBOOK, '--diff', '--limit', 'web1', '-e', 'app_port=9090'], (r) => `Changed the port on web1 only (-e app_port=9090, --limit web1): ${total(recap(r.stdout), 'changed')} change. --diff shows the lines before and after.`);
  const removed = (diff.stdout.match(/^-(listen_port = \d+)$/m) || [])[1];
  const added = (diff.stdout.match(/^\+(listen_port = \d+)$/m) || [])[1];

  // Step 5: put it back, then prove the fleet is stable again.
  const back = step(['ansible-playbook', PLAYBOOK], (r) => `Run without -e: ${total(recap(r.stdout), 'changed')} change. web1 goes back to its own port from group_vars.`);
  const stable = step(['ansible-playbook', PLAYBOOK], (r) => `Run again: ${total(recap(r.stdout), 'changed')} changes.`);

  const facts = {
    'c3.p3.first_run_changed': total(recap(first.stdout), 'changed'),
    'c3.p3.lines_web1': lineCount(f.web1),
    'c3.p3.lines_web2': lineCount(f.web2),
    'c3.p3.lines_db1': lineCount(f.db1),
    'c3.p3.differs': new Set([f.web1, f.web2, f.db1]).size === 3,
    'c3.p3.web_files_list_both_peers': [f.web1, f.web2].every((t) => /^peer = web1$/m.test(t) && /^peer = web2$/m.test(t)),
    'c3.p3.db_file_has_no_peers': !/peer/.test(f.db1),
    'c3.p3.port_web1': (f.web1.match(/^listen_port = (\d+)$/m) || [])[1],
    'c3.p3.port_web2': (f.web2.match(/^listen_port = (\d+)$/m) || [])[1],
    'c3.p3.port_db1': (f.db1.match(/^listen_port = (\d+)$/m) || [])[1],
    'c3.p3.second_run_changed': total(recap(second.stdout), 'changed'),
    'c3.p3.diff_changed': total(recap(diff.stdout), 'changed'),
    'c3.p3.diff_removed': removed,
    'c3.p3.diff_added': added,
    'c3.p3.restore_changed': total(recap(back.stdout), 'changed'),
    'c3.p3.final_changed': total(recap(stable.stdout), 'changed'),
    'c3.p3.reset_s': round(resetS, 1),
    'c3.p3.template_file': reference ? 'reference/app.conf.j2' : 'app.conf.j2',
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === '') throw new Error(`Could not read the value for ${k}. Look at the output above. Does your template print the lines listen_port = ..., peer = ... in the format of the TODO comment?`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/app.conf.j2 as app.conf.j2' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Lines in the config file that one template made on each host, and changes per run',
        unit: '',
        bars: [
          { label: 'lines on web1', value: facts['c3.p3.lines_web1'] },
          { label: 'lines on web2', value: facts['c3.p3.lines_web2'] },
          { label: 'lines on db1', value: facts['c3.p3.lines_db1'] },
          { label: 'changes, first run', value: facts['c3.p3.first_run_changed'] },
          { label: 'changes, second run', value: facts['c3.p3.second_run_changed'] },
          { label: 'changes, port on web1', value: facts['c3.p3.diff_changed'] },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (savedTemplate) writeFileSync(TEMPLATE, savedTemplate);
  cleanup(CHALLENGE);
}
