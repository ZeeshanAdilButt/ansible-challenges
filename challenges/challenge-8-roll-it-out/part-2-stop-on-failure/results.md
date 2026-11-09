# Results: Challenge 8, part 2: stop on failure

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/my-rollout.yml; the paths below show my-rollout.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
changed: [web4]
changed: [web2]
changed: [web1]
changed: [web5]
changed: [web6]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web2]
ok: [web1]
ok: [web4]
ok: [web5]
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** No serial: every host in one batch. Changed 5 (web1, web2, web4, web5, web6), failed 1 (web3), untouched 0 (none). Half done, new config but no restart: 0 (none). Only the host that fails the check is spared. Nothing stops the rollout.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml -e batch=2
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web1]
changed: [web2]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web2]
ok: [web1]

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
changed: [web4]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web4]

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web5]
changed: [web6]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web5]
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** serial: 2 alone. Changed 5 (web1, web2, web4, web5, web6), failed 1 (web3), untouched 0 (none). Half done, new config but no restart: 0 (none). web3 failed in batch 2, its batch partner web4 went on, and batch 3 still ran. A failure alone does not stop a rollout.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml -e batch=1
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web1]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web1]

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web2]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web2]

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** serial: 1. Changed 2 (web1, web2), failed 1 (web3), untouched 3 (web4, web5, web6). Half done, new config but no restart: 0 (none). A batch of one that fails is a batch where every host failed, and that stops the play.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml -e batch=2 -e max_fail=30
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web1]
changed: [web2]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web1]
ok: [web2]

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
changed: [web4]

NO MORE HOSTS LEFT *************************************************************

NO MORE HOSTS LEFT *************************************************************

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** serial: 2 with max_fail_percentage: 30. Changed 3 (web1, web2, web4), failed 1 (web3), untouched 2 (web5, web6). Half done, new config but no restart: 1 (web4). In batch 2 one of two hosts failed. That is 50 percent, more than 30, so the play stopped after that batch.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml -e max_fail=10
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web1]
changed: [web2]
changed: [web4]
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
changed: [web5]
changed: [web6]

NO MORE HOSTS LEFT *************************************************************

NO MORE HOSTS LEFT *************************************************************

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** max_fail_percentage: 10 with no serial. Changed 5 (web1, web2, web4, web5, web6), failed 1 (web3), untouched 0 (none). Half done, new config but no restart: 5 (web1, web2, web4, web5, web6). One host of six is 16.7 percent, more than 10, so the play stopped. But the failing task had already run on every host, and the restart task never ran.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml -e fatal=true
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web5]
changed: [web2]
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
changed: [web1]
changed: [web4]
changed: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** any_errors_fatal with no serial. Changed 5 (web1, web2, web4, web5, web6), failed 1 (web3), untouched 0 (none). Half done, new config but no restart: 5 (web1, web2, web4, web5, web6). The failing task finished on every host of the batch (all six), then the play stopped. The restart task never ran.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml -e batch=2 -e fatal=true
```

**Output**

```text

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web2]
changed: [web1]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web1]
ok: [web2]

PLAY [Push app config version 2] ***********************************************

TASK [Write the new config (checked before it replaces the old file)] **********
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/push-config.yml:14:7

12   any_errors_fatal: "{{ fatal | default(false) }}"
13   tasks:
14     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
changed: [web4]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** any_errors_fatal with serial: 2. Changed 3 (web1, web2, web4), failed 1 (web3), untouched 2 (web5, web6). Half done, new config but no restart: 1 (web4). The failing task finished on batch 2, then the play stopped. Batch 3 never started.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-2-stop-on-failure/rollout-with-bad-web3.ini challenges/challenge-8-roll-it-out/part-2-stop-on-failure/my-rollout.yml
```

**Output**

```text

PLAY [Push app config version 2, carefully] ************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web1]
changed: [web2]

TASK [Restart the app (simulated, it takes one second)] ************************
ok: [web1]
ok: [web2]

PLAY [Push app config version 2, carefully] ************************************

TASK [Write the new config (checked before it replaces the old file)] **********
changed: [web4]
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-2-stop-on-failure/reference/my-rollout.yml:13:7

11   max_fail_percentage: 30
12   tasks:
13     - name: Write the new config (checked before it replaces the old file)
         ^ column 7

fatal: [web3]: FAILED! => {"ansible_facts": {"discovered_interpreter_python": "/usr/bin/python3.11"}, "changed": false, "checksum": "fd2512224d8b2b540e784409694ceb2c24e58187", "exit_status": 1, "msg": "failed to validate", "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}

NO MORE HOSTS LEFT *************************************************************

NO MORE HOSTS LEFT *************************************************************

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web4                       : ok=1    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Your my-rollout.yml. Changed 3 (web1, web2, web4), failed 1 (web3), untouched 2 (web5, web6). Half done, new config but no restart: 1 (web4).
