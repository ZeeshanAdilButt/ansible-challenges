# Challenge 8, part 2: stop on failure

**Time:** about 45 minutes. **Download:** nothing. The fleet images are already built from challenge 1. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You push a change to six web servers. On one of them the change is bad, and it fails. What happens to the other five? And what happens to the servers that Ansible has not reached yet?

Many people believe that "rolling" (a few servers at a time) means "stops when something breaks". It does not. In this part you test that belief, and then you find the settings that really stop a rollout.

## The idea

You already know `serial` from part 1: it splits the hosts into **batches**. Three more settings decide what a failure does:

- **Default rule.** When a host fails, Ansible takes only that host out of the play. The other hosts go on. With `serial`, the play stops only if **every host of a batch** failed.
- `max_fail_percentage` stops the play when more than this share of a batch failed. The failed share must be **more than** the number, not equal to it (the Ansible docs say so, and the run below uses 30). With `serial: 2`, one failed host is 50 percent.
- `any_errors_fatal: true` stops the play on every host after the first failure. Ansible still finishes the failing **task** on the rest of the batch first.

The change in this part writes a config file with `copy` and a `validate:` command. **validate** runs a check on a temporary copy of the file before the real file is replaced. If the check fails, the real file stays as it was. `web3` gets `workers=0` and the check refuses it. So `web3` fails, and nothing else is wrong.

A second task, "Restart the app", comes after the config task. We use it to see **half done** hosts: hosts that got the new config but never ran the restart.

## Your task

Open `my-rollout.yml` in this folder. Add two keywords to the play (the `TODO` says where):

1. `serial` with the number 2.
2. `max_fail_percentage` with a number that stops the play when one host of a batch of two fails.

## Steps

Start the rollout fleet first if it is not running: `node toolkit/fleet.mjs up --rollout`.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-8-roll-it-out/part-2-stop-on-failure/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-8-roll-it-out/part-2-stop-on-failure/my-rollout.yml` | Add the two keywords. |
| 3 | `node challenges/challenge-8-roll-it-out/part-2-stop-on-failure/run.mjs` | Starts with `fleet reset`. Puts the old config (version 1) on the six web hosts, then pushes version 2 eight times, with different settings. The last push is your file. Counts changed, failed and untouched hosts each time. |
| 4 | `node toolkit/show-facts.mjs c8.p2` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-8-roll-it-out/part-2-stop-on-failure/test.mjs` | The test passes. |

The fleet keeps running after this part. The web hosts hold whatever the last push left.

## What you should see

Six web hosts, `web3` is the bad one. For each setting, how many hosts ended up **changed** (new config written), **failed** and **untouched** (still on the old config):

| Setting | Changed | Failed | Untouched | Half done |
|---|---|---|---|---|
| no `serial` | 5 | 1 | 0 | 0 |
| `serial: 2` | 5 | 1 | 0 | 0 |
| `serial: 1` | 2 | 1 | 3 | 0 |
| `serial: 2`, `max_fail_percentage: 30` | 3 | 1 | 2 | 1 |
| `max_fail_percentage: 10`, no `serial` | 5 | 1 | 0 | 5 |
| `any_errors_fatal` | 5 | 1 | 0 | 5 |
| `serial: 2`, `any_errors_fatal` | 3 | 1 | 2 | 1 |

What this teaches:

- **`serial: 2` alone did not stop anything.** `web3` failed in batch 2, its partner `web4` went on, and batch 3 ran. Five hosts changed. Only `serial: 1` stops, because a batch of one that fails is a batch where every host failed.
- **`max_fail_percentage` needs `serial` to protect you.** With `serial: 2` and `30`, the play stopped after batch 2 and `web5` and `web6` were never touched. Without `serial`, the failing task has already run on every host when the failure is counted.
- **Stopping can leave hosts half done.** `any_errors_fatal` and `max_fail_percentage` stop the play, but the hosts that had already finished the first task keep the new config, and the restart never runs. `web4` is half done in the `serial: 2` runs. In the runs without `serial`, five hosts are.
- A failed `validate` prints a short message (`failed to validate`) and nothing else, because `grep -q` prints nothing. A real validator should print a reason.

The full recorded run is in [results.md](results.md). Order of lines inside one batch changes from run to run. The counts should not.

![Hosts changed and untouched by setting](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c8.p2.changed_<setting>` | Web hosts whose `/etc/anp-app.conf` holds `version=2` after the push, read with `docker exec`. |
| `c8.p2.failed_<setting>` | Hosts with `failed=1` or `unreachable=1` in the `PLAY RECAP`. |
| `c8.p2.untouched_<setting>` | Hosts that neither changed nor failed. |
| `c8.p2.half_done_<setting>` | Changed hosts whose recap shows fewer than 2 ok tasks: the restart did not run. |
| `c8.p2.changed_yours`, `c8.p2.untouched_yours` | The same numbers for your `my-rollout.yml`. The test needs `failed_yours` to be 1 and `untouched_yours` to be at least 2. |

`<setting>` is `no_serial`, `serial`, `serial_1`, `max_fail`, `max_fail_only`, `any_fatal`, `serial_any_fatal` or `yours`.

## What is different on Docker Desktop

Nothing for this part.

## Stuck?

- `my-rollout.yml needs a "serial:" line`: add both keywords and run again.
- Your play stops too late (the test says `untouched_yours` is 0): check `max_fail_percentage`. The failed share (50 percent) must be **more than** your number.
- `Colons in unquoted values must be followed by a non-space character`: a task name has a `: ` in it. Remove the colon or put the name in quotes.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 8`.
