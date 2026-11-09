// Challenge 8, part 3: lockout and rollback.
// Run: node challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run with reference/push-safe.yml in place of your push-safe.yml (for maintainers).
// Helpers are described in toolkit/README.md.

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset, fleetRunning, fleetUp, execIn, controlExec, containerName, PROJECT, ALL_TARGETS } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 8, part 3: lockout and rollback');

const CHALLENGE = 8;
// Folder of this part as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback';
const INV = 'inventory/rollout.ini'; // Ansible's default connection sharing stays ON: that is how a learner meets this
const NO_SHARING = `${PART}/no-sharing.ini`;
const UNSAFE = `${PART}/push-unsafe.yml`;
const SAFE = `${PART}/push-safe.yml`;
const ROLLBACK = `${PART}/rollback.yml`;
const HOSTS = ALL_TARGETS; // web1 to web6 and db1
const generic = (text) => text.replaceAll(`${PROJECT}-`, 'anp-'); // show the container names a learner has

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const quote = (a) => (/[\s:&!*"{}=]/.test(a) ? `'${a}'` : a);
const ansibleCmd = (argv) => `node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`;

// Run an ansible command, record it, return the result.
function step(argv, note) {
  const r = ansible(argv);
  rec.step(ansibleCmd(argv), compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}

const sha = (host) => (execIn(host, ['sha256sum', '/etc/ssh/sshd_config']).stdout.split(/\s+/)[0] || '').trim();
const lostIn = (text) => countLines(text, /^\S+ \| UNREACHABLE/);
const pongsIn = (text) => countLines(text, /"ping": "pong"/);

// A ping to every host.
const pingAll = (note) => step(['ansible', 'all', '-i', INV, '-m', 'ping'], note);

// The second way in: docker exec as root. Restore the copy the push made, and restart sshd.
const RESTORE = 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart';
function recover(hosts, note) {
  const t0 = process.hrtime.bigint();
  const lines = [];
  const cmds = [];
  for (const h of hosts) {
    const r = execIn(h, ['sh', '-c', RESTORE]);
    cmds.push(`docker exec ${containerName(h)} sh -c '${RESTORE}'`);
    lines.push(`${h}: exit ${r.code}${r.stdout.trim() ? `, ${r.stdout.trim()}` : ''}${r.stderr.trim() ? `, ${r.stderr.trim()}` : ''}`);
    if (r.code !== 0) throw new Error(`recovery of ${h} failed: ${r.stderr || r.stdout}`);
  }
  const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
  rec.step(generic(cmds.join('\n')), lines.join('\n'), `${note} It took ${round(seconds, 1)} s.`);
  return seconds;
}

const sockets = () => controlExec(['sh', '-c', 'ls /home/learner/.ansible/cp 2>/dev/null']).stdout.split(/\s+/).filter(Boolean);

// Close every connection Ansible is holding open. Left alone, Ansible closes them itself 60 seconds after the last task.
function closeShared(note) {
  const socks = sockets();
  const lines = [];
  for (const s of socks) {
    const r = controlExec(['ssh', '-O', 'exit', '-o', `ControlPath=/home/learner/.ansible/cp/${s}`, 'any-host']);
    lines.push(`${s}: ${`${r.stdout}${r.stderr}`.trim()}`);
  }
  rec.step(generic(`docker exec ${containerName('control')} ssh -O exit -o ControlPath=/home/learner/.ansible/cp/<socket> any-host`), lines.join('\n') || '(no held connection)', `${note} ${socks.length === 1 ? '1 held connection' : `${socks.length} held connections`} closed.`);
  return socks.length;
}

let savedSafe = null;
try {
  cleanup(CHALLENGE);

  // The learner's safe playbook must have its three pieces. With --reference the maintainer's file is put in its place for this run.
  const SAFE_FILE = join(here, 'push-safe.yml');
  const REF_FILE = join(here, 'reference', 'push-safe.yml');
  const safeText = readFileSync(reference ? REF_FILE : SAFE_FILE, 'utf8');
  const missing = [];
  if (!/^\s*serial:\s*1\s*$/m.test(safeText)) missing.push('TODO 1: a "serial: 1" line');
  if (!/^\s*validate:\s*.*sshd -t -f %s/m.test(safeText)) missing.push('TODO 2: a "validate: sshd -t -f %s" line');
  if (!/^\s*(ansible\.builtin\.)?wait_for_connection:/m.test(safeText)) missing.push('TODO 3: a wait_for_connection task');
  if (!/^\s*(ansible\.builtin\.)?meta:\s*reset_connection\s*$/m.test(safeText)) missing.push('TODO 3: a meta: reset_connection task before it');
  if (missing.length) throw new Error(`push-safe.yml is not finished yet. Missing: ${missing.join('; ')}. Open it, read the TODO lines, and run this again.`);
  if (reference) {
    savedSafe = readFileSync(SAFE_FILE, 'utf8');
    copyFileSync(REF_FILE, SAFE_FILE);
  }

  if (!HOSTS.every((h) => fleetRunning().includes(h))) await fleetUp({ rollout: true });
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // 0. The starting point: every host answers, and we know each host's sshd_config by its hash.
  const base = pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts answer. This is the state we must get back to.`);
  const baseline = Object.fromEntries(HOSTS.map((h) => [h, sha(h)]));
  rec.step(generic(HOSTS.map((h) => `docker exec ${containerName(h)} sha256sum /etc/ssh/sshd_config`).join('\n')), HOSTS.map((h) => `${baseline[h].slice(0, 12)}...  ${h}`).join('\n'), "The first 12 characters of the hash of each host's sshd_config before anything changes. Every host starts with the same file.");
  const sameFile = (h) => sha(h) === baseline[h];

  // 1. SSH connection sharing: what does a connection that is already open do when sshd_config changes?
  step(['ansible', 'web1', '-i', INV, '-m', 'ping'], "One ping with Ansible's default settings. Ansible keeps this SSH connection open for 60 seconds so that the next task is fast.");
  const socks = sockets();
  rec.step(generic(`docker exec ${containerName('control')} ls /home/learner/.ansible/cp`), socks.join('\n'), `Every host Ansible talked to has a socket file in the control container: ${socks.length} files.`);
  step(['ansible-playbook', '-i', INV, UNSAFE, '--limit', 'web1', '-e', 'ssh_allow_users=deploy'], 'The unsafe push to web1. The new sshd_config says AllowUsers deploy, so the user ansible is no longer allowed in. The play still finishes green: every task re-uses the open connection.');
  const held = step(['ansible', 'web1', '-i', INV, '-m', 'ping'], (r) => `${pongsIn(r.stdout) === 1 ? 'The open connection still works (pong). Nothing looks wrong yet.' : 'Unexpected: the ping failed.'}`);
  closeShared('This closes every held connection. (Ansible does it by itself 60 seconds after the last task.)');
  const fresh = step(['ansible', 'web1', '-i', INV, '-m', 'ping'], (r) => `${lostIn(r.stdout) === 1 ? 'Now Ansible has to log in again, and the login is refused: web1 is locked out.' : 'Unexpected: the ping worked.'}`);
  const heldSurvives = pongsIn(held.stdout) === 1;
  const newRefused = lostIn(fresh.stdout) === 1 && /Permission denied/.test(fresh.stdout);
  recover(['web1'], 'The second way in: docker exec, as root. It puts back the copy that the push made.');
  step(['ansible', 'web1', '-i', INV, '-m', 'ping'], (r) => `${pongsIn(r.stdout)} of 1 hosts answer again.`);

  // 2. What if nothing is shared? The same push, with every task opening a new connection.
  const noShare = step(['ansible-playbook', '-i', NO_SHARING, UNSAFE, '--limit', 'web1', '-e', 'ssh_allow_users=deploy'], (r) => `With sharing off, the play is not green any more: the task "Restart sshd" is UNREACHABLE (${countLines(r.stdout, /UNREACHABLE/)} line). The file was written by the task before it, and sshd was not restarted yet. A new login already follows the file on disk.`);
  const noShareUnreachable = /TASK \[Restart sshd\][\s\S]*UNREACHABLE/.test(noShare.stdout);
  recover(['web1'], 'web1 is back through the second way in.');
  step(['ansible', 'web1', '-i', NO_SHARING, '-m', 'ping'], (r) => `${pongsIn(r.stdout)} of 1 hosts answer again.`);

  // 3. validate refuses a file with a typo (AllowUser, not AllowUsers).
  const typo = step(['ansible-playbook', '-i', INV, SAFE, '--limit', 'web1', '-e', 'ssh_extra_line=AllowUser deploy'], (r) => `The file has a typo. validate ran sshd -t on a temporary copy and the task failed (exit code ${r.code}). The real file was not touched.`);
  const typoRefused = typo.code !== 0 && /validate/i.test(typo.stdout) && /Bad configuration option/i.test(typo.stdout) && sameFile('web1');
  rec.step(generic(`docker exec ${containerName('web1')} sha256sum /etc/ssh/sshd_config`), `${sha('web1').slice(0, 12)}...  web1`, sameFile('web1') ? 'Same hash as before: the bad file never reached /etc/ssh/sshd_config.' : 'The file changed!');
  const probe = execIn('web1', ['sh', '-c', "printf 'AllowUsers deploy\\n' > /tmp/denies-ansible.conf && sshd -t -f /tmp/denies-ansible.conf; echo \"exit code $?\"; rm -f /tmp/denies-ansible.conf"]);
  rec.step(generic(`docker exec ${containerName('web1')} sh -c 'printf "AllowUsers deploy\\n" > /tmp/denies-ansible.conf && sshd -t -f /tmp/denies-ansible.conf; echo "exit code $?"'`), probe.stdout.trim() || probe.stderr.trim(), 'The other kind of mistake: a file that is correct but locks you out. sshd -t finds nothing wrong with it, so validate alone is not enough.');
  const validatePasses = /exit code 0/.test(probe.stdout);
  execIn('web1', ['rm', '-f', '/tmp/denies-ansible.conf']);

  // 4. The unsafe push to one canary host.
  const canaryPlay = step(['ansible-playbook', '-i', INV, UNSAFE, '--limit', 'web1', '-e', 'ssh_allow_users=deploy'], 'Unsafe push to one canary host. The play is green: nothing in it checks that a new login still works.');
  const canaryGreen = countLines(canaryPlay.stdout, /unreachable=0\s+failed=0/) === 1;
  closeShared('Time passes: the held connection closes.');
  const canary = pingAll((r) => `${lostIn(r.stdout)} host unreachable, ${pongsIn(r.stdout)} answer. One host is lost.`);
  const lostCanary = lostIn(canary.stdout);
  const recoverOneS = recover(['web1'], 'The second way in puts the old file back on web1.');
  pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts answer again.`);

  // 5. The unsafe push to every host at once.
  const all = step(['ansible-playbook', '-i', INV, UNSAFE, '-e', 'ssh_allow_users=deploy'], (r) => `Unsafe push to all hosts at once. ${countLines(r.stdout, /unreachable=0\s+failed=0/)} of 7 hosts say unreachable=0 failed=0. The play is green.`);
  const playFailed = countLines(all.stdout, /failed=[1-9]/) + countLines(all.stdout, /unreachable=[1-9]/);
  const beforeClose = pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts still answer. The held connections hide the damage.`);
  const answersBeforeClose = pongsIn(beforeClose.stdout);
  closeShared('Time passes: the held connections close.');
  const gone = pingAll((r) => `${lostIn(r.stdout)} of 7 hosts are unreachable. Every host is lost.`);
  const lostAll = lostIn(gone.stdout);
  const recoverAllS = recover(HOSTS, 'The second way in, host by host: all seven get the old file back.');
  const back = pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts answer again.`);
  const backAll = pongsIn(back.stdout);

  // 6. The safe push with the same locking-out file: validate passes (the file is valid), the new-login check fails, serial 1 stops the play.
  const safeBad = step(['ansible-playbook', '-i', INV, SAFE, '-e', 'ssh_allow_users=deploy'], (r) => `The same locking-out file, through your safe playbook. web1 fails the new-login check. The play stops there: ${countLines(r.stdout, /^\S+\s+:\s+ok=/)} host appears in the recap, and the other six were never touched.`);
  const recapHosts = countLines(safeBad.stdout, /^\S+\s+:\s+ok=/);
  const safeStopped = safeBad.code !== 0 && /timed out waiting for ping/i.test(safeBad.stdout);
  closeShared('Close any held connection, so that the count below is the real one.');
  const lostSerialPing = pingAll((r) => `${lostIn(r.stdout)} host unreachable, ${pongsIn(r.stdout)} answer.`);
  const lostSerial = lostIn(lostSerialPing.stdout);
  const untouchedSerial = HOSTS.filter((h) => h !== 'web1' && sameFile(h)).length;
  rec.step(generic(HOSTS.map((h) => `docker exec ${containerName(h)} sha256sum /etc/ssh/sshd_config`).join('\n')), HOSTS.map((h) => `${sha(h).slice(0, 12)}...  ${h}${sameFile(h) ? '  (same as the start)' : '  (CHANGED)'}`).join('\n'), `${untouchedSerial} of the 6 hosts after web1 still hold the file they started with.`);
  recover(['web1'], 'Only web1 needs the second way in.');
  pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts answer again.`);

  // 7. The safe push with a harmless change goes through on all seven hosts, one at a time.
  const good = step(['ansible-playbook', '-i', INV, SAFE, '-e', 'ssh_login_grace_time=30'], (r) => `A harmless change (LoginGraceTime 30) through the safe playbook, one host at a time: ${countLines(r.stdout, /changed=[1-9]/)} of 7 hosts changed, none failed.`);
  const goodChanged = countLines(good.stdout, /^\S+\s+:\s+ok=\d+\s+changed=[1-9]\d*\s+unreachable=0\s+failed=0/);
  const differs = HOSTS.every((h) => !sameFile(h));
  const goodPing = pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts answer.`);

  // 8. Roll back from the copies, with Ansible (the hosts are reachable).
  const rb = step(['ansible-playbook', '-i', INV, ROLLBACK], (r) => `The rollback playbook puts the copy back on each host, tests it, restarts sshd and checks a new login. ${countLines(r.stdout, /changed=[1-9]/)} hosts changed.`);
  const rbPing = pingAll((r) => `${pongsIn(r.stdout)} of 7 hosts answer.`);
  const rollbackOk = rb.code === 0 && pongsIn(rbPing.stdout) === 7 && HOSTS.every(sameFile);
  rec.step(generic(HOSTS.map((h) => `docker exec ${containerName(h)} sha256sum /etc/ssh/sshd_config`).join('\n')), HOSTS.map((h) => `${sha(h).slice(0, 12)}...  ${h}${sameFile(h) ? '  (same as the start)' : '  (DIFFERENT)'}`).join('\n'), `${HOSTS.filter(sameFile).length} of 7 hosts hold exactly the file they started with.`);

  const facts = {
    'c8.p3.push_safe_file': `${PART}/${reference ? 'reference/' : ''}push-safe.yml`,
    'c8.p3.reachable_before': pongsIn(base.stdout),
    'c8.p3.held_connection_survives': heldSurvives,
    'c8.p3.new_login_refused_after_close': newRefused,
    'c8.p3.no_sharing_unreachable_at_restart': noShareUnreachable,
    'c8.p3.validate_refused': typoRefused,
    'c8.p3.validate_passes_lockout_file': validatePasses,
    'c8.p3.canary_play_green': canaryGreen,
    'c8.p3.lost_canary': lostCanary,
    'c8.p3.play_failed_hosts_all_at_once': playFailed,
    'c8.p3.answers_before_close_all_at_once': answersBeforeClose,
    'c8.p3.lost_all_at_once': lostAll,
    'c8.p3.recovered_all': backAll,
    'c8.p3.recover_one_s': round(recoverOneS, 1),
    'c8.p3.recover_all_s': round(recoverAllS, 1),
    'c8.p3.safe_stopped_at_first_host': safeStopped && recapHosts === 1,
    'c8.p3.lost_with_serial': lostSerial,
    'c8.p3.untouched_with_serial': untouchedSerial,
    'c8.p3.safe_good_changed': goodChanged,
    'c8.p3.safe_good_reachable': pongsIn(goodPing.stdout),
    'c8.p3.differs': differs,
    'c8.p3.rollback_ok': rollbackOk,
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/push-safe.yml as push-safe.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Hosts locked out of 7, by how the sshd_config was pushed',
        unit: 'hosts',
        bars: [
          { label: 'one canary host (unsafe)', value: lostCanary },
          { label: 'all at once (unsafe)', value: lostAll },
          { label: 'validate, check, serial 1', value: lostSerial },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (savedSafe !== null) writeFileSync(join(here, 'push-safe.yml'), savedSafe);
  cleanup(CHALLENGE);
}
