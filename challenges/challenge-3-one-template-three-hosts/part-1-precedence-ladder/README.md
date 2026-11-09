# Challenge 3, part 1: the precedence ladder

**Time:** about 40 minutes. **Download:** nothing. This part does not install anything. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You set `app_port: 8080` for the web servers. You deploy. One web server listens on 8081. You search your files, and you find `8081` in a file you forgot about. Which value did Ansible use, and why that one?

An Ansible project can set the same variable in many places. When two places disagree, Ansible does not stop and does not warn. It quietly picks one. If you do not know the order, you cannot predict the result, and you will fix the wrong file.

## The idea

A **variable** is a name with a value, such as `app_port: 8080`. You can define it in the inventory, in `group_vars`, in `host_vars`, in a role, in the play, on the command line, and more. **Precedence** is the order in which Ansible decides. A place with higher precedence **wins**.

Here are the six places you meet first, in the files of a project:

| Place | Where you write it |
|---|---|
| role defaults | `defaults/main.yml` inside a role |
| `group_vars/all` | `group_vars/all.yml` next to the playbook: every host |
| `group_vars/web` | `group_vars/web.yml`: the hosts in group `web` |
| `host_vars/web2` | `host_vars/web2.yml`: one host |
| play `vars` | the `vars:` key of a play |
| extra vars | `-e app_port=...` on the command line |

The documentation lists the full order of precedence, from least to greatest, with 22 lines. It is long, and it is easy to misremember. So you will not memorise it. You will measure it.

The idea of the experiment is simple. Make `app_port` say where it came from: each place sets `app_port` to its own name, such as `play-vars`. Add the places one at a time, from the weakest in the documentation to the strongest. After each one, run a playbook that prints `app_port`. If the documentation is right, the place you just added wins every time. If it does not win, you have found a place where the documentation and the real behaviour disagree.

## Your task

Before you run anything, guess. Open `my-guess.txt` in this folder. Write the six names of the table above, one per line, the weakest place first and the strongest last. Then run the experiment and see how many pairs you got right.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/my-guess.txt` | Write your guess. |
| 3 | `node challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/run.mjs` | Builds a small project in `work/`, adds 18 places one at a time, runs the playbook after each, and records the winner on `web1` and `web2`. Then it compares with your guess. Saves the facts. |
| 4 | `node toolkit/show-facts.mjs c3.p1` | Shows the saved facts. |
| 5 | Open the folder `work/` | Read the files the run wrote. After the run, every place is switched on. |
| 6 | `node --test challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/test.mjs` | The test passes. |

The run does not change the servers. It does start with `fleet reset`, like every part. The folder `work/` is rebuilt every time and is not saved in git.

## What you should see

The playbook has two tasks that print the value. One runs **inside a role**, the other runs **after the role** in the play. The ladder reads the second one, except for role params (see below).

On `web2`, every place wins as soon as it is added. This is the order that the real run measured, from the weakest to the strongest:

| # | Place | Winner on web1 | Winner on web2 |
|---|---|---|---|
| 1 | role defaults | itself | itself |
| 2 | inventory file group var (`[web:vars]`) | itself | itself |
| 3 | inventory `group_vars/all` | itself | itself |
| 4 | playbook `group_vars/all` | itself | itself |
| 5 | inventory `group_vars/web` | itself | itself |
| 6 | playbook `group_vars/web` | itself | itself |
| 7 | inventory file host var (`web2 app_port=...`) | no change (still 6) | itself |
| 8 | inventory `host_vars/web2` | no change (still 6) | itself |
| 9 | playbook `host_vars/web2` | no change (still 6) | itself |
| 10 | play `vars` | itself | itself |
| 11 | play `vars_files` | itself | itself |
| 12 | role vars (`vars/main.yml` in the role) | itself | itself |
| 13 | block `vars` | itself | itself |
| 14 | task `vars` | itself | itself |
| 15 | `include_vars` task | itself | itself |
| 16 | `set_fact` task | itself | itself |
| 17 | role params | itself (inside the role) | itself (inside the role) |
| 18 | extra vars (`-e`) | itself | itself |

"Itself" means the place you just added won. Places 7 to 9 only name `web2`, so `web1` keeps the value from place 6. This is why `host_vars/web2` is the way to make one host different.

**The real order is the documented order.** The run counts every step where the new place should have won and did not: `c3.p1.docs_mismatches` is 0. Three lines of the documentation are not tested: host facts and cached `set_fact`, `vars_prompt` (it asks a person) and include params.

Two things the table hides, and both are real findings:

1. **Role params are only visible inside the role.** You write them next to the role name: `- role: appconf` and then `app_port: role-params` on the next line. The task inside the role sees them. A task after the role does not: `'app_port' is undefined` and the play stops (look at step 21 in [results.md](results.md)). Role defaults and role vars are different: they are visible to later tasks in the play.
2. **`vars:` under a role is not a role param.** If you write the variable under a `vars:` key of the role entry, it is a weaker place than it looks. In the run it beat the role's own `vars/main.yml`, but `include_vars` and `set_fact` beat it. The documentation does not list this place by name.

The full recorded run, with every command and its output, is in [results.md](results.md). Your numbers will be the same.

![Rank of the place that wins on web2 as each place is added (18 is the strongest)](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c3.p1.sources_tested` | How many places the run added one by one (18). |
| `c3.p1.winners_web1`, `c3.p1.winners_web2` | The name that the probe task printed for each step, in order, joined with commas. |
| `c3.p1.docs_mismatches` | Steps where the place just added did not win on a host it applies to. |
| `c3.p1.core_order` | The six places of your guess file, in the measured order, weakest first. |
| `c3.p1.guess_pairs_right` | Of the 15 pairs of places in your guess, how many are in the measured order. |
| `c3.p1.role_params_inside_role`, `c3.p1.role_params_visible_after_role` | The value the task inside the role printed, and whether the task after the role could read the variable (false). |
| `c3.p1.role_entry_vars_beats_role_vars_file`, `c3.p1.include_vars_beats_role_entry_vars` | The two comparisons for `vars:` under a role (both true). |
| `c3.p1.guess_file` | The guess file the run used. The test reads it again. |

## What is different on Docker Desktop

Nothing. The playbook only prints variables, so it does not matter that the servers are containers.

## Stuck?

- `my-guess.txt needs these six names`: write each name once, one per line, with no extra words. Lines that start with `#` are ignored.
- The test says the winners differ from the ladder: do not edit `work/`. The run rebuilds it. Run `run.mjs` again.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 3`.
