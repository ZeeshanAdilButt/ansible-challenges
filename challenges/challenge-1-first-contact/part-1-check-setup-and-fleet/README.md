# Challenge 1, part 1: check your setup and start the fleet

**Time:** about 60 minutes. **Download:** the first build pulls two small base images (Python and Debian) and then Python and Debian packages. Plan for several hundred MB and a few minutes. After the build the two images take about 0.7 GB on disk. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You have to change a setting on forty servers. You do not want to log in to forty machines by hand. Before you can use any tool for that, you need servers to practise on, and a place to run the tool. Most people lose their first hour here. A key has the wrong permissions. The tool is the wrong version. A server has no Python.

This part builds both ends once, and proves they can talk. After it, every other challenge starts from a working fleet.

## The idea

Ansible is a program that logs in to servers over **SSH** and runs small pieces of Python on them. Two words you need:

- The **control node** is the machine where you run Ansible. Here it is a container, so you never install Ansible on your own computer.
- A **managed node** (or **target**) is a server that Ansible changes. Here the targets are three containers: `web1`, `web2` and `db1`.

The targets need no Ansible and no agent. They need three things: an SSH server, Python, and a user that may use `sudo`. That is the whole requirement.

Two details to know:

- The targets have **no systemd**. They start `sshd` with its init script, and Docker's own init program is process 1, so `service ssh reload` works as on a real server. Real servers usually run systemd. The Ansible commands you write are the same.
- You log in with a key, not a password. The toolkit makes one key pair in `keys/` (it is git-ignored). The control container copies the private key to `~/.ssh` with mode 600, because `ssh` refuses a key that other users can read.

## Steps

Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | `node toolkit/check-setup.mjs` | Prints a table of checks. No line should say `FAIL`. |
| 3 | `node toolkit/fleet.mjs up` | Builds the two images the first time (a few minutes), makes your SSH key, starts four containers, and waits until each answers on SSH. |
| 4 | `node toolkit/ansible.mjs ansible all -m ping` | Ansible logs in to each target and runs its `ping` module. Three `pong` lines. |
| 5 | `node challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/run.mjs` | Does steps 2 to 4 again, times the start, tries SSH by hand and saves the facts. |
| 6 | `node toolkit/show-facts.mjs c1.p1` | Shows the saved numbers. |
| 7 | `node --test challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/test.mjs` | The test passes. |

`node toolkit/ansible.mjs` runs the command you give it inside the control container. The folder `/work` there is your repository, and `ansible.cfg` and `inventory/fleet.ini` come from it.

The fleet keeps running after this part. Stop it with `node toolkit/fleet.mjs down`. Your images stay, so the next `up` takes seconds.

## What you should see

Step 4 prints one block per host. The word `pong` is the proof:

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

`ping` here is **not** a network ping. Ansible logged in with SSH, copied a small Python module to the server, ran it, and read the answer. `"changed": false` says the module changed nothing.

The full recorded run, with every command and its output, is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Size of the two fleet images](chart.svg)

![Seconds from nothing to a fleet that answers SSH](chart-fleet-up.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c1.p1.control_image_mb` | `docker image inspect` size of `anp-control:1`, in MB (decimal, as `docker images` shows). |
| `c1.p1.target_image_mb` | The same for `anp-target:1`. |
| `c1.p1.fleet_up_s` | Median of three runs: remove the fleet, then time `fleet up` from the start until all three targets show an SSH banner. The images are already built. |
| `c1.p1.ping_ok_count` | The number of `"ping": "pong"` answers from `ansible all -m ping`. It must be 3. |
| `c1.p1.ansible_core_version` | Read from `ansible --version`. It must be `2.21.6`: the course is written against that version. |

## What is different on Docker Desktop

The commands are the same. Docker Desktop shares your repository folder into the control container, so the folder looks open to every user. That is why `ansible.cfg` is loaded through `ANSIBLE_CONFIG`: Ansible ignores a config file in a folder that every user can write. On WSL2 or Linux, clone the repository inside the Linux file system (not under `/mnt/c`) for speed.

## Stuck?

- `Docker is not ready`: start Docker and wait until it says running.
- `FAIL Free disk`: free some space. The images need about 0.7 GB, and builds need room.
- `The control container is not running`: `node toolkit/fleet.mjs up`.
- `no SSH banner from web1`: a target did not start. `node toolkit/fleet.mjs down`, then `node toolkit/fleet.mjs up`. Look at `docker logs anp-web1`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 1`.
