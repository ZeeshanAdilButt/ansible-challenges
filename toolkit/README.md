# Toolkit helpers

For people who add challenges. Plain Node 22, no npm packages. Import from a part's `run.mjs` with `../../../toolkit/<file>`.

## Fleet (`fleet.mjs`)

| Name | What it does |
|---|---|
| `fleetUp({ rollout })` | Builds the images and the key if missing, starts `control`, `web1`, `web2`, `db1` (and `web3` to `web6` with `rollout: true`), waits until every host shows an SSH banner. Returns seconds. |
| `fleetReset()` | Makes every existing target new again from the image: clean files, no packages you added, new host keys. Starts the fleet if it is not running. Returns seconds. **Call it first in every `run.mjs`.** |
| `fleetRolloutDown()` | Removes only `web3` to `web6`. The base fleet keeps running. |
| `fleetDown({ images })` | Removes the fleet containers and the network. With `images: true` it also removes the two images. |
| `fleetRunning()` | The services that run now, sorted, for example `['control','db1','web1','web2']`. Use it in tests. |
| `execIn(host, argv)` | `docker exec` as root inside `web1`, `db1`, `control` and so on: `execIn('web1', ['cat', '/etc/os-release'])`. This is the learner's "second way in". Returns `{ code, stdout, stderr }`. |
| `controlExec(argv)` | A command in the control container as user `learner`, from `/work`. Use it for non-Ansible commands such as `ssh`. |
| `imageSizesMb()` | `{ control, target }` in MB (decimal, like `docker images`). |
| `BASE_HOSTS`, `ROLLOUT_HOSTS`, `ALL_TARGETS`, `containerName(host)` | Names. The container for `web1` is `anp-web1`. |

Command line: `node toolkit/fleet.mjs up [--rollout]|reset|status|rollout-down|down|build|keys|shell <host>`.

## Ansible wrapper (`ansible.mjs`)

`ansible(argv, { env, cwd, input, timeoutMs, merge })` runs one command in the control container and returns `{ code, stdout, stderr }`. It never throws for a failed command, so check `code`.

```js
import { ansible, countLines } from '../../../toolkit/ansible.mjs';
const r = ansible(['ansible-playbook', `${PART}/site.yml`]);          // PART = 'challenges/challenge-2-run-it-twice/part-1-first-playbook'
const r2 = ansible(['ansible', 'web', '-m', 'ping'], { env: { ANSIBLE_DEBUG: '1' } });
const changed = countLines(r.stdout, /changed=[1-9]/);
```

- Only commands that start with `ansible` run (`ansible`, `ansible-playbook`, `ansible-vault`, `ansible-galaxy`, `ansible-inventory`, `ansible-lint`, `ansible-config`).
- Output and errors are mixed in print order in `stdout` (as a terminal shows them). `stderr` is empty unless you pass `merge: false`.
- `cwd` is a folder under the repository, for example `cwd: PART`. Without it, commands run in `/work` (the repository root).
- Variables on the host that start with `ANSIBLE_` are passed in (except `ANSIBLE_CONFIG`). `env` adds more.
- Paths inside commands are paths in the repository, with forward slashes, relative to `/work`.
- Command line: `node toolkit/ansible.mjs ansible all -m ping` (colour and Ctrl-C work when you use a terminal).

## Recorder, chart, facts, timing

| File | What it gives you |
|---|---|
| `record.js` | `new Recorder(title)`; `rec.step(command, output, note)` prints and stores a step; `rec.write(path, machineLine)` writes `results.md`. Pass the real command text that you ran, and the real output. `compactOutput(text)` shortens ansible JSON for `results.md`: the `stdout_lines` lists (copies of `stdout`) become one line, and lines over 400 characters are cut, each saying what was left out. Count things on the raw output first. |
| `bars.js` | `barsSvg({ title, unit, bars: [{ label, value }] })` returns an accessible SVG string with a title and description. Write it to `chart.svg`. |
| `facts.js` | `setFact('c<N>.p<M>.<what>_<unit>', value)` (number, string or boolean) and `getFact(name)`. Saved in `facts.json`. Set `ANP_FACTS_PATH` to use another file. |
| `stats.js` | `median(list)`, `round(x, decimals)`, `await timed(fn)` gives `{ ms, value }`. Time with the median of three runs. |
| `show-facts.mjs` | `node toolkit/show-facts.mjs c2.p1` prints the saved facts that start with that prefix. |

## Molecule container (`molecule.mjs`)

The one container in the course that has the Docker socket (challenges 7 and 9, same method). It runs as a normal user in the socket's group, with `no-new-privileges`, 1 GB and 512 processes, from the image the fleet already has.

| Name | What it does |
|---|---|
| `moleculeUp(n)` | Starts `anp-c<n>-molecule` with the label `anp.challenge=<n>` if it is not running. |
| `installCollections(n)` | Installs the pinned collections the Docker driver needs into the container's own disk (about 20 seconds, about 4 MB). Skips what is there. |
| `moleculeExec(n, argv, { cwd })` | Runs `molecule ...` or `ansible...` in the container, in a folder of the repository (`cwd`). Returns `{ code, stdout, stderr }`, never throws. |
| `moleculeDown(n)` | Removes everything labelled `anp.challenge=<n>`. |

Command line: `node toolkit/molecule.mjs up 9 | down 9 | shell 9 | collections 9` and `node toolkit/molecule.mjs run 9 <folder> molecule test`. The role's `molecule.yml` must label its test container `anp.challenge: "<n>"` so that cleanup finds it.

## Cleanup and labels (`docker.js`, `cleanup.mjs`)

| Name | What it does |
|---|---|
| `name(n, what)` | `anp-c<n>-<what>`. Use it for every extra container, network or volume. |
| `label(n)` | `['--label', 'anp.challenge=<n>']`. |
| `safeArgs(n, what)` | Name, label, memory, process and disk limits and `no-new-privileges` for an extra `docker run`. |
| `cleanup(n)` and `leftovers(n)` | Remove, and count, objects labelled `anp.challenge=<n>`. Never touches the fleet or images. End every `run.mjs` with `cleanup(N)` in `finally`. |
| `cleanupFleet()` and `fleetLeftovers()` | The same for the fleet label `anp.fleet=1`. |
| `run(args)`, `runAsync(args)` | `docker <args>` with `{ code, stdout, stderr }`. Never throws. |
| `waitFor(fn, { timeoutMs, intervalMs, what })` | Calls `fn` until it returns something truthy. |
| `assertDocker()` | Returns the engine version or throws a friendly error. |

Command line: `node toolkit/cleanup.mjs <N>` and `node toolkit/cleanup.mjs fleet`.

## Setup check (`check-setup.mjs`)

`checkSetup()` returns `{ rows, facts, ok }` (Node 22 or newer, Docker engine, Compose plugin, memory, free disk). `formatTable(rows)` prints it. `node toolkit/check-setup.mjs` exits with 1 on any `FAIL`.

## Rules that are easy to forget

- The control container sees the repository at `/work`. `ansible.cfg` there sets the inventory to `inventory/fleet.ini`. Use `-i inventory/rollout.ini` for the six web hosts.
- The targets have no systemd. `ansible.builtin.service` works through init scripts. `service ssh reload` and `service ssh restart` work (PID 1 is a reaper).
- The apt lists are kept in the target image, so `apt: name=nginx` works without `update_cache`. The lists age: a rebuilt image (`docker compose build --no-cache`) refreshes them.
- A part may leave the fleet running. It must not leave anything labelled `anp.challenge=<N>`.
- No em dashes or en dashes anywhere. `node --test toolkit/test.mjs` checks this.

## Running a second fleet (parallel builders)

The fleet is the compose project `anp`: containers `anp-control`, `anp-web1` ..., network `anp-fleet`. Two people (or two builders on one machine) must not share it: `fleet reset` recreates the targets, and each checkout mounts its own folder at `/work`.

Set `ANP_PROJECT` before any toolkit command to get a separate fleet with its own names:

```text
ANP_PROJECT=anp-b2 node toolkit/fleet.mjs up          # bash
$env:ANP_PROJECT = "anp-b2"; node toolkit/fleet.mjs up   # PowerShell
```

Containers are then `anp-b2-control`, `anp-b2-web1` ..., the network is `anp-b2-fleet`, and `fleet down`, `cleanup fleet` and `fleetRunning()` touch only that project (they filter on the compose project label as well as `anp.fleet=1`). The two images `anp-control:1` and `anp-target:1` are shared and are never removed except by `fleet down --images`. Every `run.mjs`, test and the `ansible.mjs` wrapper read the variable, so set it once in your terminal. Checked on this machine: a second fleet came up beside the first, answered 3 pongs, reset and went down, and the first fleet was untouched.
