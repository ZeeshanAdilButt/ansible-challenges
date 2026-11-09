# Challenge 10, part 3: recover it

**Time:** about 1.5 hours. **Download:** about 6.6 MB, once (the run starts from new hosts, and the three rounds after it reuse them). **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

At 3 am the rollout stops. The proxy answers 502. The person who looks at it is tired, did not write the playbooks, and has your runbook open next to a terminal. If the runbook says "check the logs", it has failed. If it says what the symptom looks like, which two commands to type, what normal looks like and what to run, the person is back in bed in ten minutes.

You can only write that page about a failure you have caused yourself and fixed. This part makes you fix one, measure how long it takes, and write it down.

## The idea

To **recover** is to get back to a state you know is good. With Ansible there is a plain way to do it: the playbook that built the fleet, `site.yml`, describes release 1. Running it again puts every setting back, on every host, and changes only what has drifted. That is a **rollback** that needs no special tool, as long as your roles are idempotent (part 1 proved they are).

Three things make a recovery you can trust:

- **Every host answers first.** If the failure also took a host off the network, a playbook that starts at once fails on that host. `ansible.builtin.wait_for_connection` waits until SSH works again, with a timeout.
- **Put back the whole fleet, not only the broken host.** The rollout changed the proxy host before it stopped. If you fix only the app host, the fleet is on two releases. After a good recovery the proxy header, the app's `/health` and `site.yml` all agree on release 1.
- **A health check ends the job.** Recovery is not done when the playbook ends. It is done when the proxy answers 200 with the app and the database behind it. The check retries, because the app needs a second to start.

And a measurement: **minutes to recover**. The script stops its clock at the first 200 from the proxy and starts it when your rollout stopped. That is script time. A person adds the time to read, think and type, which a script cannot measure. Do not quote it as the time of a person.

## Your task

1. Open `challenges/challenge-10-capstone/capstone-stack/recover.yml`. It has three `TODO` comments. Write the plays: wait for every host, put release 1 back, check the proxy.
2. Open `challenges/challenge-10-capstone/capstone-stack/RUNBOOK.md`. It explains the template. After the run (step 3 below) write two entries under `## Entries`: **a rollout stopped on a failed host** and **the site returns 502**. Use the numbers from your own run.

## Steps

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-10-capstone/part-3-recover-it/test.mjs` | The test **fails** on purpose. |
| 2 | Write `challenges/challenge-10-capstone/capstone-stack/recover.yml` | Three small plays. |
| 3 | `node challenges/challenge-10-capstone/part-3-recover-it/run.mjs` | 3 to 8 minutes: new hosts, `site.yml`, then three rounds of break it and recover it. Reads your runbook at the end. |
| 4 | Write the two entries in `RUNBOOK.md` | The run printed the numbers to quote. |
| 5 | `node challenges/challenge-10-capstone/part-3-recover-it/run.mjs` | Again: it measures again and compares each **Measured:** number with it. |
| 6 | `node --test challenges/challenge-10-capstone/part-3-recover-it/test.mjs` | The test passes. |

What step 3 does, in each of three rounds: runs **your** `rollout.yml` with the bad setting (it must fail on exactly one host), reads the proxy's answer (502), runs **your** `recover.yml`, then asks the proxy for `/health` once a second until it answers 200. The time from the stop to that 200 is one measurement. After the three rounds it runs `site.yml` once more: it must change nothing, and the app and the proxy must both say release 1.

The fleet is left healthy, on release 1.

## What you should see

From the recorded run:

```text
run 1: down answered 502, recovered in 22.7 s, recover.yml ok
run 2: down answered 502, recovered in 22 s, recover.yml ok
run 3: down answered 502, recovered in 20.5 s, recover.yml ok
```

The median (22 s, which is 0.37 minutes) is the number to quote. The recovery made three changes on the app host (the settings file, the service, which had to be started again, and the restart handler) and two on the proxy host (the config and the reload): `web2 changed=3`, `web1 changed=2`, `db1 changed=0`. The proxy host went back too, though it had not failed.

After the three rounds, `site.yml` says `changed=0` on every host. That is the proof that the recovery ended in the state the playbook describes.

The two runbook entries are checked for their shape (every field has words, the **Check** field has commands in backticks) and for their numbers: the stopped-rollout entry says how many hosts changed before the stop (`1 host`, the number from part 2), and the 502 entry says how many seconds the recovery took (within 15 seconds or half again, whichever is more, of the median). A mentor reads whether a stranger could follow them.

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Seconds from the stop of the rollout to the first 200 from the proxy](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c10.p3.recover_s`, `c10.p3.recover_min`, `c10.p3.recover_runs_s` | For each round: the seconds from the moment your rollout stopped to the first 200 on `GET http://web1/health`. The median of three rounds, in seconds and in minutes. |
| `c10.p3.recovered`, `c10.p3.recover_health_status` | Every round ended with a 200, and `recover.yml` itself finished without a failure. The last status is 200. |
| `c10.p3.down_status` | The proxy's answer right after the rollout stopped (502). |
| `c10.p3.zero_after_recover_changed_count` | `changed` summed over the recap of `site.yml`, run after the last round. |
| `c10.p3.release_after_recover`, `c10.p3.proxy_release_after_recover` | The app's `release` in `/health` and the proxy's `X-Capstone-Release` header, after the last round. Both must be `1`. |
| `c10.p3.runbook_entries_count`, `c10.p3.runbook_complete_count`, `c10.p3.runbook_numbers_match` | Entries found under `## Entries`, entries with every field filled, and whether each **Measured:** number matches this run (hosts changed before the stop from part 2, seconds to recover from this part). |

## What is different on Docker Desktop

Nothing here depends on Docker Desktop. The targets are small containers on one private network, so a recovery takes seconds. A real recovery takes the time of every host you have to reach, and the time of a person. Say that when you quote the number.

## Stuck?

- `The rollout with a bad setting should fail on exactly one host`: part 2 does not pass yet. Run it first.
- `recover.yml is empty`: write it. The first lines are the `TODO` comments.
- `recovered ... false`: `recover.yml` did not bring the proxy back within 60 seconds, or a round ended with an error. Run `node toolkit/ansible.mjs ansible-playbook -i ... recover.yml -v` by hand after a rollout with the bad setting.
- `site.yml still changes N tasks after the recovery`: your recovery did not end in the state of release 1. Which host was left on release 2? The proxy host.
- `no entry found` for the runbook: put the entries after the line `## Entries`. The title of the first must contain "rollout" (or "stopped" or "batch"). The second must not contain those words, for example "The site returns 502".
- `does not match`: copy the numbers from the run: hosts changed before the stop, written as `1 host`, and seconds, written as `19.5 s`.

## Next

Part 4 is the defence: five minutes, five numbers of your own, and four questions.
