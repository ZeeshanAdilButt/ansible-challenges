# ansible-challenges

Hands-on challenges for the course **Ansible in Practice**, by Zeeshan Adil.

You read a chapter, then you run a small experiment on your own machine. You change a practice fleet of three small servers with Ansible. Each experiment prints numbers, saves them, and has a test that checks your work. You see Ansible do the thing, not just read about it.

## What you need

- Node.js 22 or newer (24 is best). Get it at nodejs.org.
- Docker with the Compose plugin: Docker Desktop, or Docker Engine on Linux or WSL2.
- About 2 GB of free disk to start. The two images are about 0.7 GB on disk. Each challenge README tells you how much it downloads.
- No npm packages. Nothing to install. You do **not** install Ansible on your machine: it runs inside a container.

## Start here

1. On GitHub, press **Use this template** to make your own copy of this repository. Clone it.
2. Open a terminal in the folder.
3. Check your machine:

```text
node toolkit/check-setup.mjs
```

It prints a short table. No line should say `FAIL`. Then follow [challenge 1, part 1](challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/README.md).

## The practice fleet

Four containers on a private Docker network. Ansible runs in one of them and changes the other three over SSH, the way it would change real servers.

| Container | Role |
|---|---|
| `anp-control` | The **control node**: Python 3.12 and Ansible 2.21.6 (with ansible-lint and Molecule), your repository at `/work`. |
| `anp-web1`, `anp-web2` | Two web servers (Debian 12, OpenSSH, Python 3.11, sudo, user `ansible`). |
| `anp-db1` | A database server, the same image. |

The servers have **no systemd**. `service` works through init scripts. Real servers usually have systemd, and the Ansible module call is the same.

Four more web hosts (`web3` to `web6`) start with `node toolkit/fleet.mjs up --rollout`. Challenge 8 uses them.

## Read the safety rules first

[SAFETY.md](SAFETY.md) is short. The most important rule: **never run `docker system prune` here.** Your Docker is shared with your other work. Everything we create has a name that starts with `anp-` and a label, and cleanup removes only those things.

## How the challenges are organised

```text
fleet/         compose file and the two images (control, target)
inventory/     fleet.ini (three hosts) and rollout.ini (six web hosts and one database host)
ansible.cfg    settings Ansible reads inside the control container
toolkit/       shared helpers: fleet, ansible wrapper, facts, charts, cleanup, setup check
tools/         for people who add challenges: new_challenge and make_starter
challenges/
  challenge-N-name/
    part-N-name/
      README.md     the problem, the idea, the steps, what you should see
      run.mjs       the experiment
      test.mjs      checks your work
      results.md    what the reference run printed, to compare with yours
      chart.svg     a chart of the reference numbers
facts.json     numbers your scripts measured (created when you run a part)
```

## Run one part

Every README has a table of exact commands. The pattern is always the same:

```text
node --test challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/test.mjs
node challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/run.mjs
node --test challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/test.mjs
```

1. Run the test first. It fails, and the message tells you what is missing.
2. Run the experiment. It prints each step and saves its numbers in `facts.json`.
3. Run the test again. It passes.

Add `--record` to a `run.mjs` to rewrite that part's `results.md` and `chart.svg` with your own run.

Every `run.mjs` starts with `fleet reset`: the three servers are made new again from the image, so you can run a part again and get the same start.

## Commands for Docker Desktop on Windows, macOS, and for Linux and WSL2

The same commands work everywhere. Run them in a terminal in the repository folder (PowerShell, Terminal, or a WSL2 shell).

```text
node toolkit/check-setup.mjs
node toolkit/fleet.mjs up
node toolkit/ansible.mjs ansible all -m ping
node toolkit/fleet.mjs reset
node toolkit/fleet.mjs down
```

- **Docker Desktop (Windows or macOS):** Docker Desktop must be running. Run the commands from PowerShell or a terminal, in the folder you cloned. The repository folder is shared into the control container.
- **WSL2 or Linux:** Docker Engine (or Docker Desktop with WSL integration) must be running. Clone the repository **inside the Linux file system** (for example `~/ansible-challenges`), not under `/mnt/c`. It is faster and file permissions behave like on a server.
- On Git Bash for Windows, if you run `docker` commands by hand with a path that starts with `/`, set `MSYS_NO_PATHCONV=1` first. The toolkit does not need it.

## Useful commands

| Command | What it does |
|---|---|
| `node toolkit/check-setup.mjs` | Checks Node, Docker, Compose, memory and disk. |
| `node toolkit/fleet.mjs up [--rollout]` | Builds the images the first time, makes your SSH key, starts the fleet. |
| `node toolkit/fleet.mjs reset` | Makes every server new again, in a few seconds. |
| `node toolkit/fleet.mjs shell web1` | Opens a shell inside a server (your second way in). |
| `node toolkit/fleet.mjs down` | Removes the fleet containers and network. Images stay. |
| `node toolkit/ansible.mjs ansible all -m ping` | Runs any `ansible` command in the control container. |
| `node toolkit/cleanup.mjs <N>` | Removes only what challenge N created (by label). |
| `node toolkit/show-facts.mjs c1.p1` | Shows saved numbers that start with `c1.p1`. |

## If something is stuck

Run `node toolkit/fleet.mjs reset`. If a challenge left something behind, run `node toolkit/cleanup.mjs <challenge number>`. If Docker itself is stuck, restart it. Your images and repository stay.
