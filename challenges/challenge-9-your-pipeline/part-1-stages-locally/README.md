# Challenge 9, part 1: the stages, locally

**Time:** about 60 minutes. **Download:** about 4 MB the first time (three Ansible collections that Molecule needs, from galaxy.ansible.com). The Molecule test container uses `python:3.12-slim-bookworm`, which the fleet build already pulled. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Last Friday someone ran the playbook from a laptop. It had a typo in a task. It also ran against the wrong inventory, the real servers, instead of the practice ones. Nobody had linted it, nobody had tested the role, and nobody had run it twice to see that the second run is quiet.

A **pipeline** fixes this. It is the same checks, in the same order, every time, and it stops at the first one that fails. In this part you run the pipeline on your own machine. Part 2 puts it on GitHub.

## The idea

A pipeline is a list of **stages**. Each stage is a command that either passes or fails. The pipeline stops at the first failure, because running `apply` after a failed `lint` makes no sense. Our six stages, cheapest first:

| Stage | What it does |
|---|---|
| `lint` | `ansible-lint` with the `production` profile (the strictest). Finds style and safety problems without running anything. |
| `syntax-check` | `ansible-playbook --syntax-check`. Does the playbook parse? |
| `molecule` | Molecule starts a throwaway container, runs the role in it, runs it a second time to check it changes nothing, runs your `verify` checks, and removes the container. |
| `check-mode` | `ansible-playbook --check --diff` against the fleet. Shows what would change, changes nothing. |
| `apply` | The real run. |
| `second-run` | The real run again. It must report **0 changed** hosts. If it does not, the playbook is not idempotent. |

**A guard** is a first play that stops the run if something is wrong before any host is touched. Ours checks the variable `deploy_environment`. The practice inventory sets it to `practice`. A fake production inventory (`inventory/production.ini`, one made-up host at `203.0.113.10`, an address that is reserved for documentation) sets it to `production`. The guard runs with `connection: local`, so it never opens an SSH connection: it stops the run before Ansible reaches any host. (The variable is not called `environment`, because that is an Ansible keyword and Ansible ignores a variable with that name.)

**One named exception to the safety rules.** Molecule starts and removes containers, so its container gets the **Docker socket** (`/var/run/docker.sock`). Whoever can use that socket controls the Docker on your machine. So the Molecule container is the only kind of container in this course that has it. Challenges 7 and 9 use the same container and the same method: `toolkit/molecule.mjs`. For this part it is named `anp-c9-molecule` and has the label `anp.challenge=9`. It has a memory limit, a process limit and `no-new-privileges`. It runs as a normal user, not as root: the user is added to the group that owns the socket (`--group-add`). `ci.mjs` starts it for the `molecule` stage, runs only `molecule` in it, and removes it when the stage ends. Because the container is new every time, the stage installs the three pinned collections again (about 4 MB, about 20 seconds).

## Your task

Open `guard.yml` in this folder. It is the first play of `site.yml`. The test inside it says `- false`, so it refuses everything. Replace it with a real test: `deploy_environment` must equal `"practice"`, and a missing variable must be refused too (use the `default` filter).

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`).

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-9-your-pipeline/part-1-stages-locally/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-9-your-pipeline/part-1-stages-locally/guard.yml` | Write the guard's test. |
| 3 | `node challenges/challenge-9-your-pipeline/part-1-stages-locally/run.mjs` | Starts with `fleet reset`. Checks your guard against practice, production and an unset variable. Runs the whole pipeline (`ci.mjs`). Runs it again with a broken playbook. Saves the facts. It takes 5 to 12 minutes: Molecule is the slow stage. |
| 4 | `node toolkit/show-facts.mjs c9.p1` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-9-your-pipeline/part-1-stages-locally/test.mjs` | The test passes. |

You can run the pipeline yourself, any time:

```text
node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs
node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --playbook broken-site.yml
node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --inventory inventory/production.ini --only check-mode
```

The fleet keeps running after this part, with `/etc/banner.d/welcome.txt` on `web1` and `web2`. `node toolkit/fleet.mjs reset` removes it.

## What you should see

The guard refuses production, with no SSH connection opened:

```text
[ERROR]: Task failed: Action failed: Refusing to run. deploy_environment is 'production', not 'practice'.
```

The full pipeline:

```text
PASSED   lint           (seconds)   ansible-lint passed the "production" profile
PASSED   syntax-check               the playbook parses
PASSED   molecule                   molecule test passed (7 of 12 actions successful)
PASSED   check-mode                 check mode ran, 2 hosts would change
PASSED   apply                      applied, 2 hosts changed
PASSED   second-run                 second run changed 0 hosts
```

Molecule says `7 of 12 actions successful` because five of its twelve actions are optional playbooks that this scenario does not have. It is still a pass (exit code 0).

With `broken-site.yml` (a task without a name, and a `command` without `changed_when`) the pipeline stops at `lint` and the five stages after it are `SKIPPED`: nothing touched the fleet.

The recorded run took about 89 s for Molecule (this includes starting the Molecule container and installing the three collections, about 20 s) and between 2 and 15 s for each other stage. Molecule took between 1.5 and 9 minutes in other passing runs on the same machine, depending on what else Docker was doing (194 s in the first recorded run, when other builds shared the machine, and 89 s in two later runs on a quieter machine). The numbers are from one run on a shared machine.

The full recorded run is in [results.md](results.md).

![Seconds each pipeline stage took](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c9.p1.stage_<name>_s` | The seconds `ci.mjs` printed for each stage (`lint`, `syntax_check`, `molecule`, `check_mode`, `apply`, `second_run`), from one full run. |
| `c9.p1.stages_passed` | Stages printed as `PASSED`. |
| `c9.p1.check_would_change`, `c9.p1.apply_changed`, `c9.p1.second_run_changed` | The hosts with `changed` above 0 in each stage's recap. |
| `c9.p1.guard_refused`, `c9.p1.guard_passes_practice`, `c9.p1.guard_refuses_unset` | The guard play against the production inventory, the practice inventory and an inventory with no `deploy_environment`. |
| `c9.p1.guard_ssh_attempts` | Lines with `ESTABLISH SSH CONNECTION` in `-vvv` output of the refused run. |
| `c9.p1.broken_failed_stage`, `c9.p1.broken_skipped` | The first `FAILED` stage and the number of `SKIPPED` stages when `ci.mjs` runs `broken-site.yml`. |
| `c9.p1.pipeline_refused_production` | `ci.mjs --inventory inventory/production.ini --only check-mode` failed with the refusal text. |

## What is different on Docker Desktop

The Molecule container needs the Docker socket. On Docker Desktop with WSL 2 and on Linux, `/var/run/docker.sock` works as written. The socket belongs to a group. On Docker Desktop that group is `root` (id 0), and the container user is added to it with `--group-add 0`. On a Linux machine the group is usually `docker`, and `toolkit/molecule.mjs` reads its id for you. If your Docker uses another socket path, change it in `toolkit/molecule.mjs`. The repository is mounted from your machine into the Molecule container the same way it is into the control container.

## Stuck?

- `guard.yml still has "- false"`: write the test (see the `TODO`).
- `docker command not found in PATH` in the Molecule stage: `molecule.yml` must set `ansible_connection: community.docker.docker_api` for the instance. It is already set in the files you got.
- `permission denied` on `/var/run/docker.sock` (Linux): the container user is not in the group that owns the socket. `toolkit/molecule.mjs` adds that group by itself. Start the container by hand with `node toolkit/molecule.mjs up 9` to see the error, then `node toolkit/cleanup.mjs 9`.
- `Profile 'production' was required, but 'min' profile passed`: lint found problems. The lines above it name each one.
- A leftover container named `anp-c9-...`: `node toolkit/cleanup.mjs 9`.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
