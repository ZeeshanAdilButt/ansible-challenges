# Results: Challenge 1, part 1: check your setup and start the fleet

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/check-setup.mjs
```

**Output**

```text
ok    Node.js                  v22.22.2
ok    Docker engine            engine 29.9.2, client 29.9.2
ok    Machine type             linux/x86_64, Docker Desktop. Some behaviour differs on Docker Desktop. The READMEs tell you where.
ok    Docker memory            15.5 GB
ok    CPUs for Docker          20
ok    Cgroup version           v2
ok    Compose plugin           v5.6.1
ok    Fleet images             anp-control:1 and anp-target:1 are built
warn  Free disk (this folder)  4.8 GB. 5 GB or more is better.

All hard checks passed.
```

**Note:** No FAIL lines, so the machine is ready.

## Step 2

**Command**

```sh
docker compose -f fleet/compose.yaml build control web1
```

**Output**

```text
REPOSITORY:TAG   SIZE
anp-target:1     236MB
anp-control:1    439MB
```

**Note:** Two images: the control node is 439.4 MB and a target is 236.3 MB on disk.

## Step 3

**Command**

```sh
node toolkit/fleet.mjs up
```

**Output**

```text
NAMES         STATUS         IMAGE
anp-control   Up 4 seconds   anp-control:1
anp-web2      Up 1 second    anp-target:1
anp-db1       Up 5 seconds   anp-target:1
anp-web1      Up 3 seconds   anp-target:1

The fleet answers on SSH after 7.7 s.
```

**Note:** Four containers run. Starting from nothing took 7.2, 14.9, 7.7 s in three tries; the median is 7.7 s. The images were already built.

## Step 4

**Command**

```sh
docker exec anp-control ls -l /home/learner/.ssh
```

**Output**

```text
total 8
-rw------- 1 learner learner 411 Nov  8 17:36 id_ed25519
-rw-r--r-- 1 learner learner  98 Nov  8 17:36 id_ed25519.pub
```

**Note:** The private key is mode 600 (only you can read it). ssh refuses a key that others can read.

## Step 5

**Command**

```sh
docker exec anp-control ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ansible@web1 'hostname; id -un; sudo -n id -un'
```

**Output**

```text
web1
ansible
root
```

**Note:** web1 let the key in. The three lines are the host name, the user, and the user after sudo.

## Step 6

**Command**

```sh
docker exec anp-control ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ansible@web2 'hostname; id -un; sudo -n id -un'
```

**Output**

```text
web2
ansible
root
```

**Note:** web2 let the key in. The three lines are the host name, the user, and the user after sudo.

## Step 7

**Command**

```sh
docker exec anp-control ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ansible@db1 'hostname; id -un; sudo -n id -un'
```

**Output**

```text
db1
ansible
root
```

**Note:** db1 let the key in. The three lines are the host name, the user, and the user after sudo.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible --version
```

**Output**

```text
ansible [core 2.21.6]
  config file = /work/ansible.cfg
  configured module search path = ['/home/learner/.ansible/plugins/modules', '/usr/share/ansible/plugins/modules']
  ansible python module location = /usr/local/lib/python3.12/site-packages/ansible
  ansible collection location = /work/collections
  executable location = /usr/local/bin/ansible
  python version = 3.12.16 (main, Nov  5 2026, 07:58:44) [GCC 12.2.0] (/usr/local/bin/python3.12)
  jinja version = 3.1.6
  pyyaml version = 6.0.3 (with libyaml v0.2.5)
```

**Note:** The control node runs the pinned version, on Python 3.12.

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible all -m ping
```

**Output**

```text
db1 | SUCCESS => {
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
```

**Note:** 3 of 3 hosts answered pong. ping here is not a network ping: it logs in over SSH and runs a small Python module.
