# Challenge 7, part 2: test a role with Molecule

**Time:** about 60 minutes. **Download:** about 10 MB at the first run: two Ansible collections (about 1 MB) and, inside every test machine, nginx and its packages (about 2 MB). The image `python:3.12-slim-bookworm` is already on your machine from challenge 1. No new image is built. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You wrote a role. It worked on your three practice hosts. Next month someone changes it, and it works on their laptop. Does it still install nginx, write the right port, answer on that port? You cannot ask three servers every time, and a server you tested once is no longer clean. You need a fresh machine in seconds, a way to run the role on it, and a check that says yes or no.

## The idea

**Molecule** tests a role. It makes a throwaway machine (an **instance**), runs your role on it, checks the result, and deletes the machine. The steps, in order:

| Step | What it does |
|---|---|
| `create` | Starts the instance. Here: a Docker container from `python:3.12-slim-bookworm`. |
| `converge` | Runs your role on the instance. |
| `idempotence` | Runs the role **a second time**. Anything that reports `changed` fails the test (part 3). |
| `verify` | Runs `verify.yml`: your assertions about the result. |
| `destroy` | Deletes the instance. |

A **scenario** is one test set-up: a folder `molecule/default/` inside the role with `molecule.yml` (the instance), `converge.yml` (what to run) and `verify.yml` (what must be true). The **driver** decides what an instance is. The `docker` driver makes containers.

An **assertion** is a statement that must be true, written with the `assert` module. If it is false, the step fails.

### The one exception to "no Docker socket"

Molecule makes and deletes containers through Docker. So it runs in its own container, `anp-c7-molecule`, with the Docker **socket** mounted: `/var/run/docker.sock`. That is the file through which a program talks to Docker. **Anyone who can use that socket can start any container on your computer, with any folder mounted.** This is the only container in the course that has it. It runs as a normal user (not root), without `--privileged`, with `no-new-privileges`, and it is removed at the end of the run (`node toolkit/cleanup.mjs 7`). It is built from the image the course already has (`anp-control:1`).

The socket belongs to a group. On Docker Desktop that group is `root` (id 0), and the container user is added to it with `--group-add 0`. On a Linux machine the socket usually belongs to the group `docker`. `toolkit/molecule.mjs` reads the group id of the socket (`stat -c %g /var/run/docker.sock`) and passes it, so you do not look it up. If you start the container by hand, run `stat -c %g /var/run/docker.sock` on the host and give that number to `--group-add`.

## Your task

The role `roles/webserver` installs nginx, writes a config for port 8080 and a home page, and reloads nginx when the config changes. The scenario is ready, except `molecule/default/verify.yml`. It has one assertion (nginx is installed). Write two more, from the TODO comments:

1. Read `/etc/nginx/conf.d/webserver.conf` and assert that it says `listen 8080;`.
2. Ask the web server for the home page and assert that the status is 200 and that the page says `Hello from Ansible`.

Read `molecule/default/molecule.yml` and `converge.yml` too. Three details in them are real lessons (they cost us time, see `NOTES.md`):

- The role has `namespace: acme` in `meta/main.yml`, so converge names it `acme.webserver`. Without a namespace Molecule refuses to start. With the plain name `webserver` converge says `The role 'webserver' was not found`.
- `ansible_connection: community.docker.docker_api` in `molecule.yml`. The default connection runs the `docker` command, and the Molecule container has no Docker CLI.
- The instance has a name and a label (`anp-c7-instance`, `anp.challenge: "7"`) so cleanup can find it.

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`. The run starts the Molecule container itself.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/roles/webserver/molecule/default/verify.yml` | Write the two assertions. |
| 3 | `node toolkit/molecule.mjs run 7 challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/roles/webserver molecule test` | Starts the Molecule container, installs the collections, runs the whole sequence once. Read the output from top to bottom. |
| 4 | `node challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/run.mjs` | Runs `molecule test` three times (for the timing), checks the instance label, saves the facts, and removes the Molecule container. |
| 5 | `node toolkit/show-facts.mjs c7.p2` | Shows the saved numbers. |
| 6 | `node --test challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/test.mjs` | The test passes. |

The fleet is not changed by this part. The Molecule container and every test machine are removed at the end of `run.mjs`. After step 3 the Molecule container stays: `node toolkit/cleanup.mjs 7` removes it.

## What you should see

`molecule test` runs this matrix: `dependency, cleanup, destroy, syntax, create, prepare, converge, idempotence, side_effect, verify, cleanup, destroy`. Several steps print `Missing playbook` or `2 missing`: your scenario has no `prepare.yml`, no `side_effect.yml`, no `cleanup.yml`, and no `requirements.yml`. That is allowed. The recap:

```text
default                   : actions=12  successful=7  disabled=0  skipped=0  missing=6  failed=0
```

Read the numbers like this: `actions=12` is the 12 steps of the matrix. 7 of them passed. The other **5** have no playbook: `dependency`, `cleanup` (it is in the matrix twice), `prepare` and `side_effect`. The recap says `missing=6`, not 5, because the `dependency` step looks for two files (`requirements.yml` for roles and `collections.yml` for collections) and counts both. So 7 + 5 = 12 steps, and 6 missing files.

In the converge step the handler runs once (`RUNNING HANDLER [acme.webserver : Reload nginx]`). In the idempotence step nothing reports `changed`. In the verify step three assertions pass.

The full recorded run is in [results.md](results.md). Times depend on your network (the packages are downloaded in every run).

![Seconds for three full molecule test runs](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c7.p2.steps_passed`, `c7.p2.steps_missing`, `c7.p2.steps_failed` | The `SCENARIO RECAP` line of the first `molecule test`: `successful`, `missing`, `failed`. `steps_missing` is the recap's own `missing` number (6): the missing files, not the steps. Five steps have no playbook (12 actions minus 7 successful); `dependency` counts two files. |
| `c7.p2.test_s`, `c7.p2.test_runs_s` | Median of three full `molecule test` runs, and the three times. |
| `c7.p2.verify_asserts` | Blocks `ok: [instance] => {` in the verify step: one per passed `assert` task. |
| `c7.p2.handler_ran_in_converge` | The text `RUNNING HANDLER [acme.webserver : Reload nginx]` in the output. |
| `c7.p2.instance_labelled` | `docker ps` while a scenario exists: the instance is named `anp-c7-instance` and has the label `anp.challenge=7`. |
| `c7.p2.collections_install_s`, `c7.p2.collections_pinned` | Seconds for `ansible-galaxy collection install`, and the exact versions. |
| `c7.p2.docker_socket_group` | The group id added to the Molecule container (`docker inspect`, `HostConfig.GroupAdd`). |

## What is different on Docker Desktop

- The socket group is `0` (root). On Linux it is the `docker` group, and the run reads it for you.
- The two collections are installed into the Molecule container's own disk, not into your repository: writing the 860 files of `community.docker` into a shared Windows folder took more than 5 minutes, and into the container it took 18 seconds. They are installed again each time the container is made.
- Test machines are plain containers: no systemd. The role starts nginx with the `service` module, which works through the init script.

## Stuck?

- `Computed fully qualified role name of webserver does not follow current galaxy requirements`: `meta/main.yml` has no `namespace` (or no `author`). Add it.
- `The role 'webserver' was not found`: `converge.yml` must say `acme.webserver`.
- `docker command not found in PATH`: the `ansible_connection: community.docker.docker_api` lines are missing from `molecule.yml`.
- `permission denied while trying to connect to the Docker daemon socket` (Linux): the container user is not in the group that owns the socket. Start it with `node toolkit/molecule.mjs up 7`, which adds the group.
- `Task failed: Action failed: ...` in the verify step: that is your assertion saying no. Read `fail_msg`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 7`.
