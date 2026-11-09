// The Molecule container: where `molecule` and `ansible-lint` run, with the Docker socket mounted.
//
// THIS IS THE ONE EXCEPTION to "no access to the host's Docker". Molecule makes and removes its test
// containers through the Docker API, so this container gets /var/run/docker.sock. Whoever can use the
// socket can start any container on the host. The container runs as the normal user (not root), with
// no-new-privileges and no --privileged, but treat it as trusted code only. Challenges 7 and 9 both use it, the same way:
// moleculeUp(7) or moleculeUp(9) gives anp-c7-molecule or anp-c9-molecule with the label anp.challenge=7 or 9.
//
// It is built from the image the fleet already has (anp-control:1). Nothing new is pulled or built.
// The Docker CLI is not needed: molecule-plugins[docker] talks to the socket with the Python docker SDK.
//
// Collections: community.docker and ansible.posix are installed at run time (see COLLECTIONS below).
//
// From a run.mjs:
//   import { moleculeUp, moleculeExec, moleculeDown, installCollections } from '../../../toolkit/molecule.mjs';
//   await moleculeUp(7);                                   // container anp-c7-molecule, label anp.challenge=7
//   installCollections(7);                                 // community.docker and ansible.posix, pinned, into the container
//   const r = moleculeExec(7, ['molecule', 'test'], { cwd: 'challenges/.../roles/webserver' });
//   moleculeDown(7);                                       // or cleanup(7), which removes everything labelled anp.challenge=7
//
// Command line:
//   node toolkit/molecule.mjs up 7 | down 7 | shell 7 | collections 7
//   node toolkit/molecule.mjs run 7 <folder in the repository> molecule test     (output streams, the exit code comes through)

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { assertDocker, label, name, run, waitFor, cleanup } from './docker.js';
import { IMAGES, root } from './fleet.mjs';

/**
 * The collections Molecule's Docker driver needs, pinned (community.docker pulls in the third one as a dependency,
 * so it is pinned too). They are installed at run time into the container's own disk, not into the repository:
 * on Docker Desktop for Windows, writing the 860 files of community.docker into the shared folder took more than
 * 5 minutes, and into the container's disk it took 18 seconds. The folder is gone when the container is removed.
 */
export const COLLECTIONS = { 'community.docker': '5.4.0', 'ansible.posix': '2.2.2', 'community.library_inventory_filtering_v1': '1.1.5' };
export const COLLECTIONS_DIR = '/home/learner/collections';

/** The container name for challenge n: anp-c7-molecule. */
export const moleculeName = (n) => name(n, 'molecule');

/**
 * The group id that owns the Docker socket, found by looking at it from a throwaway container.
 * Docker Desktop: 0 (root). A Linux host: usually the group `docker`. The container user must be in this group.
 */
export function socketGroup(socket = '/var/run/docker.sock') {
  const r = run(['run', '--rm', '--entrypoint', 'stat', '-v', `${socket}:${socket}`, IMAGES.control, '-c', '%g', socket]);
  const gid = r.stdout.trim();
  if (r.code !== 0 || !/^\d+$/.test(gid)) throw new Error(`Could not read the group of ${socket} through Docker:\n${(r.stderr || r.stdout).trim()}`);
  return gid;
}

/** The `docker run` arguments for the Molecule container. A pure function, so a test can read it. */
export function moleculeRunArgs(n, { gid, uid = 1000, groupId = 1000 } = {}) {
  return [
    'run', '-d', '--init',
    '--name', moleculeName(n),
    ...label(n),
    '--user', `${uid}:${groupId}`,
    '--group-add', String(gid),
    '--memory', '1g',
    '--memory-swap', '1g',
    '--pids-limit', '512',
    '--security-opt', 'no-new-privileges',
    '--log-opt', 'max-size=1m', '--log-opt', 'max-file=2',
    '-e', 'HOME=/home/learner',
    '-e', 'ANSIBLE_CONFIG=/work/ansible.cfg',
    '-e', `ANSIBLE_COLLECTIONS_PATH=${COLLECTIONS_DIR}`,
    '-w', '/work',
    '-v', `${root}:/work`,
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    // The image's own entrypoint adds a passwd entry for the host user's id on Linux. It prints a note
    // about the missing SSH key in the container log: Molecule does not use SSH.
    IMAGES.control,
  ];
}

/** Start the Molecule container if it is not running. Returns its name. */
export async function moleculeUp(n) {
  assertDocker();
  const cname = moleculeName(n);
  const state = run(['inspect', '--format', '{{.State.Running}}', cname]);
  if (state.code === 0 && state.stdout.trim() === 'true') return cname;
  if (state.code === 0) run(['rm', '-f', cname]);
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const gid = typeof process.getgid === 'function' ? process.getgid() : 1000;
  const r = run(moleculeRunArgs(n, { gid: socketGroup(), uid, groupId: gid }));
  if (r.code !== 0) throw new Error(`Could not start ${cname}:\n${(r.stderr || r.stdout).trim()}`);
  await waitFor(() => run(['exec', cname, 'true']).code === 0, { timeoutMs: 20_000, intervalMs: 200, what: `${cname} to answer` });
  return cname;
}

/** Remove the Molecule container (and anything else labelled anp.challenge=n). */
export function moleculeDown(n) {
  return cleanup(n);
}

const ALLOWED = /^(molecule|ansible[a-z-]*)$/;

/**
 * Run a command in the Molecule container: moleculeExec(7, ['molecule', 'test'], { cwd, env }).
 * Returns { code, stdout, stderr }; output and errors are mixed in print order in stdout. Never throws.
 */
export function moleculeExec(n, argv, opts = {}) {
  if (!Array.isArray(argv) || !ALLOWED.test(argv[0] ?? '')) throw new Error(`Only molecule and ansible commands run here, got ${JSON.stringify(argv?.[0])}`);
  const args = ['exec', '-w', opts.cwd ? `/work/${opts.cwd.replace(/^\/+/, '')}` : '/work'];
  for (const [k, v] of Object.entries(opts.env ?? {})) args.push('-e', `${k}=${v}`);
  args.push(moleculeName(n), 'sh', '-c', 'exec "$@" 2>&1', 'sh', ...argv);
  return run(args, { timeoutMs: opts.timeoutMs ?? 900_000 });
}

/** True when both pinned collections are in collections/ already. */
export function collectionsInstalled(n) {
  const checks = Object.entries(COLLECTIONS).map(([c, v]) => {
    const [ns, nm] = c.split('.');
    const r = run(['exec', moleculeName(n), 'sh', '-c', `grep -o '"version": "[^"]*"' ${COLLECTIONS_DIR}/ansible_collections/${ns}/${nm}/MANIFEST.json 2>/dev/null | head -1`]);
    return r.stdout.includes(`"${v}"`);
  });
  return checks.every(Boolean);
}

/**
 * Install the two collections at their pinned versions into COLLECTIONS_DIR (inside the container). Skips what is there.
 * Returns { installed: boolean, seconds }.
 */
export function installCollections(n) {
  const t0 = process.hrtime.bigint();
  if (collectionsInstalled(n)) return { installed: false, seconds: 0 };
  const specs = Object.entries(COLLECTIONS).map(([c, v]) => `${c}:==${v}`);
  const r = moleculeExec(n, ['ansible-galaxy', 'collection', 'install', '-p', COLLECTIONS_DIR, ...specs], { timeoutMs: 300_000 });
  if (r.code !== 0) throw new Error(`ansible-galaxy could not install the collections:\n${r.stdout}`);
  return { installed: true, seconds: Number(process.hrtime.bigint() - t0) / 1e9, output: r.stdout };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, nArg, folder, ...command] = process.argv.slice(2);
  const n = Number(nArg);
  if (!['up', 'down', 'shell', 'collections', 'run'].includes(cmd) || !Number.isInteger(n) || n < 0 || (cmd === 'run' && (!folder || !ALLOWED.test(command[0] ?? '')))) {
    console.error('Usage: node toolkit/molecule.mjs up|down|shell|collections <challenge number>');
    console.error('       node toolkit/molecule.mjs run <challenge number> <folder> molecule test');
    process.exit(2);
  }
  try {
    if (cmd === 'up') console.log(`${await moleculeUp(n)} is running (Docker socket mounted).`);
    else if (cmd === 'down') {
      moleculeDown(n);
      console.log(`Everything labelled anp.challenge=${n} is removed.`);
    } else if (cmd === 'collections') {
      await moleculeUp(n);
      const r = installCollections(n);
      console.log(r.installed ? `Installed ${JSON.stringify(COLLECTIONS)} in ${r.seconds.toFixed(1)} s.` : 'Both collections are already installed.');
    } else if (cmd === 'run') {
      await moleculeUp(n);
      installCollections(n);
      const tty = process.stdin.isTTY && process.stdout.isTTY;
      const r = spawnSync('docker', ['exec', '-w', `/work/${folder}`, ...(tty ? ['-it'] : []), moleculeName(n), ...command], { stdio: 'inherit' });
      process.exit(r.status ?? 1);
    } else if (cmd === 'shell') {
      await moleculeUp(n);
      const tty = process.stdin.isTTY && process.stdout.isTTY;
      const r = spawnSync('docker', ['exec', ...(tty ? ['-it'] : ['-i']), moleculeName(n), 'bash'], { stdio: 'inherit' });
      process.exit(r.status ?? 1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
