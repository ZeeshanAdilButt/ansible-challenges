# Challenge 8, part 1: serial batches

**Time:** about 40 minutes. **Download:** nothing. The fleet images are already built from challenge 1. This challenge uses seven targets (six web hosts and the database host), so it needs about 1.8 GB of free memory for Docker. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You have six web servers and one config change. If you change all six at once and the change is bad, all six are broken at the same moment, and nobody is left to serve visitors. Real teams change a few servers, look, and only then change more.

Ansible can do this for you. It is one keyword. In this part you use it and you measure what it does: how big each batch is, which hosts are in it, and what it costs in time.

## The idea

A **rolling change** touches a few hosts at a time instead of all at once. In a playbook you write `serial` on the play. A **batch** is the group of hosts that Ansible finishes completely (every task of the play) before it starts the next group.

```yaml
- hosts: web
  serial: [1, 2, 3]     # first 1 host, then 2, then 3
```

Things to know about `serial`:

- A number is a batch size (`serial: 2`). A percentage is a share of all hosts in the play (`serial: "30%"`). A list is a series of sizes.
- If the list is shorter than the hosts need, **the last number repeats**.
- `serial` is about **when** hosts are changed. It is not the same as **forks**, which is how many hosts Ansible talks to at the same time inside one batch (5 by default, said the Ansible docs when we wrote this).
- In the output, every batch prints its own `PLAY [...]` line. That is how you count batches. Inside a batch, the lines are in the order the hosts finished, so that order changes from run to run. The batches themselves follow the inventory order.

## Your task

Open `rollout.yml` in this folder. It changes `/etc/anp-app.conf` on the six web hosts. Add one line to the play: the keyword `serial` with a list, so that the first batch has 1 host, the second 2 hosts and the third 3 hosts. The `TODO` says where.

## Steps

Start the rollout fleet first: `node toolkit/fleet.mjs up --rollout`. It starts `web3` to `web6` next to the three hosts you already know.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-8-roll-it-out/part-1-serial-batches/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-8-roll-it-out/part-1-serial-batches/rollout.yml` | Add the `serial` line. |
| 3 | `node challenges/challenge-8-roll-it-out/part-1-serial-batches/run.mjs` | Starts with `fleet reset`. Runs your playbook, then four other plans (`serial: 2`, `"30%"`, `[1, 2]`, none), then times three plans three times each. Saves the facts. |
| 4 | `node toolkit/show-facts.mjs c8.p1` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-8-roll-it-out/part-1-serial-batches/test.mjs` | The test passes. |

The fleet keeps running after this part, with the new config on the six web hosts. `node toolkit/fleet.mjs rollout-down` stops only `web3` to `web6`. `node toolkit/fleet.mjs down` stops everything.

## What you should see

Your playbook makes three batches:

```text
batch 1: web1
batch 2: web2, web3
batch 3: web4, web5, web6
```

The other plans, on the same six hosts:

| `serial` | Batch sizes | Note |
|---|---|---|
| `[1, 2, 3]` | 1,2,3 | Your playbook. |
| `2` | 2,2,2 | Three batches. |
| `"30%"` | 1,1,1,1,1,1 | 30 percent of 6 is 1.8. Ansible rounds **down**, and never below 1. |
| `[1, 2]` | 1,2,2,1 | The last number repeats, and the last batch holds what is left. |
| none (empty list) | 6 | One batch with every host. |

Smaller batches take longer. The recorded run (one shared machine, so your numbers will differ) took about 19 s with no `serial`, about 25 s with `[1, 2, 3]` and about 31 s with `serial: 1`. Each batch is a new play, and every play has a start-up cost. That is the price of safety, and you decide if it is worth it: change 1 host, check it, then go on.

The full recorded run is in [results.md](results.md).

![Seconds to change six web hosts, by batch plan](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c8.p1.batches`, `c8.p1.batch_sizes`, `c8.p1.batch_hosts` | Your playbook's output: each `PLAY [...]` line starts a batch; the hosts that print a task result after it belong to it. |
| `c8.p1.sizes_serial_2`, `..._percent_30`, `..._list_1_2`, `..._no_serial` | The same count for `variants.yml` with other `serial` values (`-e '{"plan": ...}'`). |
| `c8.p1.seconds_no_serial`, `..._serial_1_2_3`, `..._serial_1` | Wall-clock time of the whole `ansible-playbook` command, median of three runs. |
| `c8.p1.hosts_with_new_config` | Web hosts whose `/etc/anp-app.conf` holds `version=2`, read with `docker exec`. |

## What is different on Docker Desktop

Nothing for this part. Seven targets plus the control container use memory (each target is limited to 256 MB). If Docker Desktop is set to less than 4 GB, raise it in Settings, then Resources.

## Stuck?

- `rollout.yml has no "serial:" line yet`: add the line and run again.
- `Colons in unquoted values must be followed by a non-space character`: a task name has `: ` in it. Take the colon out or put the name in quotes.
- `web3` is not running: `node toolkit/fleet.mjs up --rollout`.
- A host is in a bad state: `node toolkit/fleet.mjs reset` makes every running target new again.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 8`.
