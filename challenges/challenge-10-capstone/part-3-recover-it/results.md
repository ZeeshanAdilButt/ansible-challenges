# Results: Challenge 10, part 3: recover it

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the reference recover.yml and RUNBOOK.md; the paths above show capstone-stack. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml
```

**Output**

```text
TASK [db : Install redis and its Python client] ********************************
changed: [db1]
TASK [db : Write the redis config] *********************************************
changed: [db1]
... (28 lines left out) ...
PLAY RECAP *********************************************************************
db1                        : ok=7    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=9    changed=7    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The fleet is configured: the proxy answers 200, release 1.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/rollout.yml -e app_log_level=verbose
```

**Output**

```text
TASK [web : Write the proxy config, and let nginx test it first] ***************
changed: [web1]
RUNNING HANDLER [web : Reload nginx] *******************************************
changed: [web1]
TASK [app : Write the app settings] ********************************************
changed: [web2]
[ERROR]: Task failed: Module failed: capstone-app stopped right after it started. Last lines of /var/log/capstone-app/app.log:
RUNNING HANDLER [app : Restart the app] ****************************************
fatal: [web2]: FAILED! => {"changed": false, "msg": "capstone-app stopped right after it started. Last lines of /var/log/capstone-app/app.log:\n172.31.0.4 \"GET /health HTTP/1.0\" 200 -\n172.31.0.4 \"GET /health HTTP/1.0\" 200 -\ncapstone-app: unknown log_level 'verbose', use one of: debug, info, warning, error\n"}
PLAY RECAP *********************************************************************
web1                       : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=8    changed=1    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** The rollout stopped. Failed: web2. The proxy now answers 502 (release header 2). The clock starts here.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/recover.yml
```

**Output**

```text
TASK [app : Write the app settings] ********************************************
changed: [web2]
TASK [app : The app is running and starts at boot] *****************************
changed: [web2]
RUNNING HANDLER [app : Restart the app] ****************************************
changed: [web2]
TASK [web : Write the proxy config, and let nginx test it first] ***************
changed: [web1]
RUNNING HANDLER [web : Reload nginx] *******************************************
changed: [web1]
PLAY RECAP *********************************************************************
db1                        : ok=7    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=8    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=10   changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** recover.yml finished. The first 200 from the proxy came 22.7 s after the stop.

## Step 4

**Command**

```sh
three runs of: break it, recover it, check the proxy (the numbers are seconds from the stop to the first 200)
```

**Output**

```text
run 1: down answered 502, recovered in 22.7 s, recover.yml ok
run 2: down answered 502, recovered in 22 s, recover.yml ok
run 3: down answered 502, recovered in 20.5 s, recover.yml ok
```

**Note:** The median is 22 s (0.37 minutes). This is script time. A person needs their own minutes to read, think and type.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml
```

**Output**

```text
PLAY RECAP *********************************************************************
db1                        : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=8    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** After the recovery, site.yml changes nothing (changed=0). The app says release 1, the proxy header says 1.

## Step 6

**Command**

```sh
read RUNBOOK.md: one entry for the stopped rollout and one for the 502, each with its fields and a number from your run
```

**Output**

```text
stop     "A rollout stopped on a failed host"  complete   measured 1 hosts, run 1
recover  "The site returns 502"  complete   measured 19.5 s, run 22
```

**Note:** Both entries are complete and quote the numbers this run measured. A mentor reads whether a stranger could follow them.
