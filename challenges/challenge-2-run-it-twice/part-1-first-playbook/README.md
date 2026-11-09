# Challenge 2, part 1: your first playbook

**Time:** about 45 minutes. **Download:** about 2.1 MB of Debian packages for each web host (nginx and a few libraries) and about 1.3 MB for the database host (redis). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

In challenge 1 you installed nginx with one ad hoc command. That works for one job. Now you have five jobs on three servers: install nginx, write a home page, start nginx, install redis, start redis. You could type five commands. You would type them again for the next new server. And you could never be sure that a server matches the last one you built.

You need the jobs in a file, in order, that you can run again and again.

## The idea

A **playbook** is a YAML file that holds your jobs. It has one or more **plays**. A play says two things: which hosts to use, and which **tasks** to run on them. A task calls one module with some options. You know modules from challenge 1: `apt`, `command`, `ping`.

This part uses three modules:

- `ansible.builtin.apt` installs a package.
- `ansible.builtin.copy` writes a file. With `content:` you give the text right in the playbook.
- `ansible.builtin.service` starts or stops a service. Our servers are containers without systemd, so `service` uses the old init scripts. On a real server the task looks exactly the same.

`become: true` on a play means "run every task with sudo". Without it, `apt` fails for the same reason it failed in challenge 1.

A playbook describes the state you want, not the steps to get there. `state: present` means "nginx must be installed". If it is already installed, the task has nothing to do and says `ok`. If it had to do something, it says `changed`. So a good playbook is **idempotent**: the second run changes nothing. This is how you check your work. Run it twice. The second run must say `changed=0`.

At the end of every run Ansible prints a **recap**: one line per host with the counts `ok`, `changed`, `failed` and more. You will read the recap in every part of this challenge.

## Your task

Open `site.yml` in this folder. The first task is written for you. The `TODO` lines tell you what to add: the home page, starting nginx, and the two redis tasks. Keep the two-space indentation. YAML cares about spaces.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-2-run-it-twice/part-1-first-playbook/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml` | Add the four missing tasks. |
| 3 | `node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml --syntax-check` | Ansible reads the file and says if it is valid. It does not touch any host. |
| 4 | `node challenges/challenge-2-run-it-twice/part-1-first-playbook/run.mjs` | Starts with `fleet reset`. Lists your tasks, runs the playbook twice, asks nginx for the page and redis for a `PONG`. Saves the facts. |
| 5 | `node toolkit/show-facts.mjs c2.p1` | Shows the saved numbers. |
| 6 | `node --test challenges/challenge-2-run-it-twice/part-1-first-playbook/test.mjs` | The test passes. |

The fleet keeps running after this part, with nginx and redis installed and started. `node toolkit/fleet.mjs reset` removes everything again.

## What you should see

`--list-tasks` shows five tasks in two plays. Ansible adds one more task to each play by itself, `Gathering Facts`. It is not in your count.

The first run:

```text
PLAY RECAP *********************************************************************
db1                        : ok=3    changed=2    unreachable=0    failed=0 ...
web1                       : ok=4    changed=3    unreachable=0    failed=0 ...
web2                       : ok=4    changed=3    unreachable=0    failed=0 ...
```

Every web host changed three times: install, page, start. `db1` changed twice. The `ok=4` includes Gathering Facts, which reports `ok` and never `changed`.

The second run is the same playbook with nothing changed:

```text
db1                        : ok=3    changed=0    unreachable=0    failed=0 ...
web1                       : ok=4    changed=0    unreachable=0    failed=0 ...
web2                       : ok=4    changed=0    unreachable=0    failed=0 ...
```

`changed=0` on every host. This is the proof that the playbook is idempotent. The servers already look like the playbook, so there is nothing to do.

Last, the run asks each web host for its page and asks redis to answer a ping. The page says `Hello from web1` (or `web2`) and redis says `PONG`. So the work is real, not only a green recap.

The full recorded run is in [results.md](results.md). Your numbers will be the same. The order of the host lines can differ, because Ansible works on the hosts at the same time.

![Changes the same playbook made on each host, first run and second run](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c2.p1.tasks` | The task names that `ansible-playbook --list-tasks` prints. `Gathering Facts` is not listed there. |
| `c2.p1.changed_run1`, `c2.p1.changed_run2` | The `changed=` numbers in the PLAY RECAP of the first and the second run, added up over all hosts (3 + 3 + 2 = 8, and 0). |
| `c2.p1.failed_run1`, `c2.p1.hosts_in_recap` | The `failed=` numbers added up, and the number of host lines in the first recap. |
| `c2.p1.web_status_200_count` | Web hosts where `-m uri` got status 200 from `http://localhost/` (run on the host itself). |
| `c2.p1.redis_pong` | `redis-cli ping` on `db1` printed `PONG`. |
| `c2.p1.reset_s` | Seconds that `fleet reset` took before this part started. |
| `c2.p1.playbook_file` | The playbook the run used. The test reads it again and counts the tasks. |

## What is different on Docker Desktop

Nothing for this part. Package downloads use your internet connection. The targets are containers: `service` works through init scripts, and a real server would use systemd. The playbook is the same for both.

## Stuck?

- `has 1 task(s) and needs 5`: your `site.yml` still has the TODO lines. Add the tasks.
- `Destination directory /var/www/html does not exist` on the page task: the page task ran before nginx was installed. nginx creates that folder. Put the install task first. Tasks run in the order you write them.
- `are you root?` on the install task: the play has no `become: true`.
- `couldn't resolve module/action`: the module name is misspelled. Use the full name, for example `ansible.builtin.apt`.
- `conflicting action statements`: the options (`name:`, `state:`) must be indented one level deeper than the module name.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 2`.
