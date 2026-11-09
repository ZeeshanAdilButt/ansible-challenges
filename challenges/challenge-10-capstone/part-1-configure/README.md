# Challenge 10, part 1: configure the fleet

**Time:** about 3 hours. **Download:** about 6.6 MB each run (nginx 2.2 MB, redis and its Python client 1.7 MB, the collection `community.general` 2.7 MB). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You have three new servers and one afternoon. You could log in to each one and type commands. It would work today. In a month nobody remembers what you typed, and when one server dies the new one is different from the other two.

Writing the setup as Ansible roles fixes that, but it brings three new ways to fail. A playbook that changes something on every run cannot be trusted in a pipeline, because "changed" stops meaning "something happened". A playbook that prints the database password in its output gives the password to everyone who can read the log. And a playbook that installs "the latest" of a collection behaves differently next month.

This part is about doing the setup so that none of those three happens, and proving it with a pipeline.

## The idea

You write three **roles**, one for each kind of host. A role is a folder of tasks, files and templates that does one job. Four patterns make a role something you can trust:

- **A handler runs once, at the end.** A task that changes a config file *notifies* a handler (restart, reload). The handler runs at the end of the play, not right after the task. Your role needs the new config to be live before it checks health, so it runs `meta: flush_handlers` first.
- **A check at the end of the role.** The last task asks the service if it works: the proxy asks for `/health`, the app asks for `/health`, the database role asks redis for its live `maxmemory`. A role that ends with a check fails where the fault is, not three hosts later.
- **A secret has one home.** The password lives in an encrypted **vault** file. Roles read a variable. A template task that writes a file with the secret sets `diff: false`, so `--diff` does not print it. A task that is given the secret sets `no_log: true`.
- **A pin says which version.** `requirements.yml` lists the collection with one exact version. A range is not a pin.

Then a **pipeline** proves it. `ci.mjs` runs seven stages and stops at the first one that fails:

| Stage | What it asks |
|---|---|
| `deps` | Install the pinned collection (skipped when the exact version is already there). |
| `lint` | Does `ansible-lint` at the strict profile `production` find anything? |
| `syntax` | Does `ansible-playbook --syntax-check` accept every playbook? |
| `apply` | Does `site.yml` run on a new fleet with no failed task? It runs with `--diff`. |
| `idempotence` | Does the same `site.yml`, run again, change nothing (`changed=0`)? |
| `check` | Does check mode find nothing to change? |
| `health` | Does the proxy answer 200, with the app and the database behind it? |

**Idempotent** means: run it again and nothing happens. It is the test that tells you your tasks say what they want (`state: present`) and not what to do (`command: ...`).

Why is `check` after `apply`? Check mode asks "what would change?". On a new fleet it cannot answer: the first task that needs something that is not there yet fails. We tried check first and it stopped with `Could not find the requested service redis-server: host`. So the check runs on the finished fleet, where it looks for **drift**.

## Your task

Read [capstone-stack/README.md](../capstone-stack/README.md): it is the brief. Then:

1. Make the vault and the pin (the brief shows how).
2. Write the three roles. Each file you must write has `TODO` comments.
3. Run the pipeline and fix the first red stage, then the next.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-10-capstone/part-1-configure/test.mjs` | The test **fails** on purpose. Read the first message. |
| 2 | Make `.vault-pass`, `group_vars/all/vault.yml` and the pin in `requirements.yml` | The brief, sections "The secret" and "The pin". |
| 3 | Write the roles in `challenges/challenge-10-capstone/capstone-stack/roles` | Start with `db`, then `app`, then `web`: each one needs the one before. |
| 4 | `node challenges/challenge-10-capstone/capstone-stack/ci.mjs` | The pipeline, by hand. The first red stage says what to fix. |
| 5 | `node challenges/challenge-10-capstone/part-1-configure/run.mjs` | Starts from a **new** fleet, runs the pipeline, looks at the live fleet, changes two settings on purpose and puts them back, and searches everything that was printed for the password. Saves the facts. |
| 6 | `node toolkit/show-facts.mjs c10.p1` | Shows the saved numbers. |
| 7 | `node --test challenges/challenge-10-capstone/part-1-configure/test.mjs` | The test passes. |

The fleet keeps running after this part, with the three hosts configured. `node toolkit/fleet.mjs reset` makes them new again.

## What you should see

The pipeline, from the recorded run:

```text
ok       deps            0.9 s  already installed: community.general 13.0.0
ok       lint           38.9 s  Passed: 0 failure(s), 0 warning(s) ... Profile 'production' was required, and it passed.
ok       syntax          4.7 s  site.yml, rollout.yml, recover.yml
ok       apply          34.9 s  changed 14 task(s) on 3 hosts
ok       idempotence    15.5 s  changed=0 on every host
ok       check          16.9 s  no drift: nothing would change
ok       health          0.3 s  200, release 1, app web2, db ok
```

Read it like a doctor reads a chart:

- `apply` changed 14 tasks: 3 on `db1` (the package, the config, the service), 7 on `web2` (the user, three folders, three files, the service and the handler) and 4 on `web1`. A handler counts as one change.
- `idempotence` is the same playbook, 15.5 seconds, `changed=0`. That is the line the rubric weighs most in this part.
- `lint` is the slowest stage by far. It reads many small files, and a shared folder on Docker Desktop for Windows makes that slow.
- `health` is one request to `web1`. The answer says which host the app runs on and that the database answered. Nothing else in the pipeline proves the three hosts work *together*.

After the pipeline, `run.mjs` looks at the live fleet and runs one more thing on purpose: it changes two settings (`-e db_maxmemory_mb=80 -e app_log_level=debug`), runs `site.yml` with `--diff`, and puts them back. A changed file prints its text under `--diff`, so this is the run in which a template without `diff: false` would show the password. (On a new fleet the diff of the redis config is skipped: Ansible does not diff a file over 100 KB, and Debian's default `redis.conf` is one. That is why the small change is needed.)

The live fleet: redis answers `NOAUTH Authentication required.` to a `PING` without the password. The app runs as `capstone`, not root. And it searches every file of the stack, and every line the pipeline printed, for the database password: it finds it zero times. The `apply` stage ran with `--diff`, so if one of your template tasks had forgotten `diff: false`, the password would be in the output and this number would not be 0.

The full recorded run is in [results.md](results.md). Your numbers will be different: timing changes with your machine, and the pipeline ran here while other work used the same Docker. The shape should be the same.

![Seconds each pipeline stage took on a new fleet](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c10.p1.stage_<name>_s` | The seconds each stage of `ci.mjs` took, measured by the script. |
| `c10.p1.lint_ok`, `c10.p1.syntax_ok`, `c10.p1.check_ok`, `c10.p1.check_changed_count` | The result of those stages. The check stage counts `changed=` in its recap. |
| `c10.p1.first_run_changed_count`, `c10.p1.first_run_failed_count`, `c10.p1.hosts_ok_count` | The recap of the `apply` stage: tasks changed, hosts with a failure, hosts that finished clean. |
| `c10.p1.second_run_changed_count`, `c10.p1.runs_to_zero_count` | The recap of the `idempotence` stage. `runs_to_zero_count` is 2 when the second run reached `changed=0`. |
| `c10.p1.health_status`, `c10.p1.health_db`, `c10.p1.health_release` | `GET http://web1/health` from inside the control container. |
| `c10.p1.db_requires_password` | `redis-cli ping` on `db1` without a password answered `NOAUTH`. |
| `c10.p1.app_user`, `c10.p1.app_user_nonroot` | `ps -o user=` on `web2` for the app process. |
| `c10.p1.vault_encrypted`, `c10.p1.secret_in_files_count`, `c10.p1.secret_in_output_count` | The vault file starts with `$ANSIBLE_VAULT`. The script decrypts the vault with your password, then counts the secret in every file of the stack and in everything the pipeline printed. |
| `c10.p1.diff_probe_changed_count` | Tasks changed by the run with two settings changed on purpose and `--diff`. It must be above 0, or the probe proved nothing. |
| `c10.p1.vault_pass_ignored` | `git check-ignore` on `.vault-pass`. |
| `c10.p1.collection_pinned`, `c10.p1.collection_used_count` | `requirements.yml` has exact versions only, and a role calls a module of that collection by its full name. |

## What is different on Docker Desktop

- Every file in the shared folder looks executable (`-rwxrwxrwx`), and `chmod` does nothing. Ansible then runs a vault password file as a program and fails with `Exec format error`. That is why the vault password is read through `vault-pass.sh`. On Linux and WSL2 (inside the Linux file system) a plain password file would work. The script works everywhere.
- Writing thousands of small files into the shared folder is slow: unpacking `community.general` there took more than an hour, so the collection goes into the control container instead (18 seconds).
- The targets have no systemd. `service` works through init scripts. On real servers you would write a systemd unit and keep the same `service` task.
- Never use `docker system prune` to clean up. `node toolkit/cleanup.mjs 10` removes only what this challenge made, and `node toolkit/fleet.mjs reset` makes the hosts new again.

## Stuck?

- `Stopped: roles/web/tasks/main.yml has no tasks yet`: that role still has only the TODO comments. Write the tasks.
- `Exec format error` for the vault password: you passed `.vault-pass` itself as `--vault-password-file`. Pass `vault-pass.sh`.
- `vault_db_password is undefined`: the vault file is missing, or you did not encrypt the right one. It is `group_vars/all/vault.yml`.
- `name[casing]` from lint: a task name must start with a capital letter. `fqcn` means: use `ansible.builtin.apt`, not `apt`.
- The second run changes something: run `node challenges/challenge-10-capstone/part-1-configure/run.mjs`, look for the task that says `changed` in the second recap, or run `ansible-playbook ... -v` by hand. A `command` or `shell` task always says changed unless it has `changed_when`.
- The check stage says it would change something: a task that is not idempotent shows up here as well. Run `ci.mjs --only check` and read the task name.
- redis keeps the old `maxmemory` after a change: read the db step 4 in the brief. `service redis-server restart` cannot stop redis in these containers.

## Next

Part 2 rolls a change across the fleet, with a bad setting, and shows where it stops.
