# Challenge 8, part 3: lockout and rollback

**Time:** about 60 minutes. **Download:** nothing. The fleet images are already built from challenge 1. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You change the SSH settings on every server in one run. The run ends green. A minute later you cannot log in to any of them. Ansible cannot reach them and neither can you. This is called a **lockout**, and with a real server it can mean a drive to a data centre, or a call to a cloud provider's console.

In this part you cause the lockout on purpose, on containers, you see how bad it is, you get out through a **second way in**, and then you write the playbook that would have prevented it.

## The idea

**sshd** is the program on a server that accepts SSH logins. Its settings are in `/etc/ssh/sshd_config`. One setting here is `AllowUsers`. If it lists users, only those users may log in. We push a file that says `AllowUsers deploy`. The file is correct, but our practice user is called `ansible`, so Ansible is refused.

Four ideas make a push safe:

1. **A second way in.** A way to reach the server that does not use the thing you are changing. For real servers it is a cloud console or a management network. For your containers it is `docker exec`, which starts a shell inside the container without SSH. The toolkit has it: `node toolkit/fleet.mjs shell web1`.
2. **A backup.** Copy the old file first. Rolling back is then one `cp`.
3. **`validate`.** The `template` and `copy` modules can run a command on a temporary copy of the new file. If the command fails, the real file is not touched. For sshd the command is `sshd -t -f %s` (`-t` means test, `%s` is the temporary file). `validate` finds **syntax** mistakes, such as a typo in a setting name. It cannot find a file that is correct and locks you out.
4. **A check that a new login works, and `serial: 1`.** After the change, make a **new** SSH connection. If it fails, the play stops. With `serial: 1` only one host is lost, not all.

**SSH connection sharing.** By default Ansible keeps its first SSH connection to a host open for 60 seconds and re-uses it for the next tasks. That is fast. It also means that a connection which is already open **keeps working after you break the login**. The play ends green, and you find the damage later. The check in step 4 must therefore drop the open connection first. The playbook does that with `meta: reset_connection`.

## Your task

Open `push-safe.yml` in this folder. It is the unsafe push (`push-unsafe.yml`) with three things missing. The `TODO` lines tell you what:

1. `serial: 1`
2. a `validate:` line with `sshd -t -f %s`
3. a task that proves that a new login works after the restart, with `wait_for_connection` (and the `meta: reset_connection` before it)

## Steps

Start the rollout fleet first: `node toolkit/fleet.mjs up --rollout`.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml` | Add the three pieces. |
| 3 | `node challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/run.mjs` | Starts with `fleet reset`. Runs the whole drill (see below). It takes about 6 to 8 minutes. |
| 4 | `node toolkit/show-facts.mjs c8.p3` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/test.mjs` | The test passes. |

The drill, in the order `run.mjs` does it:

1. Every host answers. It saves a hash (a short fingerprint) of each host's `sshd_config`.
2. A connection that is already open survives the bad file; a new login is refused.
3. The same push with sharing off: the lockout starts when the file is written.
4. `validate` refuses a typo, and `sshd -t` passes the file that locks you out.
5. Unsafe push to one canary host (`web1`), then to all seven hosts at once. Both look green. Both lock hosts out. You recover through `docker exec`.
6. Your safe playbook with the locking-out file: one host lost, six untouched.
7. Your safe playbook with a harmless change: all seven hosts change, one at a time.
8. `rollback.yml` puts the backup back everywhere. Every host again holds exactly the file it started with.

The fleet keeps running after this part, with the original `sshd_config` on every host.

## What you should see

The most important lines:

```text
unsafe push to one host        : play green, 1 host lost
unsafe push to all hosts       : play green, 7 of 7 hosts still answer at first (held connections),
                                 then 7 of 7 are unreachable
safe push with the same file   : web1 fails the new-login check, play stops, 1 host lost, 6 untouched
safe push with a fine change   : 7 of 7 hosts changed, all answer
rollback                       : 7 of 7 hosts hold the file they started with
```

Recovery through the second way in is quick: about one second for one host, about four seconds for seven. The hard part of a real lockout is not the command. It is having the second way in before you need it.

The message for the failed new-login check:

```text
timed out waiting for ping module test: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).
```

The full recorded run is in [results.md](results.md).

![Hosts locked out of 7, by how the sshd_config was pushed](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c8.p3.held_connection_survives`, `c8.p3.new_login_refused_after_close` | A ping over the open connection after the bad push (works), and a ping after `ssh -O exit` closed it (UNREACHABLE, `Permission denied`). |
| `c8.p3.no_sharing_unreachable_at_restart` | With `no-sharing.ini` the task `Restart sshd` is UNREACHABLE in the play output. |
| `c8.p3.validate_refused` | The safe playbook with a typo (`AllowUser`) failed with `Bad configuration option`, and the hash of `sshd_config` did not change. |
| `c8.p3.validate_passes_lockout_file` | `sshd -t -f` on a file with `AllowUsers deploy` exits 0. |
| `c8.p3.lost_canary`, `c8.p3.lost_all_at_once`, `c8.p3.lost_with_serial` | Hosts printed as `UNREACHABLE` by `ansible all -m ping` after the push and after closing held connections. |
| `c8.p3.answers_before_close_all_at_once` | Hosts that still answered right after the all-at-once push. |
| `c8.p3.play_failed_hosts_all_at_once` | Hosts with `failed` or `unreachable` above 0 in the recap of the unsafe push. |
| `c8.p3.untouched_with_serial` | Hosts after `web1` whose `sshd_config` hash still equals the first one. |
| `c8.p3.recover_one_s`, `c8.p3.recover_all_s` | Seconds the `docker exec` commands took (one run). |
| `c8.p3.safe_good_changed`, `c8.p3.differs` | Hosts changed by the safe playbook with `ssh_login_grace_time=30`, and whether every hash differs from the first. |
| `c8.p3.rollback_ok` | `rollback.yml` exited 0, 7 hosts answer, and all 7 hashes equal the first ones. |

## What is different on Docker Desktop

Nothing for this part. `docker exec` works the same on Linux, WSL2 and Docker Desktop. On Git Bash for Windows, put `MSYS_NO_PATHCONV=1` in front of a `docker exec` command that has a path in it (`docker exec anp-web1 cat /etc/ssh/sshd_config`), because Git Bash rewrites a leading `/`.

## Stuck?

- `push-safe.yml is not finished yet`: it names the missing TODO. Add it.
- A host is locked out and you want it back: `docker exec anp-web1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'` (use the host's name).
- Everything is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 8`.
