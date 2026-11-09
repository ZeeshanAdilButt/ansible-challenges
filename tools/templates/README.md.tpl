# Challenge @@N@@, part @@M@@: @@TITLE@@

**Time:** about 45 minutes. **Download:** TODO (say the size before any pull; the fleet images are already built from challenge 1). **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

TODO. Why does the learner care? Start from a real situation: what broke, what it cost, what they could not see. Two to four short sentences.

## The idea

TODO. The 101 for the idea in plain words. Say what the thing is before you say how to run it. Define each term on first use.

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/@@CHALLENGE_DIR@@/@@PART_DIR@@/test.mjs` | The test fails on purpose. Read the message. |
| 2 | `node challenges/@@CHALLENGE_DIR@@/@@PART_DIR@@/run.mjs` | TODO what the experiment does. It starts with `fleet reset`, so you can run it again. |
| 3 | `node toolkit/show-facts.mjs c@@N@@.p@@M@@` | Shows the saved numbers. |
| 4 | `node --test challenges/@@CHALLENGE_DIR@@/@@PART_DIR@@/test.mjs` | The test passes. |

## What you should see

TODO. Show the key lines of the output. Link the full recorded run: [results.md](results.md).

![TODO chart title](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c@@N@@.p@@M@@.example_s` | Median of three timed runs. |

## What is different on Docker Desktop

TODO. If nothing differs, say so in one line.

## Stuck?

- `Docker is not ready`: start Docker and wait until it says running.
- `The control container is not running`: `node toolkit/fleet.mjs up`.
- A host is in a bad state: `node toolkit/fleet.mjs reset` makes all targets new again.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs @@N@@`.
