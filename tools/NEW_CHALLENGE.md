# Start a new challenge from the challenge 1 pattern

For challenge builders. Challenge 1 (`challenges/challenge-1-first-contact`) is the pattern to copy. Read `toolkit/README.md` for the helper functions, and `challenges/challenge-1-first-contact/NOTES.md` for what the fleet does that may surprise you.

## The command

Run this from the repository root (replace the number, the challenge name and the part names):

```text
node tools/new_challenge.mjs 2 run-it-twice "part-1-first-playbook" "part-2-drift-and-check-mode"
```

It creates, for each part, `challenges/challenge-2-run-it-twice/part-N-name/` with:

| File | What is in it |
|---|---|
| `README.md` | The skeleton: problem, idea, step table, what you should see, where each number comes from, Docker Desktop box, safety link. |
| `run.mjs` | A working script that starts with `fleetReset()`, runs `ansible all -m ping`, uses `Recorder`, `setFact`, `barsSvg` and `cleanup`, and saves one example fact. |
| `test.mjs` | A `node:test` file that fails until `run.mjs` has been run (the fact is missing), checks the fleet is running, and checks the SAFETY link. |

`results.md` and `chart.svg` are not created by hand. Run the part with `--record` and they are written for you.

Then replace the example step with the real experiment. Put the Ansible files the part needs (playbooks, templates, `my-...` files for the learner) in the part folder. Commands run in the control container from `/work`, so a path in a command is the path inside the repository, for example `challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml`.

## The rules every part follows

1. First lines of the README: the problem (why the learner cares), then the idea, then the step table. Never a command list first. Short sentences, plain words, define each term on first use. Say the download size before any pull.
2. Everything the toolkit creates for a challenge is named `anp-c<N>-...` and labelled `anp.challenge=<N>` (`name(N, 'what')`, `label(N)` and `safeArgs(N, 'what')` in `toolkit/docker.js`). The fleet is the compose project `anp` with the label `anp.fleet=1`. **If you work next to other builders, set `ANP_PROJECT=anp-b<N>` in your terminal first.** Without it, your `fleet reset` replaces the other builder's fleet. See "Running a second fleet" in `toolkit/README.md`.
3. End every `run.mjs` with `cleanup(N)` in a `finally` block. Never use `docker system prune`, `docker volume prune` or `docker image prune`. Never remove something you did not create. Never kill processes by name.
4. Start every `run.mjs` with `await fleetReset()` so the part can be run again. Say in the README what state the part leaves the fleet in (running, with what changed).
5. No `--privileged`. The Docker socket is mounted only into the Molecule container from challenge 7, and the README names it as the one exception.
6. Pin every image and every package version you add. Keep images small, and use the images the fleet already has.
7. Save numbers with `setFact('c<N>.p<M>.<what>_<unit>', value)`. Time is measured, never guessed. Use the median of three runs where timing matters (`median` from `toolkit/stats.js`). Count things on the raw output (`countLines`), then record `compactOutput(raw)` in `results.md`.
8. Record the run: `node challenges/challenge-N-name/part-M-name/run.mjs --record` writes `results.md` (command, output, one-line note per step) and `chart.svg`. The commands in `results.md` must be commands a learner can type.
9. Tests read facts and also check live state (the fleet, `ansible-inventory` on the learner's file, ...). The first run of a test in a fresh starter must fail with a message that says what to do.
10. Put fixed answers and solutions in a `reference/` folder inside the part, and add a `--reference` flag to `run.mjs` for maintainers (see challenge 1, part 2). `tools/make_starter.mjs` leaves every `reference/` folder, every `NOTES.md`, `facts.json`, `keys/`, `collections/` and `.vault-pass` out of the starter.
11. Write every real error you met into `challenges/challenge-N-name/NOTES.md`: the exact message, the cause, the fix.
12. No em dashes and no en dashes anywhere (`node --test toolkit/test.mjs` checks the whole repository). Zero npm dependencies. Node 22 or newer, ESM, `node:test`.

## Check your part

```text
node --test "challenges/challenge-2-run-it-twice/**/test.mjs"
node toolkit/cleanup.mjs 2
docker ps -a --filter label=anp.challenge=2
```

The last command must print no containers. Also run `node --test challenges/challenge-1-first-contact/**/test.mjs` if you changed anything in `toolkit/`.

## Make the learner starter

```text
node tools/make_starter.mjs C:/path/to/new-empty-folder
```

It copies the tree without the left-out files above. Use `ANP_PROJECT=anp-starter` for the fleet commands you run in the starter, so they do not touch your own fleet. In the starter, run the tests of your challenge (they fail), do the learner's task, run the `run.mjs` files, run the tests again (they pass), then `node toolkit/fleet.mjs down` and delete the starter folder.
