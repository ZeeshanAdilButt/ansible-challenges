# Challenge 10, part 2: break it

**Time:** about 1 hour. **Download:** about 6.6 MB each run, because the run starts from new hosts (see part 1). **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Release 2 is ready. It changes one setting on each kind of host. You could run `site.yml` with the new values and let Ansible change all three hosts at once. Most of the time that works. One day a setting is wrong on one host, and at once, all three hosts have the same wrong setting. The site is down, and every host you would use to compare is down too.

A **rollout** changes hosts in small batches, so that a bad change is found on one host while the others still work. It only helps if the rollout stops when a host fails.

You can only learn what stops a rollout by breaking one. This part breaks it on purpose, seven ways, and counts what each way changed.

## The idea

Three words from the Ansible play:

- **`serial: N`** is the batch size. With `serial: 1` Ansible runs the whole play on one host, then the next. Without it, every host runs at once.
- **`any_errors_fatal: true`** says: when a task fails on any host, stop the play on all hosts.
- **`max_fail_percentage: P`** says: stop the play when more than P percent of the hosts **in the current batch** have failed.

And one rule that is easy to miss: Ansible ends the play on its own when *every* host of a batch has failed. With batches of one host, a failed host is the whole batch.

The release is in `vars/release-2.yml`. Its three settings are one for each host: the nginx `worker_connections`, the app's `log_level`, redis's `maxmemory`. The bad change is one more setting on the command line: `-e app_log_level=verbose`. The app only accepts `debug`, `info`, `warning` or `error`. It reads its settings when it starts and stops at once on the wrong word. The init script notices that the app died and fails, so Ansible sees it.

The order of the hosts is the order of the inventory: `web1` (proxy), `web2` (app), `db1` (database). So the rollout reaches the proxy first, then the app, and the app is the one that fails.

## Your task

Open `challenges/challenge-10-capstone/capstone-stack/rollout.yml`. The play is almost written. Two `TODO` comments are the two lines that make it a safe rollout: the batch size, and a keyword that says in words that a failure stops everything. Add them. Pick one of the two keywords and be ready to say why. (The drills in this part show what each does.)

## Steps

The fleet must be running, and part 1 must pass (the rollout changes the roles you wrote).

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-10-capstone/part-2-break-it/test.mjs` | The test **fails** on purpose. |
| 2 | Edit `challenges/challenge-10-capstone/capstone-stack/rollout.yml` | Add `serial` and one stop keyword. |
| 3 | `node challenges/challenge-10-capstone/part-2-break-it/run.mjs` | 5 to 10 minutes, depending on how busy your machine is. See below. |
| 4 | `node toolkit/show-facts.mjs c10.p2` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-10-capstone/part-2-break-it/test.mjs` | The test passes. |

What step 3 does, in order:

1. Makes the hosts new and runs `site.yml` (release 1).
2. Runs **your** `rollout.yml` with the good release 2. It counts the batches and the hosts changed, and asks the proxy which release it reports.
3. Puts release 1 back, then runs **your** `rollout.yml` with the bad setting. It counts the hosts that changed before the stop, the host that failed, and the hosts it never reached. It asks the proxy for `/health`.
4. Seven **drills**: the same bad setting and the same fleet, with a play header written by the script: no `serial`; `serial: 1` alone; `serial: 1` with each stop keyword; `serial: 2` alone; `serial: 2` with each stop keyword. Before each drill it puts release 1 back with `site.yml`.
5. Puts release 1 back one last time. **The fleet is left healthy, on release 1.**

## What you should see

The good rollout runs in three batches of one host, changes all three hosts, and the proxy then says `X-Capstone-Release: 2`.

The bad rollout, with `serial: 1` and `any_errors_fatal: true`:

```text
web1: ok=7  changed=2  failed=0     (the nginx config changed and nginx was reloaded)
web2: ok=8  changed=1  failed=1     (the app settings changed, the restart failed)
db1:  not in the recap: it was never reached
```

The failing line is the restart handler of the app: `capstone-app stopped right after it started` and the last lines of its log, which say `unknown log_level 'verbose', use one of: debug, info, warning, error`. The proxy now answers **502**, because the app behind it is gone. The proxy host was already on release 2. So the rollout left three hosts in three different states: the proxy changed, the app broken, the database untouched.

The drills, from the recorded run:

```text
no serial: every host at once            changed 2  failed 1  never reached 0
serial: 1 and nothing else               changed 1  failed 1  never reached 1 (db1)
serial: 1 and max_fail_percentage: 25    changed 1  failed 1  never reached 1 (db1)
serial: 1 and any_errors_fatal: true     changed 1  failed 1  never reached 1 (db1)
serial: 2 and nothing else               changed 2  failed 1  never reached 0
serial: 2 and max_fail_percentage: 25    changed 1  failed 1  never reached 1 (db1)
serial: 2 and any_errors_fatal: true     changed 1  failed 1  never reached 1 (db1)
```

Read it in three steps:

- **No `serial`:** every host ran at once. Two hosts changed, one failed, none was spared. Nothing protected the fleet.
- **`serial: 1`, with or without a keyword:** it stopped. The failed host was the only host of its batch, so the whole batch failed and Ansible ended the play. Many people expect `serial: 1` alone to drop the failed host and carry on. It does not: the rows say so.
- **`serial: 2`:** the batches are `web1` and `web2`, then `db1`. Alone, `serial: 2` lets `web2` fail and then **goes on to the next batch**: `db1` changed (changed 2, never reached 0). With `max_fail_percentage: 25` it stops, because one failure in a batch of two is 50 %, and 50 is more than 25. With `any_errors_fatal: true` it stops.

So the keyword you chose is the one that keeps working when somebody changes `serial: 1` to `serial: 2` next month. Say it in the file, in words.

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Hosts never reached after one host failed, by play header](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c10.p2.good_batch_sizes`, `c10.p2.good_batches_count` | Hosts that printed a result between one `PLAY [Roll out release 2]` line and the next, one group for each batch. |
| `c10.p2.good_changed_count`, `c10.p2.good_failed_count` | The recap of your rollout: hosts with `failed=0` and `changed` above 0, hosts with `failed` above 0. |
| `c10.p2.good_release`, `c10.p2.good_proxy_release` | `GET http://web1/health` (the app's answer) and the header `X-Capstone-Release` (the proxy's). |
| `c10.p2.bad_changed_before_stop_count`, `c10.p2.bad_failed_count`, `c10.p2.bad_untouched_count` | The same recap for the bad run. "Untouched" is a host of the fleet that is not in the recap at all. |
| `c10.p2.bad_failed_host`, `c10.p2.bad_failed_task` | The first `fatal:` line and the task or handler header above it. |
| `c10.p2.bad_health_status` | The proxy's answer to `/health` after the stop (502). |
| `c10.p2.drill_<name>_changed_count`, `_failed_count`, `_untouched_count`, `_s` | The same recap for each drill, and the seconds it took. |
| `c10.p2.rollout_stop_keyword` | Whether the lines of your `rollout.yml` that are not comments hold `any_errors_fatal: true` or `max_fail_percentage:`. |
| `c10.p2.baseline_s`, `c10.p2.good_s`, `c10.p2.bad_s` | Seconds for `site.yml` on new hosts, the good rollout, and the bad rollout up to its stop. |

## What is different on Docker Desktop

Nothing in this part depends on Docker Desktop. The numbers in seconds depend on your machine. Hosts always run in the order of the inventory, and the three hosts are small containers, so a rollout here is much faster than on real servers.

## Stuck?

- `failed 0` in the bad run: the setting did not fail. Run `node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/rollout.yml -e app_log_level=verbose -v` and read the app's log line.
- The batch sizes are `3`: there is no `serial: 1` in your play (or it is under `tasks`). It is a play keyword, at the same level as `hosts`.
- `rollout_stop_keyword` is `none`: the keyword is missing or still a comment. Remove the `#`, or write `any_errors_fatal: true`.
- `site.yml failed, so the rollout drills have no starting point`: part 1 does not pass. Run its `run.mjs` first.
- A drill left the app broken: the next step puts release 1 back. If the run was interrupted, run `site.yml` once by hand.

## Next

Part 3 breaks it the same way, then you bring the fleet back, and measure how long that takes.
