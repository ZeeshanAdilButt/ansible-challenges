# Challenge 10: the capstone

Configure it, ship a change, break it, recover it, defend it. You do the whole job once, on a small system, with everything you learned in challenges 1 to 9.

**Time:** about 6 hours in four parts. **Download:** no image pull (the two fleet images exist from challenge 1). About 6.6 MB in all: nginx and its libraries 2.2 MB, redis and the Python client 1.7 MB, the collection `community.general` 2.7 MB (29 MB on disk once unpacked, inside the control container). Every run of a part starts from new hosts, so the packages are downloaded again each time. **Safety rules:** [SAFETY.md](../../SAFETY.md)

## The system

Three hosts, three groups, three roles:

```text
customer --> web1 (nginx, port 80) --> web2 (the app, port 8080) --> db1 (redis, port 6379, with a password)
             group web                 group app                      group db
```

The app is a small Python service that uses only the standard library. Its `/health` route logs in to redis and sends `PING`. So one request to the proxy tells you whether all three hosts work.

The system is in [capstone-stack](capstone-stack/README.md). It is a starter: the inventory, the playbook that applies the roles, the pipeline script and the app are given. The roles' tasks, handlers and two templates, the vault, the pin, the rollout, the recovery, the runbook and the defence are yours. [capstone-stack/README.md](capstone-stack/README.md) is the brief: read it before part 1.

## What you submit

- Three roles that configure the fleet from a new start, and a second run that changes nothing. (part 1)
- A pipeline run (`ci.mjs`) with seven stages: install the pinned collection, lint, syntax check, apply, a second run that says `changed=0`, check mode, and a health check through the proxy. (part 1)
- A database password in an encrypted vault, and no sign of it in any file or in anything Ansible printed, even with `--diff`. (part 1)
- A rollout of release 2, one host at a time, that stops when one host fails. You see what each play keyword does. (part 2)
- A recovery playbook, a measured time from the stop to the first green check, and a runbook. (part 3)
- A five-minute demo outline with your own numbers, and answers to four questions. (part 4)

## The parts

| Part | What you do | Files you edit (in `capstone-stack`) | Time |
|---|---|---|---|
| [1 configure](part-1-configure/README.md) | Write the three roles, make the vault, pin the collection, pass the pipeline | `roles/*/tasks`, `roles/*/handlers`, `roles/web/templates/nginx.conf.j2`, `roles/db/templates/redis.conf.j2`, `requirements.yml`, `group_vars/all/vault.yml` | 3 h |
| [2 break it](part-2-break-it/README.md) | Roll release 2 across the fleet, with a bad setting, and watch where it stops | `rollout.yml` | 1 h |
| [3 recover it](part-3-recover-it/README.md) | Bring the fleet back, measure it, write the runbook | `recover.yml`, `RUNBOOK.md` | 1.5 h |
| [4 defend it](part-4-defend-it/README.md) | The demo outline and the answers. The whole rubric is scored | `DEFENCE.md` | 1 h |

Each part has the same shape as every other challenge: run the test (it fails), run the script (it measures), edit, run both again.

## The rubric

[rubric.mjs](rubric.mjs) lists every criterion: six areas (fleet configured, idempotence and tests, secrets, rollout safety, recovery, evidence and communication), the points, the part that measures it and a hint. It is code on purpose: part 4's test prints your score, and a mentor reads the same list in [RUBRIC-FOR-MENTORS.md](RUBRIC-FOR-MENTORS.md).

**100 points: 70 are automated and 30 are for the mentor.** The script scores what it can measure on your fleet. The mentor scores what needs your words and a conversation: why the rollout needed more than `serial: 1`, where the vault password lives, whether your runbook works for a stranger, whether your demo is true. To book the review you need 56 of the 70 automated points (80 %). The pass mark after the review is 80 of 100. A mentor does the review in under 45 minutes and asks one to three follow-up questions.

## Run it all in one command, and in CI

```text
node challenges/challenge-10-capstone/tools/capstone-check.mjs
```

It runs parts 1 to 3 and the check of part 4, prints the rubric, and exits with 0 only if **every** automated criterion passes. It took 11 minutes 21 seconds with the reference files on a quiet machine. Allow 25 minutes when other work uses Docker.

[.github/workflows/capstone.yml](../../.github/workflows/capstone.yml) runs the same command on a GitHub runner when you push the tag `capstone-1` (`git tag capstone-1 && git push origin capstone-1`). It builds the fleet on the runner, writes your vault password from the repository secret `CAPSTONE_VAULT_PASSWORD` into the git-ignored `.vault-pass`, and removes the fleet at the end. The maintainer ran it on GitHub on 2026-11-08 with the reference files (start it by hand with the input `reference` set to true): it passed in about 7 minutes and printed `Automated: 70 of 70 points, 100 %`. A push of your tag checks your own files, so your first run is your own and its result depends on your work.

## The practice fleet and the exceptions to the rules

- Everything is on the practice fleet (`anp-control`, `anp-web1`, `anp-web2`, `anp-db1`). No `--privileged`. No Docker socket. No extra containers.
- The collection `community.general` is installed in the control container (`/home/learner/.ansible/collections`) and not in your repository. Unpacking it into the shared folder of Docker Desktop for Windows takes more than an hour.
- The targets have no systemd. `service` works through init scripts. A real server has systemd, and the `service` task would stay the same.

## Out of scope

A real cloud account, a public URL, TLS, Kubernetes, and Molecule (challenge 7 covers it; the capstone pipeline runs against the fleet).
