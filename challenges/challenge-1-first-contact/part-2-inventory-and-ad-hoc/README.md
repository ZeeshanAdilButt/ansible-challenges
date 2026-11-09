# Challenge 1, part 2: three hosts, one inventory

**Time:** about 60 minutes. **Download:** about 2 MB of Debian packages per web host (nginx and a few libraries). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Part 1 proved that Ansible can reach your three servers. Now you have a real question: how does Ansible know which servers exist, and which of them you mean? If you type the wrong name, you change the wrong machine. If you list hosts in your head, you will forget one.

The answer is a file. It is small, and it is the first thing you write in Ansible.

## The idea

An **inventory** is a file that names your hosts and puts them in **groups**. In this course it is an INI file:

```ini
[web]
web1
web2
```

`[web]` starts a group. The lines below it are hosts. Ansible always adds one more group for you, `all`, which holds every host.

A **pattern** says which hosts a command should use. `web` means the group web. `all:!db` means "all hosts, except those in db". `web:&db` means "hosts that are in both web and db".

An **ad hoc command** runs one **module** on the hosts you pick, once, with no playbook. A module is a small program that does one job: `ping`, `setup` (collects facts), `apt` (installs packages), `command` (runs a command). You write it as `ansible <pattern> -m <module> -a "<arguments>"`.

Four ideas to watch for in the output:

- `SUCCESS` with `"changed": false` means "I looked, and nothing needed to change".
- `CHANGED` means "I changed something on that host".
- The `apt` module is **idempotent**: if nginx is already there, the second run changes nothing. Idempotent means you can run it again and again with the same result.
- The `command` module cannot know whether a command changes things, so it always says `CHANGED`.

## Your task

Open `my-inventory.ini` in this folder. It has the login settings already (user and key). Add what is missing: a group `web` with `web1` and `web2`, and a group `db` with `db1`. The `TODO` lines tell you where.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini` | Add the two groups. |
| 3 | `node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini --graph` | Shows your groups as a tree. |
| 4 | `node challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/run.mjs` | Starts with `fleet reset`. Lists hosts for four patterns, reads facts, shows the interpreter warning, installs nginx on `web` twice, runs `uptime`. Saves the facts. |
| 5 | `node toolkit/show-facts.mjs c1.p2` | Shows the saved numbers. |
| 6 | `node --test challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/test.mjs` | The test passes. |

The fleet keeps running after this part, with nginx installed on `web1` and `web2`. `node toolkit/fleet.mjs reset` removes it again.

To see the interpreter warning yourself, set the variable on your machine first. In PowerShell: `$env:ANSIBLE_PYTHON_INTERPRETER = "auto"`. In bash or zsh: `export ANSIBLE_PYTHON_INTERPRETER=auto`. The toolkit passes every `ANSIBLE_*` variable into the control container. Unset it afterwards.

## What you should see

The pattern lines:

```text
all selects 3 hosts.
web selects 2 hosts.
all:!db selects 2 hosts.
web:&db selects 0 hosts (and a warning: No hosts matched).
```

The facts show Debian 12 and Python 3.11 on every target. Python matters: every module is a Python program that Ansible sends to the target and runs there with the target's Python. Ansible finds that Python by itself. With the default setting it prints one warning per host to say so. `ansible.cfg` sets `interpreter_python = auto_silent`, which finds the Python the same way and stays quiet.

Installing nginx:

- Without `-b` the command **fails**. The user `ansible` is not root. `-b` means "become": run this with `sudo`.
- With `-b`, the first run says `CHANGED` for `web1` and `web2`, and `db1` is not touched because it is not in `web`.
- The second run says `SUCCESS` and `"changed": false` for both.

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Hosts each pattern selects, and hosts the nginx command changed](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c1.p2.hosts_all`, `c1.p2.hosts_web`, `c1.p2.hosts_not_db`, `c1.p2.hosts_web_and_db` | The `hosts (N):` line printed by `--list-hosts` for the patterns `all`, `web`, `all:!db` and `web:&db`. |
| `c1.p2.target_python` | `ansible_python_version` from `-m setup -a filter=ansible_python_version`. |
| `c1.p2.warning_lines_default`, `c1.p2.warning_lines_set` | Lines that contain `discovered Python interpreter`, from `-m ping` with `ANSIBLE_PYTHON_INTERPRETER=auto` and with the setting in `ansible.cfg`. |
| `c1.p2.adhoc_changed_first`, `c1.p2.adhoc_changed_second` | Hosts that printed `CHANGED` in the first and the second `-m apt` run with `-b`. |
| `c1.p2.command_changed` | Hosts that printed `CHANGED` for `-m command -a uptime`. |
| `c1.p2.reset_s` | Seconds that `fleet reset` took before this part started. |
| `c1.p2.inventory_file` | The inventory file the run used. The test checks it again against the live fleet. |

## What is different on Docker Desktop

Nothing for this part. Package downloads use your internet connection. The `uptime` number is the uptime of the Docker virtual machine, because containers share its kernel.

## Stuck?

- `has no hosts yet`: your `my-inventory.ini` still has no groups. Add them and run again.
- `No package matching 'nginx' is available`: the package list in the image is old. Rebuild it with `docker compose -f fleet/compose.yaml build --no-cache`, or add `update_cache=yes` to the `-a` text.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 1`.
