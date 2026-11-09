// Run an ansible command inside the control container, from the repository folder (/work).
//
// Command line (exit code and output come straight through):
//   node toolkit/ansible.mjs ansible all -m ping
//   node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml
//   node toolkit/ansible.mjs ansible-inventory --graph
//
// Environment variables on your machine that start with ANSIBLE_ are passed in
// (for example ANSIBLE_DEBUG=1 or ANSIBLE_PYTHON_INTERPRETER=auto), except ANSIBLE_CONFIG.
//
// From a run.mjs:
//   import { ansible } from '../../../toolkit/ansible.mjs';
//   const r = ansible(['ansible', 'all', '-m', 'ping']);          // { code, stdout, stderr }
//   const r2 = ansible(['ansible-playbook', 'site.yml'], { env: { ANSIBLE_DEBUG: '1' }, cwd: 'challenges/x' });
// Output and errors come back mixed in the order they were printed (stdout), as a terminal shows them.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { CONTROL } from './fleet.mjs';

const PASS_BLOCKLIST = new Set(['ANSIBLE_CONFIG']);

function checkCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || !/^ansible[a-z-]*$/.test(argv[0])) {
    throw new Error(`Only ansible commands run here (ansible, ansible-playbook, ansible-vault, ansible-galaxy, ansible-inventory, ansible-lint ...). Got: ${JSON.stringify(argv?.[0])}`);
  }
}

/**
 * The docker arguments for one command. Pure function, so tests can read it.
 * opts: env (extra variables), cwd (folder under /work), interactive, tty, merge (stderr into stdout, default true).
 */
export function execArgs(argv, opts = {}) {
  checkCommand(argv);
  const args = ['exec', '-w', opts.cwd ? `/work/${opts.cwd.replace(/^\/+/, '')}` : '/work'];
  if (opts.interactive) args.push('-i');
  if (opts.tty) args.push('-t');
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith('ANSIBLE_') && !PASS_BLOCKLIST.has(k)) env[k] = v;
  Object.assign(env, opts.env ?? {});
  for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
  args.push(CONTROL);
  if (opts.merge === false || opts.tty) args.push(...argv);
  else args.push('sh', '-c', 'exec "$@" 2>&1', 'sh', ...argv);
  return args;
}

/** Run one ansible command and wait. Never throws for a failed command: look at code. */
export function ansible(argv, opts = {}) {
  const r = spawnSync('docker', execArgs(argv, opts), {
    encoding: 'utf8',
    input: opts.input,
    timeout: opts.timeoutMs ?? 600_000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) return { code: r.error.code === 'ETIMEDOUT' ? 124 : 127, stdout: r.stdout ?? '', stderr: `${r.stderr ?? ''}${r.error.message}` };
  let stdout = r.stdout ?? '';
  // Docker's own errors (no such container) come on stderr. With no other output, show them in stdout, with the cure.
  if (r.status !== 0 && !stdout.trim() && r.stderr) {
    const hint = /No such container|is not running/.test(r.stderr) ? '\nThe control container is not running. Start the fleet first: node toolkit/fleet.mjs up' : '';
    stdout = `${r.stderr.trim()}${hint}\n`;
  }
  return { code: r.status ?? 1, stdout, stderr: r.stderr ?? '' };
}

/** Count the lines of text that match a pattern. Handy for recaps and warnings. */
export function countLines(text, pattern) {
  return text.split(/\r?\n/).filter((l) => pattern.test(l)).length;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node toolkit/ansible.mjs ansible all -m ping');
    process.exit(2);
  }
  try {
    checkCommand(argv);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const state = spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', CONTROL], { encoding: 'utf8', windowsHide: true });
  if (state.status !== 0 || state.stdout.trim() !== 'true') {
    console.error('The control container is not running. Start the fleet first: node toolkit/fleet.mjs up');
    process.exit(1);
  }
  const interactive = Boolean(process.stdin.isTTY);
  const tty = interactive && Boolean(process.stdout.isTTY);
  const r = spawnSync('docker', execArgs(argv, { interactive, tty, merge: false }), { stdio: 'inherit', windowsHide: true });
  process.exit(r.status ?? 1);
}
