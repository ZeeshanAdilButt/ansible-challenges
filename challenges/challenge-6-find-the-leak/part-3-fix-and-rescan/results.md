# Results: Challenge 6, part 3: fix the leaks and scan again

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. All secrets are fake.. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -v --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/leaky.yml
```

**Output**

```text
    "db_password": "demo-secret-not-real-0001"
    "db_password": "demo-secret-not-real-0001"
changed: [web1] => (item={'name': 'reporting', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/reporting.pw" ... [317 more characters left out]
changed: [web2] => (item={'name': 'reporting', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/reporting.pw" ... [316 more characters left out]
changed: [web1] => (item={'name': 'backup', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/backup.pw", "gid ... [308 more characters left out]
changed: [web2] => (item={'name': 'backup', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/backup.pw", "gid ... [307 more characters left out]
ok: [web2] => {"changed": false, "changed_when_result": false, "cmd": ["cat", "/etc/demo-app/app.conf"], "delta": "0:00:00.008484", "end": "2026-11-08 18:20:20.660403", "msg": "", "rc": 0, "start": "2026-11-08 18:20:20.651919", "s ... [169 more characters left out]
ok: [web1] => {"changed": false, "changed_when_result": false, "cmd": ["cat", "/etc/demo-app/app.conf"], "delta": "0:00:00.015640", "end": "2026-11-08 18:20:20.689847", "msg": "", "rc": 0, "start": "2026-11-08 18:20:20.674207", "s ... [169 more characters left out]
```

**Note:** The leaky run from part 2, as a starting point.

## Step 2

**Command**

```sh
node challenges/challenge-6-find-the-leak/scan.mjs challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/leaky-output.txt challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/scratch-repo
```

**Output**

```text
Searched for: demo-secret-not-real-0001
  2  debug task
  4  loop item
  2  registered result (-v)
  0  any other task
  2  process list on the targets
  0  files in the repository now
  2  lines in git history (log -p)
 12  TOTAL
```

**Note:** Before: 12 lines show the secret. The line above this note lists only the lines that do.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-vault view --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/vars/secrets.yml
```

**Output**

```text
# FAKE value for the course. It is not a real secret.
db_password: demo-secret-not-real-0002
```

**Note:** The secret is rotated: the vault now holds a new fake value. The old one must be treated as burnt.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -v --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/fixed.yml
```

**Output**

```text
Using /work/ansible.cfg as config file

PLAY [Deploy the demo app] *****************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Make the config folder] **************************************************
changed: [web2] => {"changed": true, "gid": 0, "group": "root", "mode": "0755", "owner": "root", "path": "/etc/demo-app", "size": 4096, "state": "directory", "uid": 0}
changed: [web1] => {"changed": true, "gid": 0, "group": "root", "mode": "0755", "owner": "root", "path": "/etc/demo-app", "size": 4096, "state": "directory", "uid": 0}

TASK [Write the app config] ****************************************************
changed: [web1] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}
changed: [web2] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}

TASK [Create the service accounts] *********************************************
changed: [web1] => (item=(censored due to no_log)) => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}
changed: [web2] => (item=(censored due to no_log)) => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}
changed: [web1] => (item=(censored due to no_log)) => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}
changed: [web2] => (item=(censored due to no_log)) => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}

TASK [Read the config back] ****************************************************
ok: [web1] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": false}
ok: [web2] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": false}

TASK [Start the report job] ****************************************************
changed: [web2] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}
changed: [web1] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": true}

PLAY RECAP *********************************************************************
web1                       : ok=6    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Your fixed playbook, run with -v again.

## Step 5

**Command**

```sh
node challenges/challenge-6-find-the-leak/scan.mjs challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/fixed-output.txt challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/scratch-repo demo-secret-not-real-0002
```

**Output**

```text
Searched for: demo-secret-not-real-0002
  0  debug task
  0  loop item
  0  registered result (-v)
  0  any other task
  0  process list on the targets
  0  files in the repository now
  0  lines in git history (log -p)
  0  TOTAL
```

**Note:** After: 0 lines show the new secret.

## Step 6

**Command**

```sh
git -C challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/scratch-repo log --all -p | grep -c demo-secret-not-real-0001
```

**Output**

```text
2
```

**Note:** The old secret is still in git history. A fix in the code cannot remove it. That is why the secret was rotated.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -v --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/label-only.yml
```

**Output**

```text
ok: [web1] => (item=reporting) => {"ansible_loop_var": "item", "changed": false, "checksum": "6616e057df45ac268e9726514361f83dc4d03dea", "dest": "/etc/demo-app/reporting.pw", "gid": 0, "group": "root", "item": {"name": "reporting" ... [153 more characters left out]
ok: [web1] => (item=backup) => {"ansible_loop_var": "item", "changed": false, "checksum": "6616e057df45ac268e9726514361f83dc4d03dea", "dest": "/etc/demo-app/backup.pw", "gid": 0, "group": "root", "item": {"name": "backup", "passwo ... [141 more characters left out]
```

**Note:** With only a label, -v shows the secret on 2 lines: the label changes the (item=...) text, and the item is still inside the result.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/label-only.yml
```

**Output**

```text
TASK [Gathering Facts] *********************************************************
ok: [web1]
TASK [Make the config folder] **************************************************
ok: [web1]
TASK [Create the service accounts] *********************************************
ok: [web1] => (item=reporting)
ok: [web1] => (item=backup)
```

**Note:** Without -v, the same playbook shows the secret on 0 lines.

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook --diff --skip-tags error-text --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/what-no-log-hides.yml
```

**Output**

```text
TASK [Gathering Facts] *********************************************************
ok: [web1]
TASK [Make the config folder] **************************************************
ok: [web1]
TASK [Write a file without no_log] *********************************************
--- before
+++ after: /etc/demo-app/plain.conf
+DB_PASSWORD=demo-secret-not-real-0002
changed: [web1]
TASK [Write a file with no_log] ************************************************
changed: [web1]
TASK [Run a command that has the secret in it] *********************************
ok: [web1]
```

**Note:** With --diff, a copy task without no_log prints the file content it wrote. The one with no_log does not.

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -v --skip-tags error-text --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/what-no-log-hides.yml
```

**Output**

```text
TASK [Gathering Facts] *********************************************************
ok: [web1]
TASK [Make the config folder] **************************************************
ok: [web1] => {"changed": false, "gid": 0, "group": "root", "mode": "0755", "owner": "root", "path": "/etc/demo-app", "size": 4096, "state": "directory", "uid": 0}
TASK [Write a file without no_log] *********************************************
ok: [web1] => {"changed": false, "checksum": "0207a3e6ab46c4ab70be2ba9d2b0206d85b77aa9", "dest": "/etc/demo-app/plain.conf", "gid": 0, "group": "root", "mode": "0600", "owner": "root", "path": "/etc/demo-app/plain.conf", "size": 38, "state": "file", "uid": 0}
TASK [Write a file with no_log] ************************************************
ok: [web1] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": false}
TASK [Run a command that has the secret in it] *********************************
ok: [web1] => {"censored": "the output has been hidden due to the fact that 'no_log: true' was specified for this result", "changed": false}
```

**Note:** With no_log and -v, 0 lines show the secret. The result says it was hidden.

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook --tags error-text --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/what-no-log-hides.yml
```

**Output**

```text
[ERROR]: Task failed: Unexpected AnsibleActionFail error: Could not find or access '/nonexistent/demo-secret-not-real-0002' on the Ansible Controller.
Could not find or access '/nonexistent/demo-secret-not-real-0002' on the Ansible Controller. If you are using a module and expect the file to exist on the remote, see the remote_src option.
```

**Note:** The task failed with no_log on. The result line is censored, but the [ERROR] block printed the secret on 2 lines.

## Step 12

**Command**

```sh
ANSIBLE_DEBUG=1 node toolkit/ansible.mjs ansible-playbook --skip-tags error-text --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/what-no-log-hides.yml
```

**Output**

```text
{"changed": true, "stdout": "demo-secret-not-real-0002", "stderr": "", "rc": 0, "cmd": ["echo", "demo-secret-not-real-0002"], "start": "2026-11-08 18:24:03.153479", "end": "2026-11-08 18:24:03.166520", "delta": "0:00:00.013041", " ... [9 more characters left out]
{"changed": true, "stdout": "demo-secret-not-real-0002", "stderr": "", "rc": 0, "cmd": ["echo", "demo-secret-not-real-0002"], "start": "2026-11-08 18:24:03.153479", "end": "2026-11-08 18:24:03.166520", "delta": "0:00:00.013041", " ... [9 more characters left out]
  1361 1794162243.26473: done with _execute_module (ansible.legacy.command, {'_raw_params': 'echo demo-secret-not-real-0002', '_ansible_check_mode': False, '_ansible_no_log': True, '_ansible_debug': True, '_ansible_diff': False, ' ... [611 more characters left out]
```

**Note:** With ANSIBLE_DEBUG=1 the output has 954 lines and 3 of them show the secret, although every task that holds it has no_log: true or hides the content.

## Step 13

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -vvvv --skip-tags error-text --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/what-no-log-hides.yml
```

**Output**

```text
(no line shows the secret)
```

**Note:** With -vvvv, 0 lines show the secret.

## Step 14

**Command**

```sh
docker exec anp-web1 cat /etc/demo-app/hidden.conf
```

**Output**

```text
DB_PASSWORD=demo-secret-not-real-0002
```

**Note:** The file that no_log kept out of the output is plain text on the target. That is by design: the app must read it.

## Step 15

**Command**

```sh
docker exec --user nobody anp-web1 cat /etc/demo-app/hidden.conf
```

**Output**

```text
cat: /etc/demo-app/hidden.conf: Permission denied
```

**Note:** Mode 0600 keeps other users out. The file mode is the protection on the target, not the vault and not no_log.
