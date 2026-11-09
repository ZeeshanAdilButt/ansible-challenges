# Defence: the capstone fleet

Write what you would say in a five-minute demo: about 150 words a minute, so 300 to 800 words in the five sections.
Use your own numbers (`node toolkit/show-facts.mjs c10`). Write each number with its unit, for example `44 s`, `14 tasks`, `7 stages` or `1 host`.
Delete the lines in brackets as you write. Leave the lines that start with > (they are the questions). Then answer the questions at the end, each in 60 to 200 words.

## The fleet

(The three hosts and what each one does. What a request to the proxy goes through. How many tasks the first run changed and what the second run said.)

## The pipeline

(The seven stages of ci.mjs, in order, and how many seconds the slow ones took. What lint and check mode catch that a run does not. Where the secret lives and how you know it never printed.)

## The rollout

(What serial does, and what happens to a failed host in a batch of one and in a batch of two. The play keyword you chose to stop a bad rollout, and why. How many hosts changed before the stop, and how many were never touched.)

## The failure and the recovery

(What the site looked like when the rollout stopped. What recover.yml does. How many seconds the recovery took, measured from the stop to the first 200, and what that number does not include.)

## At ten times the fleet

(What you would change if there were thirty hosts in three groups, or three hundred. Keep it to what you have seen in this challenge.)

## Question 1

> Your rollout used `serial: 1`. What stops it when one host fails? What would change with `serial: 2`, and what did you add so the rule does not depend on the batch size?

(Your answer.)

## Question 2

> Where is the vault password, and how does CI get it without it entering the repository?

(Your answer.)

## Question 3

> Your second run says `changed=0`. What makes a task report changed on every run, and how do you find it?

(Your answer.)

## Troubleshooting

> The site answers 502 through the proxy. What do you check, in order?

(Your answer.)
