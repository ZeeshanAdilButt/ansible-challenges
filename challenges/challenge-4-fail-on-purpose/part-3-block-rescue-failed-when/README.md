# Challenge 4, part 3: block, rescue and failed_when

**Time:** about 60 minutes. **Download:** none. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

One of your three servers is not like the others. The two web servers have a file `/srv/app/version`. The database server does not. A task that reads the file works on two hosts and fails on the third.

What should Ansible do? There are four answers, and they are very different:

1. Do nothing special. The failed host drops out of the play.
2. Ignore the error. The host goes on, as if the file was there.
3. Handle the error. Repair what you can, and keep the host in the play in a known state.
4. Say what "failed" means. A command can exit with 0 and still be wrong.

You will run all four on the same fleet and compare the recaps.

## The idea

- By default a task that fails stops **that host**. The other hosts go on. At the end the exit code of `ansible-playbook` is 2.
- **`ignore_errors: true`** on a task: the failure is noted (the recap counts it as `ignored`), and the host goes on to the next task.
- **`block`** groups tasks. If one of them fails, the **`rescue`** tasks run for that host. The **`always`** tasks run in every case, with or without a failure. A host that was rescued counts as `rescued` in the recap, not as `failed`, and the exit code is 0.
- **`failed_when`** replaces Ansible's own idea of failure for one task. You write a condition on the result (here: the text the command printed). If it is true, the task failed.

The recap at the end has five numbers per host that matter here: `ok`, `changed`, `failed`, `rescued` and `ignored`.

## Your task

Four playbooks live in this folder. `plain.yml` is given. You change the other three, each one at its `TODO`:

1. `ignore.yml`: add `ignore_errors: true` to the task that reads the version.
2. `block-rescue.yml`: put the two tasks in a `block`, add a `rescue` with two tasks (write `/tmp/needs-deploy`, then say so), and an `always` with one task (write `/tmp/last-run`). The comment in the file lists the exact modules.
3. `failed-when.yml`: add one line, `failed_when`, so that the task fails when the output does not contain `2.4.1`. web2 has version `2.4.0`.

`setup.yml` is given too. It writes the version file on the web hosts only.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit the three files | Do the three TODOs. |
| 3 | `node challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/run.mjs` | Starts with `fleet reset`, runs `setup.yml`, then the four versions one after the other. About 1 minute. |
| 4 | `node toolkit/show-facts.mjs c4.p3` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/test.mjs` | The test passes. |

If run.mjs stops with a message about a file, do that TODO and run it again.

## What you should see

Counts are summed over the three hosts (web1, web2, db1).

| Version | ok | changed | failed | rescued | ignored | Exit code | Hosts that reach the last task |
|---|---|---|---|---|---|---|---|
| `plain.yml` | 4 | 0 | 1 | 0 | 0 | 2 | 2 (web1, web2) |
| `ignore.yml` | 6 | 0 | 0 | 0 | 1 | 0 | 3 |
| `block-rescue.yml` | 9 | 4 | 0 | 1 | 0 | 0 | 2 |
| `failed-when.yml` | 2 | 0 | 2 | 0 | 0 | 2 | 1 (web1) |

What the table says:

- **Plain** is honest. db1 failed, the exit code says so, and the last task did not run there.
- **ignore_errors** is quiet. The exit code is 0, `failed` is 0, and db1 **ran the last task**, "Deploy finished on db1", although its version file does not exist. The recap counts the ignored task as `ok` too (db1 shows `ok=2 ignored=1`). If you ignore an error, you must be sure nothing later depends on it.
- **block and rescue** keep the play going on purpose. db1 shows `rescued=1` and `failed=0`, and the exit code is 0. db1 did **not** run the rest of the block (the last task), but its rescue ran and left a file that says "db1 needs a deploy". A recap with a green exit code and `rescued=1` is a reminder to look at what was rescued.
- **failed_when** makes web2 fail too: `cat` printed `2.4.0` and exited 0, but the text is wrong. The two failures even print two different first words: db1 says `Module failed`, and web2 says `Action failed`, followed by `A 'failed_when' expression evaluated to 'True'.` for web2.

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Failed hosts and hosts that reached the last task, per version](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c4.p3.<version>_ok`, `_changed`, `_failed`, `_rescued`, `_ignored` | The columns of the `PLAY RECAP`, added up over the three hosts. The versions are `plain`, `ignore`, `rescue` and `failedwhen`. |
| `c4.p3.<version>_exit_code` | The exit code of `ansible-playbook`. |
| `c4.p3.<version>_announce_hosts` | Hosts that print `ok` for the task "Announce the deploy". |
| `c4.p3.marker_written` | `cat /tmp/needs-deploy` on db1 after the rescue run. |

## What is different on Docker Desktop

Nothing for this part.

## Stuck?

- `ignore.yml: no task was ignored`: add `ignore_errors: true` to the task, with the same indent as `register:`.
- `block-rescue.yml: nothing was rescued`: the tasks must be **inside** a `block:` and `rescue:` must be at the same indent as `block:`.
- `failed-when.yml: 0 host(s) failed`: `failed_when` takes a condition. This one works: `"'2.4.1' not in app_version.stdout"`.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 4`.
