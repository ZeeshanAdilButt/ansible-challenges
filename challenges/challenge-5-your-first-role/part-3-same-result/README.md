# Challenge 5, part 3: same result, new shape

**Time:** about 45 minutes. **Download:** about 2 MB of Debian packages per web host, three times (every run starts on new targets). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

You moved a working playbook into a role. You believe the two are the same. But "I believe" is how a refactor breaks a server on a Friday. You moved five tasks, a handler, a template and a variable. Did you lose a mode, a newline, a path?

You need a **proof**, not a feeling. And the proof must be able to say "no".

## The idea

Run the old way and the new way on **new** targets, so no old state helps one of them. Then compare what they leave behind:

- The **recap**: how many tasks changed. The same work should give the same count.
- A **fingerprint** of each file they wrote. A **hash** (here `sha256`) is a short text computed from the content of a file. If one byte differs, the hash is completely different. If two hashes are equal, the files are equal.

A check you have never seen fail is a check you cannot trust. So the part also runs the role with a different port. The config file must change, and the index page must not.

## Your task

This part uses part 1: it runs `before.yml` and the role you built there. Finish part 1 first.

Open `files-to-compare.txt` in this folder. It is a list of paths, one per line. Read `before.yml` in part 1 and list every **file** it writes on the web hosts. Look for `dest:`. There are two.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-5-your-first-role/part-3-same-result/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-5-your-first-role/part-3-same-result/files-to-compare.txt` | List the two files. |
| 3 | `node challenges/challenge-5-your-first-role/part-3-same-result/run.mjs` | Resets the targets, runs the playbook and takes the hashes, resets, runs the role and takes the hashes, resets, runs the role with another port. About 4 minutes. |
| 4 | `node toolkit/show-facts.mjs c5.p3` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-5-your-first-role/part-3-same-result/test.mjs` | The test passes. |

## What you should see

The playbook and the role each say `changed=6` on both web hosts (12 in total) the first time, and `changed=0` the second time.

The hash command prints one line per file and host. Each host has a different config hash from the other host (the config has the host name in it), but **web1 has the same hash with the playbook and with the role**, and so has web2:

```text
web1 | CHANGED | rc=0 >>
<64 letters and digits>  /etc/nginx/conf.d/site.conf
<64 letters and digits>  /var/www/site/index.html
```

(The `CHANGED` word is only the `command` module being cautious. It cannot know that `sha256sum` only reads.)

The run with port 9090 changes only one fingerprint: the config file. The index page keeps its hash. That is the proof that the check can fail.

This is evidence for **these two files**. It does not prove that the packages, the service state or the file modes are equal. If you care about those, add them to the comparison: the same idea works with `stat`.

The full recorded run is in [results.md](results.md). Your hashes are the same as ours if your role is the same as ours.

![Changed tasks per run: playbook, role, and second runs](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c5.p3.hashes_equal` | The `sha256sum` lines of the playbook run and of the role run, compared per host and per file. True only if both web hosts and every listed file match. |
| `c5.p3.files_compared`, `c5.p3.hosts_compared` | The number of paths in `files-to-compare.txt`, and the number of hosts that printed hashes. |
| `c5.p3.changed_playbook`, `c5.p3.changed_role` and the `_second` versions | The `changed=` column of the play recaps, added up over the hosts. |
| `c5.p3.hashes_differ_with_other_port`, `c5.p3.differing_files_with_other_port` | The same hash lines after a role run with `-e site_port=9090`, compared with the playbook's. |

## What is different on Docker Desktop

Nothing for this part.

## Stuck?

- `files-to-compare.txt has no paths yet`: do the task above.
- `Part 1 is not finished`: the role `webserver` has no tasks yet. Finish part 1.
- `sha256sum: ... No such file or directory`: a path in your list is wrong. Copy it from `dest:` in `before.yml`.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 5`.
