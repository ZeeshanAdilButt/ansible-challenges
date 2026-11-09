// The practice fleet: control, web1, web2, db1 (and web3 to web6 with --rollout).
//
// Command line:
//   node toolkit/fleet.mjs up [--rollout]   build the images if missing, make the key, start, wait until SSH answers
//   node toolkit/fleet.mjs reset            make the targets new again from the image (seconds)
//   node toolkit/fleet.mjs status           what is running
//   node toolkit/fleet.mjs rollout-down     remove only web3 to web6, the base fleet keeps running
//   node toolkit/fleet.mjs down [--images]  remove the fleet containers and network (--images also removes the two images)
//   node toolkit/fleet.mjs build            build the two images
//   node toolkit/fleet.mjs keys             make the practice SSH key in ./keys if it is missing
//   node toolkit/fleet.mjs shell <host>     open a shell inside a host (your "second way in")
//
// From a run.mjs: import { fleetUp, fleetReset, fleetDown, fleetRunning, execIn } from '../../../toolkit/fleet.mjs';

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PROJECT, assertDocker, cleanupFleet, run, waitFor } from './docker.js';

export { PROJECT };

export const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
export const COMPOSE_FILE = join(root, 'fleet', 'compose.yaml');
export const KEYS_DIR = join(root, 'keys');
/** The container name of a host: containerName('web1') gives anp-web1 (or <ANP_PROJECT>-web1). 'control' works too. */
export const containerName = (host) => `${PROJECT}-${host}`;
export const CONTROL = containerName('control');
export const IMAGES = { control: 'anp-control:1', target: 'anp-target:1' };
export const BASE_HOSTS = ['web1', 'web2', 'db1'];
export const ROLLOUT_HOSTS = ['web3', 'web4', 'web5', 'web6'];
export const ALL_TARGETS = [...BASE_HOSTS, ...ROLLOUT_HOSTS];


// Linux: run the control container as the host user, so files it writes in your repository are yours.
// Windows and macOS: user 1000 inside the container (the folder is shared with open permissions).
function composeEnv() {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const gid = typeof process.getgid === 'function' ? process.getgid() : 1000;
  return { ANP_UID: String(uid), ANP_GID: String(gid), ANP_PROJECT: PROJECT };
}

/** Run `docker compose` on the fleet file. Always sees the rollout profile, so `down` removes web3 to web6 too. */
export function compose(args, opts = {}) {
  return run(['compose', '-p', PROJECT, '-f', COMPOSE_FILE, '--profile', 'rollout', ...args], { ...opts, env: { ...composeEnv(), ...(opts.env ?? {}) } });
}

/** Run a command inside a fleet container as root: execIn('web1', ['service', 'ssh', 'status']). host can be 'control'. */
export function execIn(host, argv, opts = {}) {
  const args = ['exec'];
  if (opts.user) args.push('--user', opts.user);
  args.push(containerName(host), ...argv);
  return run(args, opts);
}

/** Same, but inside the control container as the learner user, from /work. */
export function controlExec(argv, opts = {}) {
  return run(['exec', '-w', '/work', CONTROL, ...argv], opts);
}

/** The fleet services that are running now, for example ['control', 'web1', 'web2', 'db1']. */
export function fleetRunning() {
  const r = run(['ps', '--filter', 'label=anp.fleet=1', '--filter', `label=com.docker.compose.project=${PROJECT}`, '--filter', 'status=running', '--format', '{{.Label "com.docker.compose.service"}}']);
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).sort();
}

/** Every fleet service that exists, running or not. */
function fleetExisting() {
  const r = run(['ps', '-a', '--filter', 'label=anp.fleet=1', '--filter', `label=com.docker.compose.project=${PROJECT}`, '--format', '{{.Label "com.docker.compose.service"}}']);
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function imageExists(tag) {
  return run(['image', 'inspect', '--format', '{{.Id}}', tag]).code === 0;
}

/** Image sizes in MB (decimal, the same unit docker images prints). */
export function imageSizesMb() {
  const size = (tag) => {
    const r = run(['image', 'inspect', '--format', '{{.Size}}', tag]);
    if (r.code !== 0) throw new Error(`Image ${tag} does not exist. Run: node toolkit/fleet.mjs build`);
    return Math.round((Number(r.stdout.trim()) / 1e6) * 10) / 10;
  };
  return { control: size(IMAGES.control), target: size(IMAGES.target) };
}

/** Build the two images. Cached layers make a second build take seconds. */
export function fleetBuild({ quiet = false } = {}) {
  const r = compose(['build', 'control', 'web1'], { timeoutMs: 1_800_000 });
  if (r.code !== 0) throw new Error(`Image build failed:\n${(r.stderr || r.stdout).trim().split(/\r?\n/).slice(-25).join('\n')}`);
  if (!quiet) console.log('Images built: anp-control:1, anp-target:1');
  return r;
}

/**
 * Make the practice SSH key in ./keys, using ssh-keygen from the control image.
 * Returns true if it made a key, false if one was already there. The key is git-ignored.
 */
export function ensureKeys() {
  const priv = join(KEYS_DIR, 'id_ed25519');
  if (existsSync(priv) && existsSync(`${priv}.pub`)) return false;
  if (!imageExists(IMAGES.control)) fleetBuild({ quiet: true });
  mkdirSync(KEYS_DIR, { recursive: true });
  const env = composeEnv();
  const r = run([
    'run', '--rm', '--name', `${PROJECT}-keygen`, '--label', 'anp.fleet=1',
    '--user', `${env.ANP_UID}:${env.ANP_GID}`,
    '-v', `${KEYS_DIR}:/keys`,
    // ssh-keygen stops for a user id that has no name. The first part adds a name for the host user's id.
    '--entrypoint', 'sh',
    IMAGES.control, '-c',
    'getent passwd "$(id -u)" >/dev/null || echo "hostuser:x:$(id -u):$(id -g)::/tmp:/bin/sh" >> /etc/passwd; exec ssh-keygen "$@"',
    'ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'anp-practice-key', '-f', '/keys/id_ed25519',
  ]);
  if (r.code !== 0) throw new Error(`Could not make the SSH key: ${(r.stderr || r.stdout).trim()}`);
  return true;
}

// Waits inside the control container until each host shows an SSH banner and the key is in place.
const WAIT_SCRIPT = `
import os, socket, sys, time
deadline = time.time() + 40
key = os.path.expanduser("~/.ssh/id_ed25519")
while not os.path.exists(key):
    if time.time() > deadline:
        sys.exit("control has no key at " + key)
    time.sleep(0.05)
for host in sys.argv[1:]:
    while True:
        try:
            s = socket.create_connection((host, 22), timeout=1)
            s.settimeout(1)
            banner = s.recv(16)
            s.close()
            if banner.startswith(b"SSH-"):
                break
        except OSError:
            pass
        if time.time() > deadline:
            sys.exit("no SSH banner from " + host)
        time.sleep(0.05)
`;

/** Wait until every host answers on port 22 with an SSH banner. Throws after 40 seconds. */
export async function waitReady(hosts) {
  await waitFor(() => run(['inspect', '--format', '{{.State.Running}}', CONTROL]).stdout.trim() === 'true', { timeoutMs: 20_000, intervalMs: 100, what: 'the control container to run' });
  const r = run(['exec', CONTROL, 'python3', '-c', WAIT_SCRIPT, ...hosts], { timeoutMs: 60_000 });
  if (r.code !== 0) throw new Error(`The fleet did not become ready: ${(r.stderr || r.stdout).trim().split(/\r?\n/).pop()}`);
}

/**
 * Start the fleet. Builds the images and makes the key if they are missing.
 * Returns the seconds from the start of `up` (images already built) until every host answers SSH.
 */
export async function fleetUp({ rollout = false } = {}) {
  assertDocker();
  if (!imageExists(IMAGES.control) || !imageExists(IMAGES.target)) fleetBuild();
  ensureKeys();
  const hosts = rollout ? ALL_TARGETS : BASE_HOSTS;
  const t0 = process.hrtime.bigint();
  const r = compose(['up', '-d', '--no-build', 'control', ...hosts], { timeoutMs: 300_000 });
  if (r.code !== 0) throw new Error(`docker compose up failed:\n${(r.stderr || r.stdout).trim()}`);
  await waitReady(hosts);
  return Number(process.hrtime.bigint() - t0) / 1e9;
}

/**
 * Make every target new again from the image: clean files, no packages you added, new host keys.
 * If the fleet is not running yet, it starts it. Returns the seconds it took.
 * Targets that exist (including web3 to web6 if the rollout hosts are up) are all recreated.
 */
export async function fleetReset() {
  assertDocker();
  if (!fleetRunning().includes('control')) return fleetUp();
  const t0 = process.hrtime.bigint();
  const existing = fleetExisting();
  const targets = ALL_TARGETS.filter((h) => BASE_HOSTS.includes(h) || existing.includes(h));
  const r = compose(['up', '-d', '--no-build', '--force-recreate', '--no-deps', ...targets], { timeoutMs: 300_000 });
  if (r.code !== 0) throw new Error(`docker compose up failed:\n${(r.stderr || r.stdout).trim()}`);
  // Old SSH master connections point at containers that are gone. Remove their sockets.
  // The new targets also have new host keys. Forget the old ones, or ssh prints "REMOTE HOST IDENTIFICATION HAS CHANGED"
  // in the message of any later connection failure (a lockout, for example), which hides the real cause.
  controlExec(['sh', '-c', 'rm -rf "$HOME"/.ansible/cp "$HOME"/.ssh/known_hosts']);
  await waitReady(targets);
  return Number(process.hrtime.bigint() - t0) / 1e9;
}

/** Remove the fleet containers and the network anp-fleet. With images: also the two images. */
export function fleetDown({ images = false } = {}) {
  assertDocker();
  compose(['down', '--remove-orphans', '--timeout', '3'], { timeoutMs: 120_000 });
  cleanupFleet(); // second lock: removes anything still labelled anp.fleet=1
  if (images) {
    for (const tag of Object.values(IMAGES)) run(['rmi', tag]);
  }
}

/** Remove only web3 to web6 (the rollout hosts). The base fleet keeps running. */
export function fleetRolloutDown() {
  assertDocker();
  compose(['rm', '--stop', '--force', '--volumes', ...ROLLOUT_HOSTS], { timeoutMs: 120_000 });
}

/** A short table of the fleet. */
export function fleetStatus() {
  const r = run(['ps', '-a', '--filter', 'label=anp.fleet=1', '--filter', `label=com.docker.compose.project=${PROJECT}`, '--format', 'table {{.Names}}\t{{.Status}}\t{{.Image}}']);
  return r.stdout.trim() || 'The fleet is not running. Start it: node toolkit/fleet.mjs up';
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
  try {
    if (cmd === 'up') {
      const s = await fleetUp({ rollout: flags.includes('--rollout') });
      console.log(fleetStatus());
      console.log(`\nThe fleet answers on SSH after ${s.toFixed(1)} s. Try: node toolkit/ansible.mjs ansible all -m ping`);
    } else if (cmd === 'reset') {
      const s = await fleetReset();
      console.log(`Targets are new again after ${s.toFixed(1)} s.`);
    } else if (cmd === 'down') {
      fleetDown({ images: flags.includes('--images') });
      console.log(`The fleet containers and the network ${PROJECT}-fleet are removed.`);
    } else if (cmd === 'rollout-down') {
      fleetRolloutDown();
      console.log('web3 to web6 are removed.');
    } else if (cmd === 'status') {
      console.log(fleetStatus());
    } else if (cmd === 'build') {
      assertDocker();
      fleetBuild();
    } else if (cmd === 'keys') {
      assertDocker();
      console.log(ensureKeys() ? `Made a new key in ${KEYS_DIR}` : `A key is already in ${KEYS_DIR}`);
    } else if (cmd === 'shell') {
      if (!arg || ![...ALL_TARGETS, 'control'].includes(arg)) {
        console.error(`Usage: node toolkit/fleet.mjs shell <${['control', ...ALL_TARGETS].join('|')}>`);
        process.exit(2);
      }
      const tty = process.stdin.isTTY && process.stdout.isTTY;
      const r = spawnSync('docker', ['exec', ...(tty ? ['-it'] : ['-i']), containerName(arg), 'bash'], { stdio: 'inherit' });
      process.exit(r.status ?? 1);
    } else {
      console.error('Usage: node toolkit/fleet.mjs up [--rollout] | reset | status | rollout-down | down [--images] | build | keys | shell <host>');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
