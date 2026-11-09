# Challenge 4, part 1: handlers

**Time:** about 60 minutes. **Download:** about 2 MB of Debian packages per web host (nginx and a few libraries). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You change a config file on two web servers. nginx must read the new file, or nothing changes for your users. Two easy answers are both bad:

- Reload nginx in every run. Then every run says `changed`, even when nothing changed. You can never see "nothing to do".
- Reload nginx by hand after the playbook. Then you forget, one day, and the server serves old content with a new file on disk.

You want: reload nginx **only when the file changed**, and do it by itself. In Ansible this is a handler.

## The idea

A **handler** is a task that waits. It runs only when another task **notifies** it, and only if that task reported `changed`. If the task says `ok`, nobody is notified, and the handler does not run.

```yaml
tasks:
  - name: Write the site config
    ansible.builtin.copy:
      dest: /etc/nginx/conf.d/demo.conf
      content: "..."
    notify: Reload nginx          # call the handler by its name

handlers:
  - name: Reload nginx
    ansible.builtin.service:
      name: nginx
      state: reloaded
```

Four rules to watch for in the output:

- A handler runs **once per host**, at the **end of the play**, not right after the task that notified it.
- If two tasks notify the same handler, it still runs once.
- `meta: flush_handlers` is a task that says "run the waiting handlers now".
- If a host **fails** after the notifying task, its handler does **not** run. This is the dangerous one. The part shows what it does to a server, and the fix.

## Your task

Open `site.yml` in this folder. It installs nginx, starts it and writes a config file. A changed config does nothing yet. Do the two `TODO` lines:

1. Make the config task notify a handler named `Reload nginx`.
2. Add a `handlers:` section with that handler. It reloads nginx with `ansible.builtin.service`.

The other playbooks in this folder are given. You do not edit them. They show the four rules above.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-4-fail-on-purpose/part-1-handlers/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-4-fail-on-purpose/part-1-handlers/site.yml` | Do TODO 1 and TODO 2. |
| 3 | `node challenges/challenge-4-fail-on-purpose/part-1-handlers/run.mjs` | Starts with `fleet reset`. Runs your playbook twice, then the given playbooks. After each change it asks nginx what it answers. Saves the facts. About 4 minutes. |
| 4 | `node toolkit/show-facts.mjs c4.p1` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-4-fail-on-purpose/part-1-handlers/test.mjs` | The test passes. |

The fleet keeps running after this part. `node toolkit/fleet.mjs reset` makes the targets new again.

## What you should see

Your playbook, first run: every task is `changed`, and then one more line:

```text
RUNNING HANDLER [Reload nginx] *************************************************
changed: [web2]
changed: [web1]
```

The handler ran twice (once per web host). Second run: no handler line at all, and `changed=0` on each host.

`two-notifies.yml` changes two files. Both tasks notify `Reload nginx`. The handler still runs once per host.

`check-before-handler.yml` asks nginx for its answer **in the middle of the play**, after the config changed but before the handler. nginx still answers with the old message. `flush.yml` is the same play with `meta: flush_handlers` before the question, and nginx answers with the new message.

`fail-after.yml` breaks on web2 on purpose, after the config task:

```text
RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
```

web1 reloaded. web2 did not: its handler was skipped because web2 had failed. Now ask nginx: web1 answers with the new message, web2 answers with the **old** one, although its config file on disk is new. Run the same playbook again and the handler does not run on web2 either, because the file is already right, so the task says `ok` and notifies nobody. web2 stays wrong, and the second run does not show it. With `--force-handlers`, Ansible runs the waiting handlers even on a host that failed, and web2 is fixed.

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![How many times the handler ran in each run](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c4.p1.handler_runs_first`, `..._second`, `..._config_change` | Lines under `RUNNING HANDLER [Reload nginx]` that say `changed` or `ok`, in your playbook's first run, second run, and a run with only the message changed. |
| `c4.p1.handler_runs_two_notifies` and `..._web1` | The same lines in `two-notifies.yml`: in total, and for web1 only. |
| `c4.p1.stale_without_flush`, `c4.p1.fresh_with_flush` | What `check-before-handler.yml` and `flush.yml` print in the `nginx answers:` line, compared with the old and the new message. |
| `c4.p1.fail_exit_code`, `..._failed_hosts`, `..._handler_runs` | The exit code, the recap lines with `failed=1`, and the handler lines of `fail-after.yml`. |
| `c4.p1.fail_web2_stale`, `c4.p1.fail_rerun_web2_stale` | What `served.yml` shows after the failed run and after the rerun. |
| `c4.p1.force_handler_runs`, `c4.p1.force_web2_fresh` | The handler lines and the answers after `--force-handlers`. |

## What is different on Docker Desktop

Nothing for this part. The targets have no systemd, so `ansible.builtin.service` works through the init script of nginx, and `reloaded` sends nginx a reload signal. On a real server the same task works the same way.

## Stuck?

- `No handler ran`: you have not done TODO 1 and TODO 2 yet, or the handler name differs from the name in `notify`. The two names must be exactly the same, letter for letter.
- `[ERROR]: The requested handler 'Reload nginx' was not found in either the main handlers list nor in the listening handlers list`: the same problem the other way round. `notify` names a handler that does not exist (the exit code is 1).
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 4`.
