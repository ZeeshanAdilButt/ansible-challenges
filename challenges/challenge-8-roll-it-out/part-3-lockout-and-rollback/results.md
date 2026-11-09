# Results: Challenge 8, part 3: lockout and rollback

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/push-safe.yml as push-safe.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts answer. This is the state we must get back to.

## Step 2

**Command**

```sh
docker exec anp-web1 sha256sum /etc/ssh/sshd_config
docker exec anp-web2 sha256sum /etc/ssh/sshd_config
docker exec anp-db1 sha256sum /etc/ssh/sshd_config
docker exec anp-web3 sha256sum /etc/ssh/sshd_config
docker exec anp-web4 sha256sum /etc/ssh/sshd_config
docker exec anp-web5 sha256sum /etc/ssh/sshd_config
docker exec anp-web6 sha256sum /etc/ssh/sshd_config
```

**Output**

```text
160f305635ec...  web1
160f305635ec...  web2
160f305635ec...  db1
160f305635ec...  web3
160f305635ec...  web4
160f305635ec...  web5
160f305635ec...  web6
```

**Note:** The first 12 characters of the hash of each host's sshd_config before anything changes. Every host starts with the same file.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -i inventory/rollout.ini -m ping
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** One ping with Ansible's default settings. Ansible keeps this SSH connection open for 60 seconds so that the next task is fast.

## Step 4

**Command**

```sh
docker exec anp-control ls /home/learner/.ansible/cp
```

**Output**

```text
2dfdfbbbeb
34c6fc7619
4c819ff0ec
4faf514df4
6be186f071
b188628b2d
b585b88659
```

**Note:** Every host Ansible talked to has a socket file in the control container: 7 files.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-unsafe.yml --limit web1 -e 'ssh_allow_users=deploy'
```

**Output**

```text

PLAY [Push sshd_config, unsafe version] ****************************************

TASK [Keep a copy of the current sshd_config] **********************************
changed: [web1]

TASK [Install the new sshd_config] *********************************************
changed: [web1]

TASK [Restart sshd] ************************************************************
changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The unsafe push to web1. The new sshd_config says AllowUsers deploy, so the user ansible is no longer allowed in. The play still finishes green: every task re-uses the open connection.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -i inventory/rollout.ini -m ping
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** The open connection still works (pong). Nothing looks wrong yet.

## Step 7

**Command**

```sh
docker exec anp-control ssh -O exit -o ControlPath=/home/learner/.ansible/cp/<socket> any-host
```

**Output**

```text
2dfdfbbbeb: Exit request sent.
34c6fc7619: Exit request sent.
4c819ff0ec: Exit request sent.
4faf514df4: Exit request sent.
6be186f071: Exit request sent.
b188628b2d: Exit request sent.
b585b88659: Exit request sent.
```

**Note:** This closes every held connection. (Ansible does it by itself 60 seconds after the last task.) 7 held connections closed.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -i inventory/rollout.ini -m ping
```

**Output**

```text
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).",
    "unreachable": true
}
```

**Note:** Now Ansible has to log in again, and the login is refused: web1 is locked out.

## Step 9

**Command**

```sh
docker exec anp-web1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
```

**Output**

```text
web1: exit 0, Restarting OpenBSD Secure Shell server: sshd.
```

**Note:** The second way in: docker exec, as root. It puts back the copy that the push made. It took 0.5 s.

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -i inventory/rollout.ini -m ping
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 1 of 1 hosts answer again.

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/no-sharing.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-unsafe.yml --limit web1 -e 'ssh_allow_users=deploy'
```

**Output**

```text

PLAY [Push sshd_config, unsafe version] ****************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web1]

TASK [Install the new sshd_config] *********************************************
changed: [web1]

TASK [Restart sshd] ************************************************************
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).

Task failed.
Origin: /work/challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-unsafe.yml:28:7

26         mode: "0644"
27
28     - name: Restart sshd
         ^ column 7

<<< caused by >>>

Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).

fatal: [web1]: UNREACHABLE! => {"changed": false, "msg": "Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).", "unreachable": true}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=1    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** With sharing off, the play is not green any more: the task "Restart sshd" is UNREACHABLE (1 line). The file was written by the task before it, and sshd was not restarted yet. A new login already follows the file on disk.

## Step 12

**Command**

```sh
docker exec anp-web1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
```

**Output**

```text
web1: exit 0, Restarting OpenBSD Secure Shell server: sshd.
```

**Note:** web1 is back through the second way in. It took 0.4 s.

## Step 13

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -i challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/no-sharing.ini -m ping
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 1 of 1 hosts answer again.

## Step 14

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml --limit web1 -e 'ssh_extra_line=AllowUser deploy'
```

**Output**

```text

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web1]

TASK [Install the new sshd_config] *********************************************
[ERROR]: Task failed: Module failed: failed to validate
Origin: /work/challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml:19:7

17         mode: preserve
18
19     - name: Install the new sshd_config
         ^ column 7

fatal: [web1]: FAILED! => {"changed": false, "checksum": "79d4421c9df9a913169351e56d623e50257db310", "exit_status": 255, "msg": "failed to validate", "stderr": "/home/ansible/.ansible/tmp/ansible-tmp-1794162911.3084507-6368-216374669493319/.source line 9: no argument after keyword \"AllowUser\"\r\n/home/ansible/.ansible/tmp/ansible-tmp-1794162911.3084507-6368-216374669493319/.source: terminating,  ... [355 more characters left out]

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** The file has a typo. validate ran sshd -t on a temporary copy and the task failed (exit code 2). The real file was not touched.

## Step 15

**Command**

```sh
docker exec anp-web1 sha256sum /etc/ssh/sshd_config
```

**Output**

```text
160f305635ec...  web1
```

**Note:** Same hash as before: the bad file never reached /etc/ssh/sshd_config.

## Step 16

**Command**

```sh
docker exec anp-web1 sh -c 'printf "AllowUsers deploy\n" > /tmp/denies-ansible.conf && sshd -t -f /tmp/denies-ansible.conf; echo "exit code $?"'
```

**Output**

```text
exit code 0
```

**Note:** The other kind of mistake: a file that is correct but locks you out. sshd -t finds nothing wrong with it, so validate alone is not enough.

## Step 17

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-unsafe.yml --limit web1 -e 'ssh_allow_users=deploy'
```

**Output**

```text

PLAY [Push sshd_config, unsafe version] ****************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web1]

TASK [Install the new sshd_config] *********************************************
changed: [web1]

TASK [Restart sshd] ************************************************************
changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Unsafe push to one canary host. The play is green: nothing in it checks that a new login still works.

## Step 18

**Command**

```sh
docker exec anp-control ssh -O exit -o ControlPath=/home/learner/.ansible/cp/<socket> any-host
```

**Output**

```text
b188628b2d: Exit request sent.
```

**Note:** Time passes: the held connection closes. 1 held connection closed.

## Step 19

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).",
    "unreachable": true
}
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 1 host unreachable, 6 answer. One host is lost.

## Step 20

**Command**

```sh
docker exec anp-web1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
```

**Output**

```text
web1: exit 0, Restarting OpenBSD Secure Shell server: sshd.
```

**Note:** The second way in puts the old file back on web1. It took 0.8 s.

## Step 21

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts answer again.

## Step 22

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-unsafe.yml -e 'ssh_allow_users=deploy'
```

**Output**

```text

PLAY [Push sshd_config, unsafe version] ****************************************

TASK [Keep a copy of the current sshd_config] **********************************
changed: [web2]
ok: [web1]
changed: [web3]
changed: [web5]
changed: [web4]
changed: [web6]
changed: [db1]

TASK [Install the new sshd_config] *********************************************
changed: [web3]
changed: [web4]
changed: [web1]
changed: [web2]
changed: [web5]
changed: [db1]
changed: [web6]

TASK [Restart sshd] ************************************************************
changed: [web3]
changed: [web1]
changed: [web4]
changed: [web5]
changed: [web2]
changed: [web6]
changed: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=3    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Unsafe push to all hosts at once. 7 of 7 hosts say unreachable=0 failed=0. The play is green.

## Step 23

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts still answer. The held connections hide the damage.

## Step 24

**Command**

```sh
docker exec anp-control ssh -O exit -o ControlPath=/home/learner/.ansible/cp/<socket> any-host
```

**Output**

```text
2dfdfbbbeb: Exit request sent.
34c6fc7619: Exit request sent.
4c819ff0ec: Exit request sent.
4faf514df4: Exit request sent.
6be186f071: Exit request sent.
b188628b2d: Exit request sent.
b585b88659: Exit request sent.
```

**Note:** Time passes: the held connections close. 7 held connections closed.

## Step 25

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).",
    "unreachable": true
}
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web2: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web2 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web2: Permission denied (publickey).",
    "unreachable": true
}
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web3: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web3 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web3: Permission denied (publickey).",
    "unreachable": true
}
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web5: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web5 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web5: Permission denied (publickey).",
    "unreachable": true
}
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web4: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web4 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web4: Permission denied (publickey).",
    "unreachable": true
}
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web6: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web6 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web6: Permission denied (publickey).",
    "unreachable": true
}
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@db1: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

db1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@db1: Permission denied (publickey).",
    "unreachable": true
}
```

**Note:** 7 of 7 hosts are unreachable. Every host is lost.

## Step 26

**Command**

```sh
docker exec anp-web1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
docker exec anp-web2 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
docker exec anp-db1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
docker exec anp-web3 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
docker exec anp-web4 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
docker exec anp-web5 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
docker exec anp-web6 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
```

**Output**

```text
web1: exit 0, Restarting OpenBSD Secure Shell server: sshd.
web2: exit 0, Restarting OpenBSD Secure Shell server: sshd.
db1: exit 0, Restarting OpenBSD Secure Shell server: sshd.
web3: exit 0, Restarting OpenBSD Secure Shell server: sshd.
web4: exit 0, Restarting OpenBSD Secure Shell server: sshd.
web5: exit 0, Restarting OpenBSD Secure Shell server: sshd.
web6: exit 0, Restarting OpenBSD Secure Shell server: sshd.
```

**Note:** The second way in, host by host: all seven get the old file back. It took 4.1 s.

## Step 27

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts answer again.

## Step 28

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml -e 'ssh_allow_users=deploy'
```

**Output**

```text

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web1]

TASK [Install the new sshd_config] *********************************************
changed: [web1]

TASK [Restart sshd] ************************************************************
changed: [web1]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
[ERROR]: Task failed: Action failed: timed out waiting for ping module test: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).
Origin: /work/challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml:39:7

37       ansible.builtin.meta: reset_connection
38
39     - name: Check that a new login works
         ^ column 7

fatal: [web1]: FAILED! => {"changed": false, "elapsed": 10, "msg": "timed out waiting for ping module test: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey)."}

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** The same locking-out file, through your safe playbook. web1 fails the new-login check. The play stops there: 1 host appears in the recap, and the other six were never touched.

## Step 29

**Command**

```sh
docker exec anp-control ssh -O exit -o ControlPath=/home/learner/.ansible/cp/<socket> any-host
```

**Output**

```text
2dfdfbbbeb: Exit request sent.
34c6fc7619: Exit request sent.
4c819ff0ec: Exit request sent.
4faf514df4: Exit request sent.
6be186f071: Exit request sent.
b585b88659: Exit request sent.
```

**Note:** Close any held connection, so that the count below is the real one. 6 held connections closed.

## Step 30

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
[ERROR]: Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).
Origin: <adhoc 'ping' task>

{'action': 'ping', 'args': {}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Task failed: Failed to connect to the host via ssh: ansible@web1: Permission denied (publickey).",
    "unreachable": true
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 1 host unreachable, 6 answer.

## Step 31

**Command**

```sh
docker exec anp-web1 sha256sum /etc/ssh/sshd_config
docker exec anp-web2 sha256sum /etc/ssh/sshd_config
docker exec anp-db1 sha256sum /etc/ssh/sshd_config
docker exec anp-web3 sha256sum /etc/ssh/sshd_config
docker exec anp-web4 sha256sum /etc/ssh/sshd_config
docker exec anp-web5 sha256sum /etc/ssh/sshd_config
docker exec anp-web6 sha256sum /etc/ssh/sshd_config
```

**Output**

```text
1cc5f72b8a06...  web1  (CHANGED)
160f305635ec...  web2  (same as the start)
160f305635ec...  db1  (same as the start)
160f305635ec...  web3  (same as the start)
160f305635ec...  web4  (same as the start)
160f305635ec...  web5  (same as the start)
160f305635ec...  web6  (same as the start)
```

**Note:** 6 of the 6 hosts after web1 still hold the file they started with.

## Step 32

**Command**

```sh
docker exec anp-web1 sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'
```

**Output**

```text
web1: exit 0, Restarting OpenBSD Secure Shell server: sshd.
```

**Note:** Only web1 needs the second way in. It took 1 s.

## Step 33

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts answer again.

## Step 34

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml -e 'ssh_login_grace_time=30'
```

**Output**

```text

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web1]

TASK [Install the new sshd_config] *********************************************
changed: [web1]

TASK [Restart sshd] ************************************************************
changed: [web1]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web1]

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web2]

TASK [Install the new sshd_config] *********************************************
changed: [web2]

TASK [Restart sshd] ************************************************************
changed: [web2]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web2]

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web3]

TASK [Install the new sshd_config] *********************************************
changed: [web3]

TASK [Restart sshd] ************************************************************
changed: [web3]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web3]

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web4]

TASK [Install the new sshd_config] *********************************************
changed: [web4]

TASK [Restart sshd] ************************************************************
changed: [web4]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web4]

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web5]

TASK [Install the new sshd_config] *********************************************
changed: [web5]

TASK [Restart sshd] ************************************************************
changed: [web5]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web5]

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [web6]

TASK [Install the new sshd_config] *********************************************
changed: [web6]

TASK [Restart sshd] ************************************************************
changed: [web6]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web6]

PLAY [Push sshd_config, safe version] ******************************************

TASK [Keep a copy of the current sshd_config] **********************************
ok: [db1]

TASK [Install the new sshd_config] *********************************************
changed: [db1]

TASK [Restart sshd] ************************************************************
changed: [db1]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=4    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** A harmless change (LoginGraceTime 30) through the safe playbook, one host at a time: 7 of 7 hosts changed, none failed.

## Step 35

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts answer.

## Step 36

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i inventory/rollout.ini challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/rollback.yml
```

**Output**

```text

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [web1]

TASK [Stop if there is no copy] ************************************************
ok: [web1] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [web1]

TASK [Restart sshd] ************************************************************
changed: [web1]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web1]

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [web2]

TASK [Stop if there is no copy] ************************************************
ok: [web2] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [web2]

TASK [Restart sshd] ************************************************************
changed: [web2]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web2]

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [web3]

TASK [Stop if there is no copy] ************************************************
ok: [web3] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [web3]

TASK [Restart sshd] ************************************************************
changed: [web3]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web3]

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [web4]

TASK [Stop if there is no copy] ************************************************
ok: [web4] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [web4]

TASK [Restart sshd] ************************************************************
changed: [web4]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web4]

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [web5]

TASK [Stop if there is no copy] ************************************************
ok: [web5] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [web5]

TASK [Restart sshd] ************************************************************
changed: [web5]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web5]

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [web6]

TASK [Stop if there is no copy] ************************************************
ok: [web6] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [web6]

TASK [Restart sshd] ************************************************************
changed: [web6]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [web6]

PLAY [Roll sshd_config back from the copy] *************************************

TASK [Is there a copy to go back to] *******************************************
ok: [db1]

TASK [Stop if there is no copy] ************************************************
ok: [db1] => {
    "changed": false,
    "msg": "All assertions passed"
}

TASK [Put the copy back] *******************************************************
changed: [db1]

TASK [Restart sshd] ************************************************************
changed: [db1]

TASK [Reset the SSH connection] ************************************************

TASK [Check that a new login works] ********************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web3                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web4                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web5                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web6                       : ok=5    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The rollback playbook puts the copy back on each host, tests it, restarts sshd and checks a new login. 7 hosts changed.

## Step 37

**Command**

```sh
node toolkit/ansible.mjs ansible all -i inventory/rollout.ini -m ping
```

**Output**

```text
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web5 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web4 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web3 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
web6 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** 7 of 7 hosts answer.

## Step 38

**Command**

```sh
docker exec anp-web1 sha256sum /etc/ssh/sshd_config
docker exec anp-web2 sha256sum /etc/ssh/sshd_config
docker exec anp-db1 sha256sum /etc/ssh/sshd_config
docker exec anp-web3 sha256sum /etc/ssh/sshd_config
docker exec anp-web4 sha256sum /etc/ssh/sshd_config
docker exec anp-web5 sha256sum /etc/ssh/sshd_config
docker exec anp-web6 sha256sum /etc/ssh/sshd_config
```

**Output**

```text
160f305635ec...  web1  (same as the start)
160f305635ec...  web2  (same as the start)
160f305635ec...  db1  (same as the start)
160f305635ec...  web3  (same as the start)
160f305635ec...  web4  (same as the start)
160f305635ec...  web5  (same as the start)
160f305635ec...  web6  (same as the start)
```

**Note:** 7 of 7 hosts hold exactly the file they started with.
