# Challenge 6, part 1: lock the secret in a vault

**Time:** about 45 minutes. **Download:** nothing (the fleet images are already built from challenge 1). **Safety rules:** [SAFETY.md](../../../SAFETY.md)

Every secret in this challenge is **fake**. The password in `vars/secrets.yml` is `demo-secret-not-real-0001`. The vault password is a throwaway that this part makes for you. Never put a real secret in a course file.

## The problem

Your playbook needs a database password. Where do you keep it? If it sits in `vars/secrets.yml` as plain text, anyone who can read the repository can read the password. That includes everyone who ever cloned it, and every old copy of it on every laptop. A password in Git is public for good: you can delete the file, but not the history.

You need a way to keep the secret in the repository without showing it.

## The idea

**Ansible Vault** encrypts a file (or one value) with a password. The encrypted file is safe to commit. Ansible decrypts it in memory, only while a playbook runs, if you give it the password.

An encrypted file starts with one line, the **vault header**:

```text
$ANSIBLE_VAULT;1.1;AES256
```

After it come lines of hex. The hex is the secret, scrambled with the password. `AES256` is the cipher.

You give Ansible the password with `--vault-password-file`. A **password file** is a file that holds the password and nothing else. It stays on your machine and Git ignores it (`.vault-pass` is in `.gitignore`).

Three things to watch for:

- **A wrong password stops the run before any host is touched.** Ansible cannot read the variables, so it does not start.
- **The vault protects the secret at rest** (on disk, in Git). It does not protect what a playbook does with the secret later. That is parts 2 and 3.
- **A vaulted file shows no secret in `git diff`.** It also shows no useful change: when anything changes, the whole block changes. You cannot review it.

## Your task

`vars/secrets.yml` is plain text today. Encrypt it. Step 3 shows the command.

## Steps

Start the fleet first if it is not running: `node toolkit/fleet.mjs up`. Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-6-find-the-leak/part-1-vault/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | `node challenges/challenge-6-find-the-leak/part-1-vault/run.mjs --make-password` | Makes `challenges/challenge-6-find-the-leak/.vault-pass` (a random throwaway, ignored by Git, used by all three parts) and copies it into the control container as `/home/learner/.vault-pass`. |
| 3 | `node toolkit/ansible.mjs ansible-vault encrypt --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml` | Encrypts the file in place. Open it and look. |
| 4 | `node toolkit/ansible.mjs ansible-vault view --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml` | Shows the secret again, on screen only. |
| 5 | `node challenges/challenge-6-find-the-leak/part-1-vault/run.mjs` | Starts with `fleet reset`. Runs `encrypt_string`, `view`, `edit`, a playbook with the password file, a wrong password, no password, and a `git diff` demo. Saves the facts. |
| 6 | `node toolkit/show-facts.mjs c6.p1` | Shows the saved numbers. |
| 7 | `node --test challenges/challenge-6-find-the-leak/part-1-vault/test.mjs` | The test passes. |

The fleet keeps running after this part. `web1` and `web2` hold `/etc/demo-app/app.conf` (mode 600). `node toolkit/fleet.mjs reset` removes it.

Why is the password copied into the container? On Docker Desktop, every file from a Windows folder looks **executable** inside a container. Ansible runs an executable password file as a program, and fails with `Exec format error` (see `NOTES.md`). A copy made inside the container, with mode 600, is read as a normal file.

## What you should see

The encrypted file starts with the header and then hex. The secret appears in it **0 times**. `view` shows it again. Run 1 changes `web1` and `web2`. Run 2 changes nothing: the vault does not break idempotence.

With the wrong password, Ansible stops at once and exits with code 1. It prints `Decryption failed (no vault secrets were found that could decrypt)` and does not start the play. With no password at all it prints `Attempting to decrypt but no vault secrets found`.

`ansible-vault edit` fails in the control container: it has no editor installed (it prints `Unable to execute the command "vi ...": No such file or directory`). The run sets `EDITOR` to a `sed` command so that `edit` can work without a keyboard.

In the `git diff` demo, the plain file shows the old and the new secret in the diff. The vaulted file shows hex lines that changed from top to bottom: all 18 lines of its diff (9 removed, 9 added), where the plain file changed 2 lines.

The full recorded run is in [results.md](results.md). The hex in your run will be different, because the encryption adds random salt each time.

![Hosts changed by the vaulted run, and times the secret shows in the vault file](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c6.p1.header` | The first vault header printed by `ansible-vault encrypt_string`. |
| `c6.p1.run_ok` | Exit code 0 of the playbook run with `--vault-password-file`. |
| `c6.p1.changed_first`, `c6.p1.changed_second` | Hosts with `changed` above 0 in the two recaps. |
| `c6.p1.wrong_password_error` | True when the wrong password gave exit code 1, the text `Decryption failed`, and no `TASK` line (nothing ran). |
| `c6.p1.no_password_exit_code` | Exit code of the run with no password. |
| `c6.p1.plain_hits_in_vault_file` | How many lines of your encrypted file contain the secret (`grep -c`). |
| `c6.p1.diff_plain_shows_secret`, `c6.p1.diff_vault_shows_secret` | Whether the secret appears in `git diff` of a plain file and of a vaulted file, in a small demo repository inside the control container. |
| `c6.p1.diff_vault_changed_lines` | Lines removed or added in the vaulted diff: every line after the first `@@` line that starts with `-` or `+`. It is 18 (9 removed, 9 added), the same number that `git diff --stat` prints for the file. The last, short line of each block counts too. |
| `c6.p1.target_file_mode` | `stat -c %a` of `/etc/demo-app/app.conf` on `web1`. |

## What is different on Docker Desktop

Two things. Files from a Windows folder look executable inside the container, so the password is copied into the container first (see above). On Linux you could point `--vault-password-file` at the file in your repository directly, if it is not executable (`chmod 600 .vault-pass`). And the Docker Desktop copy lives only as long as the control container: `node toolkit/fleet.mjs down` removes it, and step 2 makes it again.

## Stuck?

- `Exec format error` or `Problem running vault password script`: the password file is executable. Use the copy in `/home/learner/.vault-pass` (step 2).
- `Decryption failed` with the right file: you made a new `.vault-pass` after you encrypted. Encrypt the file again with the new password, or restore the old password file.
- `Unable to execute the command "vi ..."`: `ansible-vault edit` needs an editor. Set `EDITOR` (see the recorded run).
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 6`.
