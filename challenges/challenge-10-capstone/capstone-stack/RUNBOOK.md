# Runbook: the capstone fleet

This is the page a person opens at 3 am. Write one entry for each of the two failures you caused in parts 2 and 3:
the rollout that stopped, and the site that returns 502.
Be short and exact: what they see, what to type, what normal looks like.

## How to write an entry

Copy this template under "Entries" and fill every line. Each field needs at least a few words.
The **Check** line needs the commands in backticks. The **Measured** line needs a number from your own run.

```
### Name of the failure
- **Symptom:** what a person sees (a page that does not load, a rollout that stopped halfway)
- **Check:** the commands, in order, for example `node toolkit/ansible.mjs ansible web -i ... -m ansible.builtin.uri -a ...`
- **Cause:** what is really wrong
- **Fix:** what to do now
- **Prevention:** the setting or the code that stops it next time
- **Measured:** the number from your run (see below)
```

The two entries, and what each **Measured** line holds:

- The title must contain the word "rollout" for the stopped rollout. Measured: how many hosts changed before the stop, for example `1 host`. The number is in the results of part 2.
- The title must not contain "rollout" for the 502 entry. For example "The site returns 502". Measured: how long the recovery took, for example `48 s`. The number is in the results of part 3.

## Entries
