# Challenge 2, part 3: the shell that never converges

**Time:** about 60 minutes. **Download:** about 1.8 MB of Debian packages (curl and a few libraries) for each web host, three times, because the run makes new servers for each of the three versions: about 11 MB in all. No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You know `ssh` and shell commands. So when you write your first playbook, it is tempting to put what you know into it: `shell: echo ... >> file`, `shell: apt-get install -y curl`, `command: mkdir -p /opt/myapp`. It works. The first run does the job.

Then you run it again, and Ansible says `changed` for every task. You run it a third time. Still `changed`. Now the recap never reaches `changed=0`, so you can never tell the difference between "nothing to do" and "something went wrong". And one of those tasks is doing real damage each time. Which one?

## The idea

A **module** such as `apt`, `file` or `lineinfile` looks at the server first. It compares what is there with what you asked for. If they match, it does nothing and says `ok`. That check is the whole point of a module.

`shell` and `command` do not look. They run what you wrote, every time, and Ansible cannot tell what the command did. So it assumes the worst and says `changed`. This is the reason `uptime` said `CHANGED` in challenge 1 and `redis-cli ping` said `CHANGED` in part 1.

You have three ways to write the same job:

1. **Shell and command.** Simple. Never converges. Some commands also do harm when they repeat (an append adds a line each time).
2. **A module.** The right answer when a module exists. It converges by design.
3. **Shell or command with guards.** Sometimes no module fits, or you must keep a command. Then you teach Ansible what it cannot guess:
   - `creates: <path>` under `args:` means "if this path already exists, skip the command". Ansible says `ok`.
   - `changed_when: false` means "this command only reads, never call it a change".

Be careful with `creates`. It checks one path and nothing else. If the file exists with the wrong content, the command is still skipped. A module is better when one exists.

## Your task

Three playbooks do the same job on the web hosts: put one line in `/etc/myapp.conf`, install curl, make the folder `/opt/myapp`, and read the settings file.

- `shell-version.yml` is written for you. Do not change it.
- `module-version.yml` is empty. Write it with `lineinfile`, `apt` and `file`. The `TODO` lines tell you how.
- `creates-version.yml` is empty. Keep `shell` and `command`, and add the guards. The `TODO` lines tell you how.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `module-version.yml` and `creates-version.yml` in `challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/` | Write the two fixed versions. |
| 3 | `node challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/run.mjs` | For each version: `fleet reset`, then three runs of the playbook, then a look at `/etc/myapp.conf`. Saves the facts. |
| 4 | `node toolkit/show-facts.mjs c2.p3` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/test.mjs` | The test passes. |

The fleet keeps running after this part, with the last version applied (curl installed, the folder made, one line in the settings file). `node toolkit/fleet.mjs reset` removes it again.

## What you should see

**Shell and command.** Four tasks on two hosts, so eight changes, three runs in a row:

```text
Shell and command, run 1: 8 changes in total (web1 4, web2 4).
Shell and command, run 2: 8 changes in total (web1 4, web2 4).
Shell and command, run 3: 8 changes in total (web1 4, web2 4).
```

The fourth task only reads a file, and still says `changed`. And the settings file now holds the same line three times:

```text
app_mode=production
app_mode=production
app_mode=production
```

`changed` on every run is not only noise. Here it is true for one task: the append really did run three times.

**Modules.** The first run changes three tasks on two hosts (six). Then nothing:

```text
Modules, run 1: 6 changes in total (web1 3, web2 3).
Modules, run 2: 0 changes in total (web1 0, web2 0).
Modules, run 3: 0 changes in total (web1 0, web2 0).
```

The settings file holds one line.

**Shell and command with guards.** The same shape. Six changes, then zero, then zero. A task that is skipped because its `creates` path exists says `ok`, not `skipping`. The read task says `ok` because of `changed_when: false`. The file holds one line.

The full recorded run is in [results.md](results.md). Your numbers will be the same.

![Changes per run for three ways to write the same job (both web hosts added up)](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c2.p3.shell_changed_run1`, `..._run2`, `..._run3` | `changed=` in the PLAY RECAP of runs 1, 2 and 3 of `shell-version.yml`, added up over `web1` and `web2`. |
| `c2.p3.module_changed_run1`, `..._run2`, `..._run3` | The same, for `module-version.yml`. |
| `c2.p3.creates_changed_run1`, `..._run2`, `..._run3` | The same, for `creates-version.yml`. |
| `c2.p3.shell_conf_lines`, `c2.p3.module_conf_lines`, `c2.p3.creates_conf_lines` | Lines in `/etc/myapp.conf` on `web1` after the three runs, read with an ad hoc `cat`. |
| `c2.p3.playbook_dir` | The folder the run used. The test reads it again and counts the tasks. |

## What is different on Docker Desktop

Nothing for this part. Package downloads use your internet connection.

## Stuck?

- `has 0 task(s) and needs 3` (or 4): the file still has only TODO lines. Write the tasks.
- `c2.p3.creates_changed_run2 should be 0`: one task is still changing things. Add `creates:` to all three of the first tasks and `changed_when: false` to the read task. `creates:` goes under an `args:` block when you use `shell`.
- `c2.p3.module_changed_run3 should be 0`: you probably used `shell` or `command` in `module-version.yml`. Use `lineinfile`, `apt` and `file`.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 2`.
