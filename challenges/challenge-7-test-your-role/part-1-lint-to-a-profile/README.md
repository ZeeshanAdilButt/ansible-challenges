# Challenge 7, part 1: lint to a profile

**Time:** about 45 minutes. **Download:** nothing (the fleet images are already built from challenge 1). **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

A playbook can run fine and still be bad. It can hide what it does (tasks with no name), change things on every run (a `command` with no `changed_when`), or break on the next Ansible version (a short module name that is now ambiguous). Nobody sees this until something fails at night. A person reading the code will miss half of it. A tool will not.

## The idea

A **linter** reads your code and reports problems without running it. `ansible-lint` is the linter for Ansible. Each problem it reports is a **finding**, and each finding has a **rule** name, for example `fqcn[action-core]` (use the full module name) or `no-changed-when` (a command should say when it changed something).

Rules are grouped into **profiles**. A profile is a set of rules for one level of quality. Each profile includes all the rules of the one before it:

| Profile | What it asks for |
|---|---|
| `min` | The files load. Ansible can read them. |
| `basic` | Names, YAML style, no free-form arguments, no obvious mistakes. |
| `moderate` | Better naming and module use (for example a module instead of `systemctl`). |
| `safety` | Avoid risky constructs. |
| `shared` | Ready to share as a role or collection (metadata). |
| `production` | Everything. The strictest. |

You pick the profile you want to meet. `ansible-lint --profile production` fails if any rule up to `production` finds anything. Without `--profile` it runs every rule, and its last line names the highest profile that passed.

## Your task

`sloppy/` holds a playbook and a role with problems on purpose. **Do not edit it.** `fix-me/` is a copy. Fix `fix-me/` until it passes the profile **production**. The `TODO` comments in the files say where to start. Read each finding: it names the rule, the file and the line.

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`. `ansible-lint` runs in the control container.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | `node toolkit/ansible.mjs ansible-lint challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml` | See the findings on the sloppy code. |
| 3 | `node toolkit/ansible.mjs ansible-lint --profile production challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/fix-me/site.yml` | Lint your copy. Fix, run again, repeat. |
| 4 | `node challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/run.mjs` | Counts the findings per profile for the sloppy code, lints your copy, and saves the facts. |
| 5 | `node toolkit/show-facts.mjs c7.p1` | Shows the saved numbers. |
| 6 | `node --test challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/test.mjs` | The test passes. |

The fleet is not changed by this part. It keeps running.

## What you should see

On the sloppy code, `ansible-lint` finds **33** findings with the default settings, and the last line says `Last profile that met the validation criteria was 'min'`. Counted per profile with `--profile` (from `-f json`):

| Profile | Findings |
|---|---|
| min | 0 |
| basic | 16 |
| moderate | 19 |
| safety | 19 |
| shared | 23 |
| production | 33 |

The count only stays or goes up as the profile gets stricter. The most common rules: `fqcn[action-core]` (10), `no-free-form` (6), `name[missing]` (5), `no-changed-when` (3), `name[casing]` (3), `yaml[truthy]` (3).

Which rule belongs to which profile? The run asks for each profile and records the lowest one that reports the rule (the rule also reports in every stricter profile). `ansible-lint -P` prints the same list.

| Profile | Rules the sloppy code hit |
|---|---|
| basic | `command-instead-of-module`, `name[missing]`, `name[play]`, `no-free-form`, `yaml[truthy]` |
| moderate | `name[casing]` |
| shared | `ignore-errors`, `no-changed-when` |
| production | `fqcn[action-core]` |

**A trap:** the `Rule Violation Summary` at the end of the default run prints `profile:basic` after every rule, even `fqcn` and `ignore-errors`. In this run the word was the same on all nine lines, so do not read a rule's profile from it. Use the table above or `ansible-lint -P`.

After your fix, `--profile production` finds **0**, and the default run says `Last profile that met the validation criteria was 'production'`.

The full recorded run is in [results.md](results.md).

![ansible-lint findings per profile, and after the fix](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c7.p1.findings_default` | Length of the JSON list from `ansible-lint -f json site.yml` in `sloppy/`. |
| `c7.p1.findings_min` ... `c7.p1.findings_production` | The same, with `--profile <name>`. |
| `c7.p1.highest_profile_before` | The profile named in the last line of the default run on `sloppy/`. |
| `c7.p1.rule_profiles` | For each rule in the default run on `sloppy/`, the first profile whose `-f json` run reports it, written as `rule:profile,...`. |
| `c7.p1.summary_profile_labels` | The `rule:profile` pairs exactly as the summary of the default run printed them (all `basic`). Kept to show the trap. |
| `c7.p1.findings_fixed` | Findings of `--profile production` on your `fix-me/`. |
| `c7.p1.highest_profile` | The profile named in the last line of the default run on your `fix-me/`. |

## What is different on Docker Desktop

Nothing for the findings. A lint run takes 10 to 20 seconds on Docker Desktop, because the files are read from a Windows folder. The run does about twenty lint runs, so it takes several minutes.

## Stuck?

- `--profile min` says `Profile 'min' was required, but 'production' profile passed`. That sentence is confusing: with a profile chosen, only the rules up to that profile run, so nothing checked `production`. Use the default run (no `--profile`) to see the highest profile that really passed.
- `ansible-lint` complains about a YAML parse error: indent with spaces, two per level.
- `fqcn[action-core]`: use `ansible.builtin.copy`, not `copy`.
- A free-form task such as `apt: name=nginx state=present` becomes YAML keys under the module name.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 7`.
