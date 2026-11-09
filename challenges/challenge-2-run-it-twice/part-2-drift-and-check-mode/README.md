# Challenge 2, part 2: drift and check mode

**Time:** about 45 minutes. **Download:** about 2.1 MB of Debian packages for each web host and about 1.3 MB for the database host, once at the start of the run. No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Your playbook ran clean last week. Today someone logs in to `web1` and edits the home page "just this once". Now `web1` is different from `web2`, and nobody wrote it down. This is **drift**: a server that has moved away from what your files say.

You want two things. First, you want to **find** the drift without breaking anything. Second, you want to **repair** it with the playbook you already have. And before you run a playbook on a real server, you want a way to ask "what would you change?" and get an answer that you can trust.

## The idea

Ansible has a **check mode**: `--check`. In check mode Ansible runs the playbook but changes nothing. Each module reports what it *would* do. `--diff` adds the detail: for a file it prints the lines that would go away (`-`) and the lines that would come in (`+`).

Because the playbook states the wanted result, repair is easy. Run it again. Only the thing that drifted is changed back.

Check mode is useful, but it is a prediction. It is not a rehearsal. Two limits show up in this part:

1. **A command task is skipped.** Ansible cannot know what `command` or `shell` would do, so in check mode it does not run them. The task shows `skipping`. If a later task uses the result of the skipped task, it gets nothing.
2. **A later task cannot see a change that did not happen.** On an empty server, check mode says "I would install nginx", but it does not install it. The next task, which starts nginx, then looks for a service that does not exist, and fails.

You will see both.

## Your task

Open `site.yml` in this folder. It is the playbook from part 1. Add two tasks to the web play (the `TODO` lines tell you how):

- `Test the nginx configuration`: run `nginx -t` with the `command` module, keep the output with `register`, and add `changed_when: false` so that a read-only command never says changed.
- `Show the test result`: print the saved output with `debug`.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml` | Add the two tasks. |
| 3 | `node challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/run.mjs` | Starts with `fleet reset`. Runs check mode on empty servers, builds them, proves the playbook is stable, edits the page on `web1` by hand, runs check mode with diff, runs the playbook for real, runs it again. Saves the facts. |
| 4 | `node toolkit/show-facts.mjs c2.p2` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/test.mjs` | The test passes. |

The fleet keeps running after this part, with the playbook applied. `node toolkit/fleet.mjs reset` removes it again.

## What you should see

**Check mode on empty servers.** The install and page tasks say `changed`. Then `Start nginx` fails on both web hosts:

```text
[ERROR]: Task failed: Module failed: Could not find the requested service nginx: host
```

Nothing was installed. This is not a bug in your playbook. Check mode never installed nginx, so there was no nginx service to start. Check mode works best on servers that are already built.

**The drift.** After the playbook has built the servers and a second run shows `changed=0`, the run edits the page on `web1`:

```text
node toolkit/ansible.mjs ansible web1 -b -m shell -a "echo 'Edited by hand' > /var/www/html/index.html"
```

**Check mode with diff.** It finds the one drifted file and names the lines:

```text
-Edited by hand
+Hello from web1
...
web1                       : ok=5    changed=1    unreachable=0    failed=0    skipped=1 ...
web2                       : ok=5    changed=0    unreachable=0    failed=0    skipped=1 ...
```

Look at three things. First, only `web1` says `changed=1`. Second, `skipped=1` on both web hosts is your `nginx -t` task, which check mode did not run. Third, `Show the test result` says `ok` and prints `"msg": []`, an empty list. It did not fail, and it did not tell you anything. That is how a skipped command can mislead you: the output you wanted does not exist, and nothing says so loudly.

Then the run reads the page again. It still says `Edited by hand`. Check mode changed nothing.

**The repair.** The real run changes one thing on one host (`changed=1`). This time `nginx -t` runs and says `ok`, because of `changed_when: false`, and its output fills the debug message. The run after that says `changed=0` on every host.

The full recorded run is in [results.md](results.md). Your numbers will be the same.

![Changes reported per run: check mode finds the drift, the real run repairs it](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c2.p2.fresh_check_failed_hosts`, `c2.p2.fresh_check_service_error` | Hosts with `failed=1` in the recap of `--check` on empty servers, and whether the output holds `Could not find the requested service nginx`. |
| `c2.p2.baseline_changed_run2` | `changed=` added up over all hosts, second run after the build, before the drift (0). |
| `c2.p2.drift_check_changed` | `changed=` added up over all hosts in the `--check --diff` run after the drift (1). |
| `c2.p2.drift_check_skipped` | `skipped=` added up over all hosts in the same run (2: your command task, once per web host). |
| `c2.p2.drift_check_empty_debug` | How many times the debug task printed `"msg": []` in that run. |
| `c2.p2.diff_removed`, `c2.p2.diff_added` | The `-` line and the `+` line in the diff for the page on `web1`. |
| `c2.p2.page_after_check` | The page on `web1` after check mode, read with an ad hoc `cat`. |
| `c2.p2.drift_apply_changed`, `c2.p2.apply_test_task_ok` | `changed=` added up in the real run that repairs the page, and whether `Test the nginx configuration` said `ok` there. |
| `c2.p2.after_changed`, `c2.p2.page_after_apply` | `changed=` added up in the run after the repair (0), and the page on `web1` after the repair. |
| `c2.p2.reset_s` | Seconds that `fleet reset` took before this part started. |
| `c2.p2.playbook_file` | The playbook the run used. The test reads it again and counts the tasks. |

## What is different on Docker Desktop

Nothing for this part. Package downloads use your internet connection. The targets are containers without systemd, so `service` works through init scripts. On a real server the same check-mode limits apply.

## Stuck?

- `has 5 task(s) and needs 7`: add the two tasks from the TODO lines.
- `'nginx_test' is undefined` in the real run: the debug task runs, but the command task before it has no `register: nginx_test`.
- The test says `c2.p2.after_changed should be 0`: a task still says changed every time. The command task needs `changed_when: false`.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 2`.
