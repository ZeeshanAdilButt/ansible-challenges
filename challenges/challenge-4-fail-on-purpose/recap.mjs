// Small helpers that read ansible-playbook output. Used by the run.mjs files of challenge 4.
// They only count what Ansible printed. They never change it.

const COUNTS = ['ok', 'changed', 'unreachable', 'failed', 'skipped', 'rescued', 'ignored'];

/** The PLAY RECAP lines of a run as { web1: { ok, changed, unreachable, failed, skipped, rescued, ignored }, ... }. */
export function parseRecap(text) {
  const hosts = {};
  const after = text.split('PLAY RECAP').slice(1).join('\n');
  for (const line of after.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+: (ok=\d+.*)$/);
    if (!m) continue;
    const row = {};
    for (const c of COUNTS) row[c] = Number((m[2].match(new RegExp(c + '=(\\d+)')) || [])[1] ?? 0);
    hosts[m[1]] = row;
  }
  return hosts;
}

/** Add one recap count over all hosts, for example total(recap, 'changed'). */
export function total(recap, key) {
  return Object.values(recap).reduce((sum, row) => sum + row[key], 0);
}

/**
 * The hosts on which a handler ran, from the "RUNNING HANDLER [name]" sections.
 * Returns an array of host names, one entry per run (a host that ran it twice appears twice).
 */
export function handlerHosts(text, name) {
  const hosts = [];
  let inside = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('RUNNING HANDLER [')) {
      inside = line.startsWith(`RUNNING HANDLER [${name}]`);
      continue;
    }
    if (/^(TASK|PLAY|RUNNING HANDLER) \[|^PLAY RECAP/.test(line)) {
      inside = false;
      continue;
    }
    if (!inside) continue;
    const m = line.match(/^(changed|ok): \[([^\]]+)\]/);
    if (m) hosts.push(m[2]);
  }
  return hosts;
}

/** What nginx answered in served.yml, per host: { web1: 'v2 from web1', ... }. */
export function answers(text) {
  const out = {};
  for (const m of text.matchAll(/"msg": "nginx answers: ([^"]*)"/g)) {
    const who = m[1].match(/ from (\S+?)(\n)?$/);
    if (who) out[who[1]] = m[1].replace(/\n$/, '');
  }
  return out;
}

/** The output lines printed inside one TASK section (or handler section), by task name. */
export function taskLines(text, task) {
  const lines = [];
  let inside = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^(TASK|RUNNING HANDLER) \[/.test(line)) {
      inside = line.startsWith(`TASK [${task}]`) || line.startsWith(`RUNNING HANDLER [${task}]`);
      continue;
    }
    if (/^PLAY( RECAP)? /.test(line) || /^PLAY \[/.test(line)) {
      inside = false;
      continue;
    }
    if (inside) lines.push(line);
  }
  return lines;
}

/** How many loop items a task ran for one host: counts the "(item=...)" lines. */
export function itemCount(text, task, host) {
  return taskLines(text, task).filter((l) => l.startsWith(`changed: [${host}] => (item=`) || l.startsWith(`ok: [${host}] => (item=`)).length;
}

/** How many times Ansible printed "FAILED - RETRYING" for one host. This is the number of retries used. */
export function retriesFor(text, host) {
  return text.split(/\r?\n/).filter((l) => l.startsWith(`FAILED - RETRYING: [${host}]`)).length;
}

/** The hosts that printed ok or changed in a task (the task ran there and did not fail or skip). */
export function hostsThatRan(text, task) {
  return taskLines(text, task)
    .map((l) => l.match(/^(?:ok|changed): \[([^\]]+)\]/))
    .filter(Boolean)
    .map((m) => m[1]);
}
