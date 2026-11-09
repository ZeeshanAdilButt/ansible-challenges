# Results: Challenge 10, part 4: defend it

Recorded run. Machine: win32, Node 22.22.2. The maintainer run used the reference DEFENCE.md. Date: 2026-11-08.

## Step 1

**Command**

```sh
read DEFENCE.md: the five sections of the demo, the words, and the numbers followed by a unit that match facts.json
```

**Output**

```text
sections found: 5 of 5   words: 563 (about 3.8 minutes at 150 words a minute; the range is 300 to 800)
numbers quoted from your own facts: 10 of 14 that could be quoted
  c10.p1.stage_lint_s
  c10.p1.stage_apply_s
  c10.p1.stage_idempotence_s
  c10.p1.first_run_changed_count
  c10.p1.stages_total_count
  c10.p2.good_batches_count
  c10.p2.bad_changed_before_stop_count
  c10.p2.bad_untouched_count
  c10.p3.recover_s
  c10.p3.recover_min
```

**Note:** The shape is right and the numbers are yours. A mentor will check that the words are true.

## Step 2

**Command**

```sh
read DEFENCE.md: three questions and one troubleshooting question, 60 to 200 words each, each on the point
```

**Output**

```text
Question 1       142 words  ok
Question 2       131 words  ok
Question 3       134 words  ok
Troubleshooting  130 words  ok
```

**Note:** Each answer is the right length and names the ideas the question is about. The mentor decides whether it is good.

## Step 3

**Command**

```sh
score the rubric from facts.json: one line for each criterion
```

**Output**

```text
pass      6  fleet configured            site.yml configures all three hosts with no failed task
pass      4  fleet configured            a request to the proxy reaches the app and the app reaches the database
pass      1  fleet configured            redis refuses a client that has no password
pass      1  fleet configured            the app does not run as root
pass      3  fleet configured            requirements.yml pins every collection to one exact version, and a role us
pass      3  idempotence and tests       ansible-lint and the syntax check pass
pass      7  idempotence and tests       the second run of site.yml changes nothing (changed=0 on all three hosts)
pass      3  idempotence and tests       check mode on the finished fleet runs without a failure and finds no drift
pass      1  idempotence and tests       all seven stages of ci.mjs pass in order
pass      2  secrets                     the database password is in an encrypted vault file
pass      2  secrets                     the password is in no other file of the stack
pass      3  secrets                     nothing Ansible printed (check with --diff, apply, second run) shows the p
pass      1  secrets                     .vault-pass is git-ignored
mentor    4  secrets                     explains where the vault password lives, how CI gets it, and what to do if
pass      3  rollout safety              the rollout changes one host at a time (batches 1,1,1)
pass      2  rollout safety              a good rollout reaches all three hosts and the proxy then reports release 
pass      4  rollout safety              a bad change stops the rollout: one host failed, at most one changed befor
pass      2  rollout safety              rollout.yml says in words that a failure stops the rollout (any_errors_fat
mentor    7  rollout safety              explains what stopped the rollout with batches of one, and what would not 
mentor    3  rollout safety              says what was changed and what was not when the rollout stopped, from the 
pass      4  recovery                    after the recovery the proxy answers 200 with the app and database behind 
pass      3  recovery                    after the recovery, site.yml reports changed=0 on every host
pass      1  recovery                    every host is back on release 1 (the proxy header and the app agree)
pass      2  recovery                    the script recovers in 60 seconds or less (median of three, stop to green 
mentor    5  recovery                    RUNBOOK.md would work for a stranger at 3 am
pass      3  evidence and communication  RUNBOOK.md has an entry for the stopped rollout and one for the 502, with 
pass      2  evidence and communication  the runbook quotes the numbers your own run measured
pass      3  evidence and communication  DEFENCE.md is a five-minute demo outline with all five sections and 300 to
pass      2  evidence and communication  the demo quotes at least five numbers from your own facts
pass      2  evidence and communication  DEFENCE.md answers the three questions and the troubleshooting question, e
mentor    6  evidence and communication  the five-minute demo is true: every claim can be checked live
mentor    5  evidence and communication  answers the follow-up questions with a command or a file, not with a sloga
```

**Note:** Automated: 70 of 70 points, 100 %. The pass mark for the review is 80 %. The mentor scores another 30 points.

## Step 4

**Command**

```sh
the score for each area
```

**Output**

```text
fleet configured              15 of  15 automated,  0 for the mentor
idempotence and tests         14 of  14 automated,  0 for the mentor
secrets                        8 of   8 automated,  4 for the mentor
rollout safety                11 of  11 automated, 10 for the mentor
recovery                      10 of  10 automated,  5 for the mentor
evidence and communication    12 of  12 automated, 11 for the mentor
```

**Note:** A mentor reads the same six areas in under 45 minutes (RUBRIC-FOR-MENTORS.md), then asks one to three follow-up questions.
