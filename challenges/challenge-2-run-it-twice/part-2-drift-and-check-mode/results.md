# Results: Challenge 2, part 2: drift and check mode

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/site.yml; the paths below show site.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml --check
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
changed: [web1]
changed: [web2]

TASK [Write the home page] *****************************************************
changed: [web2]
changed: [web1]

TASK [Start nginx] *************************************************************
[ERROR]: Task failed: Module failed: Could not find the requested service nginx: host
Origin: /work/challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml:17:7

15         mode: "0644"
16
17     - name: Start nginx
         ^ column 7

fatal: [web2]: FAILED! => {"changed": false, "msg": "Could not find the requested service nginx: host"}
fatal: [web1]: FAILED! => {"changed": false, "msg": "Could not find the requested service nginx: host"}

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Check mode on empty servers: the install task says "changed" but installs nothing, so nginx does not exist, and "Start nginx" fails on 2 hosts. Check mode cannot see past a change it did not make.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
changed: [web1]
changed: [web2]

TASK [Write the home page] *****************************************************
changed: [web2]
changed: [web1]

TASK [Start nginx] *************************************************************
changed: [web2]
changed: [web1]

TASK [Test the nginx configuration] ********************************************
ok: [web1]
ok: [web2]

TASK [Show the test result] ****************************************************
ok: [web1] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}
ok: [web2] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
changed: [db1]

TASK [Start redis] *************************************************************
changed: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Real run on empty servers: 8 changes.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
ok: [web1]
ok: [web2]

TASK [Write the home page] *****************************************************
ok: [web2]
ok: [web1]

TASK [Start nginx] *************************************************************
ok: [web2]
ok: [web1]

TASK [Test the nginx configuration] ********************************************
ok: [web2]
ok: [web1]

TASK [Show the test result] ****************************************************
ok: [web1] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}
ok: [web2] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
ok: [db1]

TASK [Start redis] *************************************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Second run: 0 changes. This is the starting point: servers and playbook agree.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -b -m shell -a "echo 'Edited by hand' > /var/www/html/index.html"
```

**Output**

```text
web1 | CHANGED | rc=0 >>
```

**Note:** The page on web1 is now different from what the playbook says. Nothing in Ansible knows yet.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml --check --diff
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
ok: [web2]
ok: [web1]

TASK [Write the home page] *****************************************************
ok: [web2]
--- before: /var/www/html/index.html
+++ after: /var/www/html/index.html
@@ -1 +1 @@
-Edited by hand
+Hello from web1

changed: [web1]

TASK [Start nginx] *************************************************************
ok: [web1]
ok: [web2]

TASK [Test the nginx configuration] ********************************************
skipping: [web1]
skipping: [web2]

TASK [Show the test result] ****************************************************
ok: [web1] => {
    "msg": []
}
ok: [web2] => {
    "msg": []
}

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
ok: [db1]

TASK [Start redis] *************************************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=5    changed=1    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
web2                       : ok=5    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0
```

**Note:** Check mode found 1 change (web1) and made none. The diff shows the line it would replace. The command task shows "skipping" on every web host.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible web -m command -a 'cat /var/www/html/index.html'
```

**Output**

```text
web2 | CHANGED | rc=0 >>
Hello from web2
web1 | CHANGED | rc=0 >>
Edited by hand
```

**Note:** The page on web1 still says what the hand edit wrote. Check mode touched nothing. (command says CHANGED because it always does.)

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Install nginx] ***********************************************************
ok: [web1]
ok: [web2]

TASK [Write the home page] *****************************************************
ok: [web2]
changed: [web1]

TASK [Start nginx] *************************************************************
ok: [web1]
ok: [web2]

TASK [Test the nginx configuration] ********************************************
ok: [web2]
ok: [web1]

TASK [Show the test result] ****************************************************
ok: [web1] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}
ok: [web2] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
ok: [db1]

TASK [Start redis] *************************************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Real run: 1 change. Only web1 had drifted, and the nginx test command ran this time (it says ok, because of changed_when: false).

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Install nginx] ***********************************************************
ok: [web2]
ok: [web1]

TASK [Write the home page] *****************************************************
ok: [web2]
ok: [web1]

TASK [Start nginx] *************************************************************
ok: [web1]
ok: [web2]

TASK [Test the nginx configuration] ********************************************
ok: [web1]
ok: [web2]

TASK [Show the test result] ****************************************************
ok: [web1] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}
ok: [web2] => {
    "msg": [
        "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok",
        "nginx: configuration file /etc/nginx/nginx.conf test is successful"
    ]
}

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
ok: [db1]

TASK [Start redis] *************************************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Run after the repair: 0 changes. The servers match the playbook again.
