# Challenge 7, part 3: break idempotence on purpose

**Time:** about 45 minutes. **Download:** nothing new (nginx is downloaded inside each test machine, about 2 MB, as in part 2). **Safety rules:** [SAFETY.md](../../../SAFETY.md)

Molecule runs in its own container, `anp-c7-molecule`. That container has the Docker socket (`/var/run/docker.sock`) mounted. It is the one exception to the course rule "no access to the host's Docker", and part 2 explains why and what it means. `node toolkit/cleanup.mjs 7` removes it.

## The problem

Part 2 gave you a green test. Now someone adds one harmless task to your role: "check that the nginx config is valid". The role still works. On the next real run everything shows `changed`, so nobody can tell any more whether the server changed or not. The role that said "no changes" yesterday never says it again. The idempotence step of Molecule exists to catch exactly this, in seconds, before the role reaches a server.

## The idea

A role is **idempotent** when a second run changes nothing. Molecule checks this: after `converge` it runs the role again (the `idempotence` step) and fails the test if any task reports `changed`. It then prints the names of the tasks that did.

The `command` module cannot know whether a command changes something, so it reports `changed` every time (you saw this in challenge 1). The fix is to say it yourself: `changed_when: false` means "this task never changes anything".

## Your task

1. Add this task at the end of `roles/webserver/tasks/main.yml`, **exactly as it is** (step 2). It is the "break". `run.mjs` also makes a broken copy of the role by itself, so you will see the failure whatever you do next.

   ```yaml
   - name: Check the nginx config
     ansible.builtin.command: nginx -t
   ```

2. Run `molecule test` on your role (step 3). Read the failure: which step, which task.
3. Fix the task (add `changed_when: false`, step 4). Run `molecule test` again. It passes.

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`. The run starts the Molecule container itself.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-7-test-your-role/part-3-break-idempotence/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-7-test-your-role/part-3-break-idempotence/roles/webserver/tasks/main.yml` | Add the task above at the end. |
| 3 | `node toolkit/molecule.mjs run 7 challenges/challenge-7-test-your-role/part-3-break-idempotence/roles/webserver molecule test` | The test fails at `idempotence`. Find the line `Idempotence test failed because of the following tasks:` and the task under it. |
| 4 | Edit the same file: add `changed_when: false` under the task. Run step 3 again. | The test passes. |
| 5 | `node challenges/challenge-7-test-your-role/part-3-break-idempotence/run.mjs` | Makes a broken copy of the working role (`base-role/`) plus the task, runs `molecule test` on it (it must fail), then runs `molecule test` on your fixed role (it must pass). Saves the facts. |
| 6 | `node toolkit/show-facts.mjs c7.p3` | Shows the saved numbers. |
| 7 | `node --test challenges/challenge-7-test-your-role/part-3-break-idempotence/test.mjs` | The test passes. |

Do not edit `base-role/`: it is the working role that `run.mjs` copies. After step 3 the Molecule container stays: `node toolkit/cleanup.mjs 7` removes it. `run.mjs` removes it at the end.

## What you should see

In the idempotence step, the second run shows one task as `changed`, and then:

```text
CRITICAL Idempotence test failed because of the following tasks:
*  => acme.webserver : Check the nginx config
ERROR    [default > idempotence] Executed: Failed
```

Look closely at the second line: the instance name between `*` and `=>` is empty in Molecule 26.11.0. The text after `=>` is the role and the task name: that is what to look for. Then:

- The `verify` step never runs. Molecule stops at the first failed step.
- Molecule still runs `destroy`: the test machine is removed.
- The exit code is 1.
- The final `SCENARIO RECAP` says `failed=0`, and the `DETAILS` list says `idempotence: Executed: Successful`, although the test failed. Do not trust the recap: trust the exit code and the `CRITICAL` line.

With `changed_when: false` the same task reports `ok`, the idempotence step passes, and the test is green again (7 steps successful, as in part 2).

The full recorded run is in [results.md](results.md).

![Tasks that failed the idempotence step, before and after the fix](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c7.p3.idempotence_failed_tasks_before` | Lines that start with `*` under `Idempotence test failed because of the following tasks:` in the broken run. |
| `c7.p3.idempotence_failed_tasks_after` | The same, in the run of your fixed role. |
| `c7.p3.failing_task`, `c7.p3.failure_text` | The first such line, and the first lines of the failure text. |
| `c7.p3.broken_exit_code`, `c7.p3.fixed_exit_code` | Exit codes of the two `molecule test` runs. |
| `c7.p3.verify_ran_after_failure` | Whether `[default > verify] Executing` appears in the broken run. |
| `c7.p3.destroy_after_failure` | Whether `destroy` ran successfully after the failure. |
| `c7.p3.broken_recap_failed` | The `failed=` number of the `SCENARIO RECAP` of the broken run (0, see above). |
| `c7.p3.fixed_steps_passed` | The `successful=` number of the recap of the fixed run. |

## What is different on Docker Desktop

Same as part 2: the socket group is 0 (root) and the collections are installed inside the Molecule container. A full run takes about 2 to 3 minutes, and the script runs two of them.

## Stuck?

- `has no "Check the nginx config" task yet`: add the task from the README to `roles/webserver/tasks/main.yml`.
- `has no changed_when: false yet`: that is the fix. Molecule fails the test until you add it.
- The test passes without `changed_when`: check that the task really uses the `command` module. A module such as `copy` would report `ok` by itself.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 7`.
