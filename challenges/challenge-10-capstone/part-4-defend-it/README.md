# Challenge 10, part 4: defend it

**Time:** about 1 hour. **Download:** nothing. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You can build a thing and still not be able to explain it. Your mentor has 45 minutes and a list of questions. They are not asking "does it run". They already know, because the script told them. They are asking whether *you* know why it runs, and what you would do when it does not.

This part is your preparation. You write down what you would say in five minutes, and answer four questions in writing. The script checks the shape and your numbers. A mentor then checks that the words are true.

## The idea

A good five-minute demo has no surprise in it. Every number is a number you measured, and you can show it. So the demo is built from your own facts: seconds per stage, tasks changed on the first run, hosts changed before the rollout stopped, seconds to recover. The script compares each number you write with `facts.json` (a number followed by its unit, for example `38.3 s`, `14 tasks`, `7 stages`, `3 batches`, `1 host`).

The four questions are the ones a mentor is most likely to ask. They are about the choices you made in parts 1 to 3, not about facts you can look up:

- What stops a rollout when one host fails, and what changes with batches of two?
- Where is the vault password, and how does CI get it without it entering the repository?
- What makes a task report `changed` on every run, and how do you find it?
- The site answers 502 through the proxy: what do you check, in order?

## Your task

Open `challenges/challenge-10-capstone/capstone-stack/DEFENCE.md`. It has five sections for the demo and four questions. Write under each heading. Delete the lines in brackets as you go. Leave the lines that start with `>` (they are the questions).

- The demo: 300 to 800 words in all, five sections, at least five of your numbers, each with its unit.
- Each answer: 60 to 200 words, on the point. Name a keyword, a command or a file.

## Steps

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-10-capstone/part-4-defend-it/test.mjs` | The test **fails** on purpose, and says what is missing. |
| 2 | Write `capstone-stack/DEFENCE.md` | Use your own numbers: `node toolkit/show-facts.mjs c10`. |
| 3 | `node challenges/challenge-10-capstone/part-4-defend-it/run.mjs` | Checks the shape, the words, the numbers and the answers. Scores the whole rubric and prints one line for each criterion. No Docker needed. |
| 4 | `node --test challenges/challenge-10-capstone/part-4-defend-it/test.mjs` | The test passes when the demo and the answers are in shape and the automated score is 80 % or more. |
| 5 | `node challenges/challenge-10-capstone/tools/capstone-check.mjs` | Optional: the whole capstone in one command, as CI runs it. About 12 minutes. |

## What you should see

`run.mjs` prints the rubric. Each criterion has one of four words:

- `pass`: the script measured it, and it is met.
- `fail`: the script measured it, and it is not met. The line below says what is wrong, in a sentence.
- `not run`: a fact is missing. Run the part that makes it.
- `mentor`: the criterion is scored by the mentor, in the review. The script lists it with its points.

**70 of the 100 points are automated.** The pass mark to book the review is 56 of 70 (80 %). The mentor scores 30 more. [RUBRIC-FOR-MENTORS.md](../RUBRIC-FOR-MENTORS.md) shows what the mentor looks for in each, so you can prepare for the same questions.

The recorded run is in [results.md](results.md). It was made with the reference files, so it shows what a complete capstone looks like.

![Automated rubric points earned by area](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c10.p4.defence_words_count`, `c10.p4.defence_sections_count` | Words in the demo part of `DEFENCE.md` (everything before "Question 1", without headings, bracket lines and quoted questions), and how many of the five section headings exist. |
| `c10.p4.defence_numbers_matched_count`, `c10.p4.defence_numbers_possible_count` | A number with its unit in the demo that is close to a fact (seconds within half a second or 5 %, so `29` matches `29.4 s`; counts exact). `possible` is how many of those facts exist on your machine. |
| `c10.p4.questions_ok_count`, `c10.p4.questions_total_count` | Answers of 60 to 200 words that mention the ideas of their question (for example, `serial` and a stop keyword for question 1). |
| `c10.p4.rubric_points_earned`, `c10.p4.rubric_points_available`, `c10.p4.rubric_percent`, `c10.p4.rubric_mentor_points` | The sum over all criteria of the parts you ran. Facts from parts 1 to 3 must exist, so run them first. |

## What the script cannot tell

It cannot tell whether your answer is good. It checks that you named the things the question is about. A long answer that repeats the question passes the length rule and fails the mentor. The way to prepare: say each answer out loud once, and point at a file or a line of `results.md` for each claim.

## What is different on Docker Desktop

Nothing here touches Docker. The numbers you quote come from your own parts 1 to 3, which ran on your machine, so they will not be the numbers in the recorded run.

## Stuck?

- `c10.p1.<name> is missing: run the part first`: the rubric reads the facts of parts 1 to 3. Run them in order.
- "does not mention": read the question again and add the keyword or the command it asks for. The message says what is missing.
- "N words, at least 60 needed": the bracket line `(Your answer.)` does not count. Write the answer.
- "0 of your numbers appear in the demo": write the number and its unit together (`17.6 s`, not `17.6`), and use your own numbers: `node toolkit/show-facts.mjs c10`.
- The score is below 56 of 70: the table says which criterion failed and the hint says how. Fix it in the part that measures it, run that part again, then run this one.

## Done

When part 4 passes, book the review. Bring the `capstone-stack` folder, `facts.json` and the four `results.md` files. The mentor reads the same list you just did.
