# Results: Challenge 4, part 2: conditions and loops

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/site.yml; the paths below show site.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/site.yml
```

**Output**

```text

PLAY [Loops and conditions on all hosts] ***************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]
ok: [web1]
ok: [web2]

TASK [Install the common packages] *********************************************
changed: [web2] => (item=tree)
changed: [db1] => (item=tree)
changed: [web1] => (item=tree)
changed: [web2] => (item=jq)
changed: [db1] => (item=jq)
changed: [web1] => (item=jq)

TASK [Create the users] ********************************************************
changed: [db1] => (item=alice)
changed: [web1] => (item=alice)
changed: [web2] => (item=alice)
changed: [db1] => (item=bob)
changed: [web1] => (item=bob)
changed: [web2] => (item=bob)
changed: [db1] => (item=carol)
changed: [web1] => (item=carol)
changed: [web2] => (item=carol)

TASK [Install nginx on web hosts] **********************************************
skipping: [db1]
changed: [web1]
changed: [web2]

TASK [Install sqlite3 on database hosts] ***************************************
skipping: [web1]
skipping: [web2]
changed: [db1]

TASK [Use dnf on Red Hat family systems] ***************************************
skipping: [web1]
skipping: [web2]
skipping: [db1]

PLAY [Wait for a slow service on the web hosts] ********************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Start nginx late, in the background] *************************************
changed: [web1]
changed: [web2]

TASK [Wait until nginx answers] ************************************************
FAILED - RETRYING: [web1]: Wait until nginx answers (9 retries left).
FAILED - RETRYING: [web2]: Wait until nginx answers (9 retries left).
FAILED - RETRYING: [web1]: Wait until nginx answers (8 retries left).
FAILED - RETRYING: [web2]: Wait until nginx answers (8 retries left).
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
db1                        : ok=4    changed=3    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
web1                       : ok=7    changed=4    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
web2                       : ok=7    changed=4    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0
```

**Note:** Exit code 0. Skipped tasks: db1 2, web1 2, web2 2. The wait task retried 2 times on web1.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/report.yml
```

**Output**

```text

PLAY [Report packages and users] ***********************************************

TASK [Read the package list] ***************************************************
ok: [web1]
ok: [web2]
ok: [db1]

TASK [Read the user list] ******************************************************
ok: [web1]
ok: [web2]
ok: [db1]

TASK [Show what this host has] *************************************************
[WARNING]: Deprecation warnings can be disabled by setting `deprecation_warnings=False` in ansible.cfg.
[DEPRECATION WARNING]: INJECT_FACTS_AS_VARS default to `True` is deprecated, top-level facts will not be auto injected after the change. This feature will be removed from ansible-core version 2.24.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/report.yml:16:14

14     - name: Show what this host has
15       ansible.builtin.debug:
16         msg: "packages: {{ ['nginx', 'sqlite3', 'tree', 'jq'] | select('in', ansible_facts['packages']) | sort | l...
                ^ column 14

Use `ansible_facts["fact_name"]` (no `ansible_` prefix) instead.

ok: [web1] => {
    "msg": "packages: ['jq', 'nginx', 'tree'], users: ['alice', 'bob', 'carol']"
}
ok: [web2] => {
    "msg": "packages: ['jq', 'nginx', 'tree'], users: ['alice', 'bob', 'carol']"
}
ok: [db1] => {
    "msg": "packages: ['jq', 'sqlite3', 'tree'], users: ['alice', 'bob', 'carol']"
}

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Each host lists the packages and users it has. nginx is on the web hosts only, sqlite3 on db1 only. The three users are everywhere.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/too-few-retries.yml
```

**Output**

```text

PLAY [Wait for a slow service, with too few retries] ***************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Stop nginx] **************************************************************
changed: [web2]
changed: [web1]

TASK [Start nginx late, in the background] *************************************
changed: [web1]
changed: [web2]

TASK [Wait until nginx answers] ************************************************
FAILED - RETRYING: [web1]: Wait until nginx answers (2 retries left).
FAILED - RETRYING: [web2]: Wait until nginx answers (2 retries left).
FAILED - RETRYING: [web2]: Wait until nginx answers (1 retries left).
FAILED - RETRYING: [web1]: Wait until nginx answers (1 retries left).
FAILED - RETRYING: [web1]: Wait until nginx answers (0 retries left).
FAILED - RETRYING: [web2]: Wait until nginx answers (0 retries left).
[ERROR]: Task failed: Module failed: Status code was -1 and not [200]: Request failed: <urlopen error [Errno 111] Connection refused>
Origin: /work/challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/too-few-retries.yml:18:7

16       changed_when: true
17
18     - name: Wait until nginx answers
         ^ column 7

fatal: [web2]: FAILED! => {"attempts": 3, "changed": false, "elapsed": 0, "msg": "Status code was -1 and not [200]: Request failed: <urlopen error [Errno 111] Connection refused>", "redirected": false, "status": -1, "url": "http://localhost"}
fatal: [web1]: FAILED! => {"attempts": 3, "changed": false, "elapsed": 0, "msg": "Status code was -1 and not [200]: Request failed: <urlopen error [Errno 111] Connection refused>", "redirected": false, "status": -1, "url": "http://localhost"}

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 2. The task retried 3 times on web1 and then failed, because nginx needs 25 seconds and the tries ran out first.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/count-attempts.yml
```

**Output**

```text

PLAY [Count the real attempts] *************************************************

TASK [Reset the counter] *******************************************************
ok: [web1]

TASK [A check that never passes] ***********************************************
FAILED - RETRYING: [web1]: A check that never passes (2 retries left).
FAILED - RETRYING: [web1]: A check that never passes (1 retries left).
FAILED - RETRYING: [web1]: A check that never passes (0 retries left).
[ERROR]: Task failed: Module failed: The command exited with a non-zero return code.
Origin: /work/challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/count-attempts.yml:13:7

11         state: absent
12
13     - name: A check that never passes
         ^ column 7

fatal: [web1]: FAILED! => {"attempts": 3, "changed": false, "changed_when_result": false, "cmd": "n=$(cat /tmp/attempts 2>/dev/null || echo 0); echo $((n + 1)) > /tmp/attempts; false", "delta": "0:00:00.011067", "end": "2026-11-08 18:23:47.695678", "msg": "The command exited with a non-zero return code.", "rc": 1, "start": "2026-11-08 18:23:47.684611", "stderr": "", "stderr_lines": [], "stdout": " ... [22 more characters left out]

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Exit code 2. The failure message says attempts: 3.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -m command -a 'cat /tmp/attempts'
```

**Output**

```text
web1 | CHANGED | rc=0 >>
4
```

**Note:** The file on the host counted the real runs of the check.
