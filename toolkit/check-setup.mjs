// Checks that your machine can run the challenges.
// Run it: node toolkit/check-setup.mjs
// It prints a short table. It exits with code 1 if something you must fix is missing.

import { statfsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run } from './docker.js';
import { round } from './stats.js';
import { IMAGES } from './fleet.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GB = 1024 ** 3;

const MIN_NODE = 22;
const MIN_FREE_DISK_GB = 2; // below this we stop, while the two images are not built yet (the build needs room)
const MIN_FREE_DISK_GB_BUILT = 0.3; // once the images exist, a run needs only a little room
const WARN_FREE_DISK_GB = 5;
const WARN_DOCKER_MEMORY_GB = 4;

function firstLine(text) {
  return (text || '').trim().split(/\r?\n/)[0] || 'no output';
}

/** Run every check. Returns { rows, facts, ok }. A row is { check, status, detail }. */
export function checkSetup({ dir = root } = {}) {
  const rows = [];
  const facts = {};
  const add = (check, status, detail) => rows.push({ check, status, detail });

  // Node
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  facts.node_major = nodeMajor;
  add(
    'Node.js',
    nodeMajor >= MIN_NODE ? 'ok' : 'FAIL',
    nodeMajor >= MIN_NODE
      ? `v${process.versions.node}`
      : `v${process.versions.node}. You need Node ${MIN_NODE} or newer (24 is best). Install it from nodejs.org.`,
  );

  // Docker client and engine
  const v = run(['version', '--format', '{{.Client.Version}}|{{.Server.Version}}'], { timeoutMs: 30_000 });
  let engineOk = false;
  let imagesBuilt = false;
  if (v.code === 0 && v.stdout.includes('|')) {
    const [client, server] = v.stdout.trim().split('|');
    engineOk = Boolean(server);
    facts.engine_version = server;
    add('Docker engine', engineOk ? 'ok' : 'FAIL', engineOk ? `engine ${server}, client ${client}` : 'The client works but no engine answered. Start Docker.');
  } else if (v.code === 127) {
    add('Docker engine', 'FAIL', 'The docker command was not found. Install Docker Desktop or Docker Engine.');
  } else {
    add('Docker engine', 'FAIL', `${firstLine(v.stderr || v.stdout)}. Start Docker and wait until it says running.`);
  }

  // Engine details
  if (engineOk) {
    const i = run(['info', '--format', '{{json .}}'], { timeoutMs: 30_000 });
    let info = null;
    try {
      info = JSON.parse(i.stdout);
    } catch {
      /* handled below */
    }
    if (info) {
      const desktop = /docker desktop/i.test(info.OperatingSystem || '');
      facts.desktop = desktop;
      add('Machine type', 'ok', `${info.OSType}/${info.Architecture}, ${info.OperatingSystem}${desktop ? '. Some behaviour differs on Docker Desktop. The READMEs tell you where.' : ''}`);

      const memGb = round((info.MemTotal || 0) / GB, 1);
      facts.docker_memory_gb = memGb;
      add('Docker memory', memGb >= WARN_DOCKER_MEMORY_GB ? 'ok' : 'warn', `${memGb} GB${memGb >= WARN_DOCKER_MEMORY_GB ? '' : `. ${WARN_DOCKER_MEMORY_GB} GB or more is better. Raise it in Docker Desktop settings.`}`);
      add('CPUs for Docker', 'ok', String(info.NCPU));
      add('Cgroup version', 'ok', `v${info.CgroupVersion || '?'}`);
    } else {
      add('Machine type', 'warn', 'docker info did not return readable data');
    }

    const c = run(['compose', 'version', '--short'], { timeoutMs: 30_000 });
    add('Compose plugin', c.code === 0 ? 'ok' : 'FAIL', c.code === 0 ? `v${c.stdout.trim().replace(/^v/, '')}` : 'missing. The fleet starts with docker compose. Install the Compose plugin (Docker Desktop has it).');
  }

  // Fleet images (built by the first fleet up)
  if (engineOk) {
    imagesBuilt = Object.values(IMAGES).every((tag) => run(['image', 'inspect', '--format', '{{.Id}}', tag], { timeoutMs: 30_000 }).code === 0);
    facts.images_built = imagesBuilt;
    add('Fleet images', 'ok', imagesBuilt ? `${IMAGES.control} and ${IMAGES.target} are built` : 'not built yet. The first node toolkit/fleet.mjs up builds them (about 0.7 GB on disk).');
  }

  // Disk
  try {
    const s = statfsSync(dir);
    const freeGb = round((s.bavail * s.bsize) / GB, 1);
    facts.disk_free_gb = freeGb;
    const minGb = imagesBuilt ? MIN_FREE_DISK_GB_BUILT : MIN_FREE_DISK_GB;
    const status = freeGb < minGb ? 'FAIL' : freeGb < WARN_FREE_DISK_GB ? 'warn' : 'ok';
    const hint = status === 'FAIL' ? `. Free some space first. ${imagesBuilt ? 'A run needs a little room.' : 'The image build needs room.'}` : status === 'warn' ? `. ${WARN_FREE_DISK_GB} GB or more is better.` : '';
    add('Free disk (this folder)', status, `${freeGb} GB${hint}`);
  } catch (e) {
    add('Free disk (this folder)', 'warn', `could not read: ${e.message}`);
  }

  return { rows, facts, ok: rows.every((r) => r.status !== 'FAIL') };
}

/** Make the table text. */
export function formatTable(rows) {
  const w = Math.max(...rows.map((r) => r.check.length));
  const lines = rows.map((r) => `${r.status.padEnd(4)}  ${r.check.padEnd(w)}  ${r.detail}`);
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { rows, ok } = checkSetup();
  console.log(formatTable(rows));
  console.log(ok ? '\nAll hard checks passed.' : '\nA check failed. Fix the FAIL lines above and run this again.');
  process.exit(ok ? 0 : 1);
}
