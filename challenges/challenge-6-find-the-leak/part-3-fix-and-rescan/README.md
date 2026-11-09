# Challenge 6, part 3: fix the leaks and scan again

**Time:** about 75 minutes. **Download:** nothing. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

Every secret here is **fake** (`demo-secret-not-real-0001` and `demo-secret-not-real-0002`). The vault password is a throwaway made by `run.mjs`.

## The problem

Part 2 found 12 lines that show the secret, in five places. You can count them, so you can also fix them, and prove the fix by counting again. A fix you did not measure is a hope.

There is a catch. Some leaks cannot be fixed by code. The password in the old Git commit stays there, in every clone. The only real fix for that is to **rotate** the secret: make a new one, use it, and treat the old one as burnt.

## The idea

Four tools, and each one has a limit:

| Tool | What it does | What it does not do |
|---|---|---|
| `no_log: true` on a task | Hides the task's result in the output, including under `-v` and `--diff`. The result shows `censored`. | It does not hide the secret from the file on the target. It does not stop every message (see below). |
| `loop_control` with `label` | Changes the text printed next to a loop item, for example `(item=reporting)`. | **It does not hide anything.** The docs say a label is for readability. Under `-v` the item is still in the result. Use `no_log` for secrets. |
| Remove the debug task | The secret is not printed at all. | Nothing: it is the best fix. A secret that is never printed cannot leak. |
| Pass a secret by environment variable | The password is not on the command line, so `ps` does not show it. | The value is still in the process environment, readable by root and by the same user. |

Keep the vault. The secret still has to come from `vars/secrets.yml`.

Two facts about `no_log`, measured in the recorded run on ansible-core 2.21.6:

- **A failed task can still print the secret.** When an action plugin fails with a message that holds the value (for example `copy` with a `src` that does not exist), the `[ERROR]` block prints the message, although the `fatal:` line below it says `censored`.
- **`ANSIBLE_DEBUG=1` ignores `no_log`.** The debug log shows the module result and the arguments of a task that has `no_log: true`.

And one thing that is by design: the app must read its password, so the file on the target holds it in plain text. Its protection is the file mode (600) and who can log in, not Ansible.

## Your task

Open `fixed.yml`. It is a copy of `leaky.yml`. It still leaks in four places. Each `TODO` comment says what to do:

1. Remove the debug task.
2. Hide the loop (`no_log`) and give it a label (`loop_control`).
3. Hide the read-back task (`no_log`).
4. Take the password off the command line of the report job (`environment:` and `"$DB_PASSWORD"`), and hide that task.

Keep `vars_files` as it is: the secret stays in the vault.

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/fixed.yml` | Do the four TODOs. |
| 3 | `node challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/run.mjs` | Starts with `fleet reset`. Makes a throwaway password and the project with its history. Runs the leaky playbook and scans (before). **Rotates the secret** in the vault. Runs your `fixed.yml` on fresh hosts and scans for the new secret (after). Then it tries `no_log` in six ways: label only, `--diff`, `-v`, a failing task, `ANSIBLE_DEBUG=1` and `-vvvv`. Saves the facts. |
| 4 | `node toolkit/show-facts.mjs c6.p3` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/test.mjs` | The test passes. |

If the scan still finds lines, `run.mjs` prints which places leak. `fixed-output.txt` holds the saved run.

The fleet keeps running after this part. `web1` holds the files from the `no_log` experiment (`/etc/demo-app/`). `node toolkit/fleet.mjs reset` removes them.

## What you should see

Before the fix: **12** lines show the secret. After: **0**. That is the scan of the output, the process list, and the repository for the **new** secret.

The old secret is still in Git history, on **2** lines. Code cannot remove it. This is why the run rotates the secret first.

What the experiments show (all from the recorded run, see [results.md](results.md)):

| Experiment | Lines that show the secret |
|---|---|
| Loop with only a `label`, with `-v` | 2 (the item is still in the result) |
| Loop with only a `label`, without `-v` | 0 |
| `--diff`, a `copy` task without `no_log` | 1 |
| `--diff`, a `copy` task with `no_log` | 0 |
| `-v`, tasks with `no_log` | 0 |
| A `no_log` task that **fails** with the secret in its message | 2 (the `[ERROR]` block) |
| `ANSIBLE_DEBUG=1`, tasks with `no_log` | 3 |
| `-vvvv`, tasks with `no_log` | 0 |

So `no_log` is not a lock. It stops the normal output. It does not stop the error text, and it does not stop the debug log of Ansible itself. **Never run `ANSIBLE_DEBUG=1` with real secrets and share the log.**

![Lines that show the secret, before and after the fix](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c6.p3.leaks_before` | The scan of `leaky.yml` (run with `-v`), the process lists and the repository, for the old secret. Same scan as part 2. |
| `c6.p3.leaks_after` | The same scan after your `fixed.yml` ran with `-v` on fresh hosts, for the new secret. |
| `c6.p3.old_secret_history_lines` | Lines of `git log --all -p` that show the old secret, after the fix. |
| `c6.p3.leaks_after_old_secret_in_output` | Lines of your fixed run that show the old secret (0). |
| `c6.p3.debug_leak` (true or false) and `c6.p3.debug_leak_lines` | Whether any line of the `ANSIBLE_DEBUG=1` run shows the secret, and how many. Real result of the run. |
| `c6.p3.vvvv_leak_lines` | The same for `-vvvv`. |
| `c6.p3.error_text_leak_lines` | Lines with the secret when a `no_log` task fails with the secret in its error message. |
| `c6.p3.no_log_v_lines` | Lines with the secret under `-v`, for tasks with `no_log`. |
| `c6.p3.diff_lines_without_no_log`, `c6.p3.diff_lines_with_no_log` | Lines with the secret under `--diff`, per task. |
| `c6.p3.label_only_lines_v`, `c6.p3.label_only_lines_plain` | Lines with the secret when the loop has only a label, with and without `-v`. |
| `c6.p3.target_file_has_secret`, `c6.p3.target_file_denied_other_user` | `cat` of the file on `web1` as root, and as the user `nobody`. |

## What is different on Docker Desktop

Nothing for the numbers. The `ANSIBLE_DEBUG=1` log is long (about 950 lines for one host and a few tasks). `results.md` keeps only the lines that show the secret.

## Stuck?

- `The rescan still found N lines`: `run.mjs` names the places. Open `fixed-output.txt` and search for the new secret `demo-secret-not-real-0002`.
- `the output has been hidden due to the fact that 'no_log: true'` and you need to see an error: take `no_log` off while you debug on **fake** data, then put it back. Never debug a real secret that way.
- `'db_password' is undefined`: Ansible 2.21.6 does **not** complain when a file in `vars_files` is missing (see `NOTES.md`). Check the path.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 6`.
