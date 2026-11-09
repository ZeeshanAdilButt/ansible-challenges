# Results: Challenge 4, part 3: block, rescue, failed_when and ignore_errors

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the files in reference/; the paths below show the files without it. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/setup.yml
```

**Output**

```text

PLAY [Put the app version on the web hosts] ************************************

TASK [Make the app folder] *****************************************************
changed: [web1]
changed: [web2]

TASK [Write the version file] **************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** web1 and web2 now have /srv/app/version. db1 does not.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/plain.yml
```

**Output**

```text

PLAY [Read the app version, plain] *********************************************

TASK [Read the app version] ****************************************************
ok: [web1]
ok: [web2]
[ERROR]: Task failed: Module failed: The command exited with a non-zero return code.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/plain.yml:7:7

5   gather_facts: false
6   tasks:
7     - name: Read the app version
        ^ column 7

fatal: [db1]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "changed_when_result": false, "cmd": ["cat", "/srv/app/version"], "delta": "0:00:00.009821", "end": "2026-11-08 18:24:28.205747", "msg": "The command exited with a non-zero return code.", "rc": 1, "start": "2026-11-08 18:24:28.195926", "stderr": "cat: /srv/app/version: No such fil ... [120 more characters left out]

TASK [Announce the deploy] *****************************************************
ok: [web1] => {
    "msg": "Deploy finished on web1"
}
ok: [web2] => {
    "msg": "Deploy finished on web2"
}

PLAY RECAP *********************************************************************
db1                        : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 2. Over the three hosts: ok 4, changed 0, failed 1, rescued 0, ignored 0. The last task ran on 2 host(s).

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/ignore.yml
```

**Output**

```text

PLAY [Read the app version, ignoring errors] ***********************************

TASK [Read the app version] ****************************************************
ok: [web1]
ok: [web2]
[ERROR]: Task failed: Module failed: The command exited with a non-zero return code.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/reference/ignore.yml:7:7

5   gather_facts: false
6   tasks:
7     - name: Read the app version
        ^ column 7

fatal: [db1]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "changed_when_result": false, "cmd": ["cat", "/srv/app/version"], "delta": "0:00:00.006147", "end": "2026-11-08 18:24:33.964565", "msg": "The command exited with a non-zero return code.", "rc": 1, "start": "2026-11-08 18:24:33.958418", "stderr": "cat: /srv/app/version: No such fil ... [120 more characters left out]
...ignoring

TASK [Announce the deploy] *****************************************************
ok: [web1] => {
    "msg": "Deploy finished on web1"
}
ok: [web2] => {
    "msg": "Deploy finished on web2"
}
ok: [db1] => {
    "msg": "Deploy finished on db1"
}

PLAY RECAP *********************************************************************
db1                        : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=1   
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 0. Over the three hosts: ok 6, changed 0, failed 0, rescued 0, ignored 1. The last task ran on 3 host(s).

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/block-rescue.yml
```

**Output**

```text

PLAY [Read the app version, with block and rescue] *****************************

TASK [Read the app version] ****************************************************
ok: [web2]
[ERROR]: Task failed: Module failed: The command exited with a non-zero return code.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/reference/block-rescue.yml:9:11

7     - name: Read the version and announce
8       block:
9         - name: Read the app version
            ^ column 11

fatal: [db1]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "changed_when_result": false, "cmd": ["cat", "/srv/app/version"], "delta": "0:00:00.006382", "end": "2026-11-08 18:24:40.649342", "msg": "The command exited with a non-zero return code.", "rc": 1, "start": "2026-11-08 18:24:40.642960", "stderr": "cat: /srv/app/version: No such fil ... [120 more characters left out]
ok: [web1]

TASK [Announce the deploy] *****************************************************
ok: [web1] => {
    "msg": "Deploy finished on web1"
}
ok: [web2] => {
    "msg": "Deploy finished on web2"
}

TASK [Mark this host as needing a deploy] **************************************
changed: [db1]

TASK [Say what happened] *******************************************************
ok: [db1] => {
    "msg": "Rescued db1: Read the app version failed"
}

TASK [Write the run log] *******************************************************
changed: [web1]
changed: [web2]
changed: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=1    ignored=0   
web1                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 0. Over the three hosts: ok 9, changed 4, failed 0, rescued 1, ignored 0. The last task ran on 2 host(s).

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible db1 -m command -a 'cat /tmp/needs-deploy'
```

**Output**

```text
db1 | CHANGED | rc=0 >>
db1 needs a deploy
```

**Note:** The rescue part ran on db1 and left this file.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/failed-when.yml
```

**Output**

```text

PLAY [Read the app version, failing on the wrong output] ***********************

TASK [Read the app version] ****************************************************
ok: [web1]
[ERROR]: Task failed: Module failed: A 'failed_when' expression evaluated to 'True'.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/reference/failed-when.yml:7:7

5   gather_facts: false
6   tasks:
7     - name: Read the app version
        ^ column 7

fatal: [db1]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "changed_when_result": false, "cmd": ["cat", "/srv/app/version"], "delta": "0:00:00.006675", "end": "2026-11-08 18:24:56.867123", "failed_when_result": true, "failed_when_suppressed_exception": "(traceback unavailable)", "msg": "The command exited with a non-zero return code.", "r ... [211 more characters left out]
[ERROR]: Task failed: Action failed: A 'failed_when' expression evaluated to 'True'.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/reference/failed-when.yml:7:7

5   gather_facts: false
6   tasks:
7     - name: Read the app version
        ^ column 7

fatal: [web2]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "changed_when_result": false, "cmd": ["cat", "/srv/app/version"], "delta": "0:00:00.005899", "end": "2026-11-08 18:24:56.843219", "failed_when_result": true, "msg": "Task failed: Action failed: A 'failed_when' expression evaluated to 'True'.", "rc": 0, "start": "2026-11-08 18:24: ... [91 more characters left out]

TASK [Announce the deploy] *****************************************************
ok: [web1] => {
    "msg": "Deploy finished on web1"
}

PLAY RECAP *********************************************************************
db1                        : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 2. Over the three hosts: ok 2, changed 0, failed 2, rescued 0, ignored 0. The last task ran on 1 host(s).
