# Results: Challenge 4, part 1: handlers

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/site.yml; the paths below show site.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/site.yml
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Install nginx] ***********************************************************
changed: [web2]
changed: [web1]

TASK [Start nginx] *************************************************************
changed: [web1]
changed: [web2]

TASK [Write the site config] ***************************************************
changed: [web1]
changed: [web2]

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Handler "Reload nginx" ran 2 times: once on each web host, at the end of the play, after the config task.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/site.yml
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
ok: [web2]
ok: [web1]

TASK [Start nginx] *************************************************************
ok: [web2]
ok: [web1]

TASK [Write the site config] ***************************************************
ok: [web2]
ok: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Handler runs: 0. The config task said ok, so it did not notify, so the handler did not run.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/served.yml
```

**Output**

```text

PLAY [Ask nginx what it answers right now] *************************************

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: hello from web1"
}
ok: [web2] => {
    "msg": "nginx answers: hello from web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** nginx answers with the first message.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/site.yml -e message=second
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
ok: [web1]
ok: [web2]

TASK [Start nginx] *************************************************************
ok: [web1]
ok: [web2]

TASK [Write the site config] ***************************************************
changed: [web1]
changed: [web2]

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Only the config changed. Handler runs: 2.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/served.yml
```

**Output**

```text

PLAY [Ask nginx what it answers right now] *************************************

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: second from web1"
}
ok: [web2] => {
    "msg": "nginx answers: second from web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** nginx answers with the new message: the handler reloaded it.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/two-notifies.yml
```

**Output**

```text

PLAY [Two tasks, one handler] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Write the first config file] *********************************************
changed: [web1]
changed: [web2]

TASK [Write the second config file] ********************************************
changed: [web1]
changed: [web2]

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web2]
changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Two tasks changed and both notified. The handler ran 2 times in total, 1 on web1.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/check-before-handler.yml -e message=third
```

**Output**

```text

PLAY [Check nginx before the handler runs] *************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Write the site config] ***************************************************
changed: [web2]
changed: [web1]

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: second from web1"
}
ok: [web2] => {
    "msg": "nginx answers: second from web2"
}

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The check task ran before the handler. It saw the old config. The handler ran later, at the end.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/flush.yml -e message=fourth
```

**Output**

```text

PLAY [Check nginx after flush_handlers] ****************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Write the site config] ***************************************************
changed: [web1]
changed: [web2]

TASK [Run the waiting handlers now] ********************************************

TASK [Run the waiting handlers now] ********************************************

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: fourth from web1"
}
ok: [web2] => {
    "msg": "nginx answers: fourth from web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** meta: flush_handlers ran the handler in the middle of the play. The check task saw the new config.

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/fail-after.yml -e message=v2
```

**Output**

```text

PLAY [A failure after the notify] **********************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Write the site config] ***************************************************
changed: [web1]
changed: [web2]

TASK [A task that breaks on web2] **********************************************
skipping: [web1]
[ERROR]: Task failed: Action failed: Planned failure on web2
Origin: /work/challenges/challenge-4-fail-on-purpose/part-1-handlers/fail-after.yml:21:7

19       notify: Reload nginx
20
21     - name: A task that breaks on web2
         ^ column 7

fatal: [web2]: FAILED! => {"changed": false, "msg": "Planned failure on web2"}

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 2. web2 failed after its config task. The handler ran on 1 host (web1).

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/served.yml
```

**Output**

```text

PLAY [Ask nginx what it answers right now] *************************************

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: v2 from web1"
}
ok: [web2] => {
    "msg": "nginx answers: fourth from web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** web1 answers v2. web2 still answers with the old message: its file says v2, but nginx never reloaded.

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/fail-after.yml -e message=v2
```

**Output**

```text

PLAY [A failure after the notify] **********************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Write the site config] ***************************************************
ok: [web1]
ok: [web2]

TASK [A task that breaks on web2] **********************************************
skipping: [web1]
[ERROR]: Task failed: Action failed: Planned failure on web2
Origin: /work/challenges/challenge-4-fail-on-purpose/part-1-handlers/fail-after.yml:21:7

19       notify: Reload nginx
20
21     - name: A task that breaks on web2
         ^ column 7

fatal: [web2]: FAILED! => {"changed": false, "msg": "Planned failure on web2"}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** The same run again. The config file is already v2 on both hosts, so nothing is notified. Handler runs: 0.

## Step 12

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/served.yml
```

**Output**

```text

PLAY [Ask nginx what it answers right now] *************************************

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: v2 from web1"
}
ok: [web2] => {
    "msg": "nginx answers: fourth from web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** web2 still answers with the old message. The trap: the file is right, nginx is not, and the next run does not show it.

## Step 13

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/fail-after.yml -e message=v3 --force-handlers
```

**Output**

```text

PLAY [A failure after the notify] **********************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Write the site config] ***************************************************
changed: [web1]
changed: [web2]

TASK [A task that breaks on web2] **********************************************
skipping: [web1]
[ERROR]: Task failed: Action failed: Planned failure on web2
Origin: /work/challenges/challenge-4-fail-on-purpose/part-1-handlers/fail-after.yml:21:7

19       notify: Reload nginx
20
21     - name: A task that breaks on web2
         ^ column 7

fatal: [web2]: FAILED! => {"changed": false, "msg": "Planned failure on web2"}

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
web2                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** With --force-handlers the handler ran on 2 hosts, also on the host that failed.

## Step 14

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-1-handlers/served.yml
```

**Output**

```text

PLAY [Ask nginx what it answers right now] *************************************

TASK [Ask nginx on port 8080] **************************************************
ok: [web1]
ok: [web2]

TASK [Show the answer] *********************************************************
ok: [web1] => {
    "msg": "nginx answers: v3 from web1"
}
ok: [web2] => {
    "msg": "nginx answers: v3 from web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Both hosts answer v3.
