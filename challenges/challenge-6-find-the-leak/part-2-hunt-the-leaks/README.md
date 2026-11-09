# Challenge 6, part 2: hunt the leaks

**Time:** about 60 minutes. **Download:** nothing. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

Every secret here is **fake** (`demo-secret-not-real-0001`). The vault password is a throwaway made by `run.mjs`.

## The problem

Part 1 put the secret in a vault. So the secret is safe now, right? Not yet. The vault protects a file on disk. The moment a playbook uses the secret, it can print it, log it, put it on a command line, or write it into Git. Each of those is a **leak**: the secret shows up in a place you did not choose.

Most leaks are not attacks. They are a task that someone wrote on a Friday, a `-v` that someone added to find a bug, a CI log that everyone on the team can read. You cannot fix a leak you have not found. So first we hunt.

## The idea

A **leak** is any place where a secret can be read by someone who should not read it. Look in four kinds of places:

- **The run output.** What `ansible-playbook` prints: tasks, loop items, results.
- **The verbose flags.** `-v` prints the result of every task. More `v`s print more.
- **The process list.** A command line is public to every user on the host: `ps -eo args` shows it.
- **Git history.** Deleting a file makes it disappear from the working copy. The old commit still holds it.

`leaky.yml` is a playbook that leaks on purpose, in four ways. It takes the password from the vault, and still leaks it:

| Task | The mistake |
|---|---|
| Show the database password | A `debug` task with the variable. |
| Create the service accounts | A loop whose items hold the password. Ansible prints each item. |
| Read the config back | Runs `cat` on the config and stores the result. With `-v` the whole result is printed. |
| Start the report job | The password is on the command line of a job that runs for two minutes. |

The project in `scratch-repo/` (made by `run.mjs`) has a fifth leak: it has three commits, and the second one added `settings.env` with the password in it. The third commit deleted the file.

You count **lines that show the secret**. A line is one line of output, or one line of `git log -p`.

## Your task

Run the part once. Then look for the secret yourself, in each place, and write down how many lines show it in `my-hunt.txt`. The `TODO` in that file lists the five places. `run.mjs` checks your numbers against the scanner. It says only which numbers are not right, never the true count, so look again where it says so.

How to look:

| Place | How you look |
|---|---|
| `debug`, `loop`, `registered` | Open `leaky-output.txt` (the saved run). Search for `demo-secret-not-real-0001`. Count the lines. |
| `process_list` | `docker exec anp-web1 ps -eo args` and `docker exec anp-web2 ps -eo args` while the job runs (two minutes after the run). The recorded run prints the lines for you. If you set `ANP_PROJECT`, the container names start with that name. |
| `git_history` | `git -C challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/scratch-repo log --all -p` and count the lines with the secret. |

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | `node challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/run.mjs` | Starts with `fleet reset`. Makes a throwaway password, the vault, and the project with its history. Runs `leaky.yml` with `-v`, saves the output in `leaky-output.txt`, and scans. It also checks your `my-hunt.txt` and tells you which of the five numbers are right and which are not. It does not tell you the true counts: the scanner table is printed only when all five are right. |
| 3 | Edit `challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/my-hunt.txt` | Put your counts after the equals signs. |
| 4 | `node challenges/challenge-6-find-the-leak/scan.mjs challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/leaky-output.txt challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/scratch-repo` | The scanner by hand: output file and repository folder. Part 3 uses it again. |
| 5 | `node challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/run.mjs` | Run again until your counts match. |
| 6 | `node toolkit/show-facts.mjs c6.p2` | Shows the saved numbers. |
| 7 | `node --test challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/test.mjs` | The test passes. |

The fleet keeps running after this part. `web1` and `web2` run a job for two minutes that holds the fake password on its command line. `node toolkit/fleet.mjs reset` removes it.

## What you should see

The recorded run finds **12 lines** in five places:

| Place | Lines | Why that number |
|---|---|---|
| debug task | 2 | One line per host. |
| loop item | 4 | Two items on two hosts. |
| registered result (`-v`) | 2 | One line per host. Without `-v` there would be none. |
| process list | 2 | One command line per host. |
| git history | 2 | One line where the password was added, one where it was deleted. |

Two things did **not** leak, and they matter:

- The `copy` task that writes the password into a file does **not** print the content, even with `-v`. Ansible hides the `content` argument of `copy`.
- No file in the repository holds the secret now (0). The history still does.

The full recorded run is in [results.md](results.md).

![Lines that show the secret, per place](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c6.p2.leaks_debug`, `..._loop`, `..._registered` | Lines of the saved run (`ansible-playbook -v`) that contain the secret, counted under the task they belong to. |
| `c6.p2.leaks_process_list` | Lines of `ps -eo args` on `web1` and `web2` that contain the secret, read right after the run. |
| `c6.p2.leaks_git_history` | Lines of `git log --all -p` in `scratch-repo` that contain the secret. |
| `c6.p2.leaks_git_files_now` | Files in the working tree of `scratch-repo` that contain the secret. |
| `c6.p2.leaks_other_tasks` | Lines under any other task. It is 0: the leaks are only where the table says. |
| `c6.p2.leaks_total`, `c6.p2.places_leaking` | The sum, and the number of places with at least one line. |
| `c6.p2.copy_task_leaked` | Lines under the task "Write the app config" (a `copy` with `content`). It is 0. |
| `c6.p2.my_hunt_correct` | True when every number in your `my-hunt.txt` equals the scanner's. |

## What is different on Docker Desktop

Nothing for the counts. The git history is made inside the control container, in a folder of your repository that Git ignores (`scratch-repo/`). If you read it with Git on your machine, Git may ask you to trust the folder (`safe.directory`).

## Stuck?

- `Your counts ... do not match yet`: read the lines `run.mjs` prints. They name the places that are not right and never the number. Search that place again, and remember: a line counts once, even if the secret is in it twice.
- `ps` shows nothing: the job runs for two minutes after the playbook. Run `run.mjs` again and look at once.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 6`.
