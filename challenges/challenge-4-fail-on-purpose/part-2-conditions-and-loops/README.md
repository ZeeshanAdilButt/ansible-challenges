# Challenge 4, part 2: conditions and loops

**Time:** about 60 minutes. **Download:** about 2 MB of Debian packages per host (nginx on the web hosts, sqlite3 on db1, and two small tools on all three). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You have three servers and they are not the same. The web servers need nginx. The database server needs sqlite3. Everyone needs the same two tools and the same three user accounts. If you write one task per package and one per user, the playbook grows and you copy mistakes. If you run every task on every host, you install nginx on the database server.

Also, some things take time. A service you just started is not ready yet. A playbook that asks too soon fails, although nothing is wrong.

## The idea

Three tools:

- **`loop`** runs one task once for each item in a list. Inside the task the current item is called `item`. A list of dictionaries gives `item.name`, `item.shell` and so on. `loop_control` with `label` makes the output print a short name instead of the whole dictionary.
- **`when`** runs a task only if a condition is true. A false condition **skips** the task: it is not an error. The condition can use the group names of the host (`'web' in group_names`) or a **fact**, a value Ansible read from the host (`ansible_facts['os_family']`).
- **`until`** repeats a task until a condition is true. `retries` says how many times to try again, and `delay` says how many seconds to wait between tries.

The recap at the end of a run has a `skipped` column. It counts **tasks**, not items.

## Your task

Open `site.yml` in this folder. It works, but it does only part of the job. Do the four `TODO` lines:

1. Install both packages from `common_packages` with a loop, not only `tree`.
2. Create all three users from `users` with a loop and a `loop_control` label.
3. Run the nginx task only on hosts in the group `web`, and the sqlite3 task only on hosts in the group `db`.
4. Make the wait task try again with `until`, `retries: 10` and `delay: 2`. Without it the task fails on its first try, because nginx starts 7 seconds late.

`site.yml` has a condition on a fact for you already (the "Red Hat" task). The other playbooks in this folder are given.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/site.yml` | Do the four TODOs. |
| 3 | `node challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/run.mjs` | Starts with `fleet reset`. Runs your playbook, lists what each host has, runs a wait with too few retries, and counts real attempts. Saves the facts. About 4 minutes. |
| 4 | `node toolkit/show-facts.mjs c4.p2` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/test.mjs` | The test passes. |

If run.mjs stops with a message about a TODO, do that TODO and run it again. The message says which one.

## What you should see

The loops print one line per item and host:

```text
TASK [Install the common packages] *********************************************
changed: [web2] => (item=tree)
changed: [web1] => (item=tree)
changed: [db1] => (item=tree)
changed: [web2] => (item=jq)
...
```

The conditions print `skipping` for hosts that do not match:

```text
TASK [Install nginx on web hosts] **********************************************
skipping: [db1]
changed: [web2]
changed: [web1]
```

The wait task prints a `FAILED - RETRYING` line for each try that did not work, and then `ok`. That is not an error. The number of those lines is the number of **retries used**. It depends on how fast your machine is (we saw 2 and 3).

The recap shows `skipped=2` on each host: db1 skipped the nginx task and the Red Hat task, web1 and web2 skipped the sqlite3 task and the Red Hat task. Six skipped tasks in total.

Two surprises about `retries`, both measured:

- `retries: 3` means **one try and then three retries**, so four real runs. The failure message of the playbook `count-attempts.yml` says `"attempts": 3`, but the file on the host that counts the real runs says 4. The message is one short.
- `too-few-retries.yml` waits for nginx with `retries: 3` and `delay: 1`, and nginx needs 25 seconds. The play fails on both web hosts with `Connection refused`.

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Loops, skips and retries in one run](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c4.p2.loop_items`, `c4.p2.user_items` | The `(item=...)` lines of the package task and of the user task, for web1. |
| `c4.p2.skipped`, `c4.p2.skipped_db1`, `c4.p2.skipped_web1` | The `skipped=` column of the play recap, in total and per host. |
| `c4.p2.nginx_hosts`, `c4.p2.sqlite3_hosts`, `c4.p2.hosts_with_all_users` | What `report.yml` prints for each host after the run. |
| `c4.p2.retries_used` | `FAILED - RETRYING` lines for web1 or web2 (the larger one) in the first run. |
| `c4.p2.few_retries_attempts`, `c4.p2.few_retries_failed_hosts` | The `"attempts"` value and the recap of `too-few-retries.yml`. |
| `c4.p2.count_reported_attempts`, `c4.p2.count_real_attempts` | The `"attempts"` value of `count-attempts.yml`, and the number in the counter file `/tmp/attempts` on web1. |

## What is different on Docker Desktop

Nothing for this part. Package downloads use your internet connection. The "slow service" is nginx started by a background command, so it works on any host.

## Stuck?

- `The wait task failed on its first try`: do TODO 4. Without `until` Ansible tries once.
- `"Install the common packages" ran 1 time(s) per host`: do TODO 1. The task needs a `loop`.
- `Error while resolving value for 'name': 'item' is undefined`: you used `{{ item }}` in a task that has no `loop`.
- `No package matching 'nginx' is available`: the package list in the image is old. Rebuild it with `docker compose -f fleet/compose.yaml build --no-cache`.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 4`.
