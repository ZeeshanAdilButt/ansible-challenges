# Results: Challenge 8, part 1: serial batches

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/rollout.yml; the paths below show rollout.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-1-serial-batches/rollout.yml
```

**Output**

```text

PLAY [Roll out app config version 2] *******************************************

TASK [Write the new app config] ************************************************
changed: [web1]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web1]

PLAY [Roll out app config version 2] *******************************************

TASK [Write the new app config] ************************************************
changed: [web2]
changed: [web3]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web2]
ok: [web3]

PLAY [Roll out app config version 2] *******************************************

TASK [Write the new app config] ************************************************
changed: [web5]
changed: [web4]
changed: [web6]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web4]
ok: [web5]
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** 3 batches, sizes 1,2,3. Each PLAY line is one batch. Inside a batch the order of the lines can change from run to run.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible web -i inventory/rollout.ini -m command -a 'cat /etc/anp-app.conf'
```

**Output**

```text
web2 | CHANGED | rc=0 >>
version=2
web5 | CHANGED | rc=0 >>
version=2
web4 | CHANGED | rc=0 >>
version=2
web3 | CHANGED | rc=0 >>
version=2
web1 | CHANGED | rc=0 >>
version=2
web6 | CHANGED | rc=0 >>
version=2
```

**Note:** All six web hosts hold the new config.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-1-serial-batches/variants.yml -e '{"plan":2}'
```

**Output**

```text

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web2]
ok: [web1]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web1]
ok: [web2]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web3]
ok: [web4]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web4]
ok: [web3]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web5]
ok: [web6]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web5]
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** serial: 2 gives 3 batches of sizes 2,2,2.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-1-serial-batches/variants.yml -e '{"plan":"30%"}'
```

**Output**

```text

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web1]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web1]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web2]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web2]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web3]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web3]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web4]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web4]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web5]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web5]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web6]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** serial: "30%" on 6 hosts is 1.8 hosts. The real run made 6 batches of sizes 1,1,1,1,1,1, so Ansible rounds a percentage DOWN (and never goes below 1).

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-1-serial-batches/variants.yml -e '{"plan":[1,2]}'
```

**Output**

```text

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web1]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web1]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web3]
ok: [web2]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web3]
ok: [web2]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web4]
ok: [web5]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web5]
ok: [web4]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web6]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** serial: [1, 2] gives sizes 1,2,2,1. The last number repeats until every host has had its turn.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-1-serial-batches/variants.yml -e '{"plan":[]}'
```

**Output**

```text

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web1]
ok: [web5]
ok: [web4]
ok: [web3]
ok: [web2]
ok: [web6]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web4]
ok: [web5]
ok: [web1]
ok: [web2]
ok: [web3]
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** An empty list means no serial: 1 batch of 6 hosts. (The docs say Ansible works on 5 hosts at a time by default. That limit is called forks. It is a different setting from serial.)

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-1-serial-batches/variants.yml -e '{"plan": 1}'
```

**Output**

```text

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web1]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web1]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web2]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web2]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web3]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web3]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web4]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web4]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web5]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web5]

PLAY [Roll out app config version 2, plan from a variable] *********************

TASK [Write the new app config] ************************************************
ok: [web6]

TASK [Restart the app (simulated, it takes two seconds)] ***********************
ok: [web6]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Wall-clock time of the whole command, median of three runs each: no serial 18.8 s (runs 18.8, 19.1, 18.3), serial [1, 2, 3] 25.4 s (runs 23, 25.4, 32.6), serial 1 30.8 s (runs 23.5, 30.8, 38.5). The output shown is the last serial 1 run. Smaller batches are safer and slower.
