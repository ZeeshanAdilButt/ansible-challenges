# Results: Challenge 1, part 2: the inventory and ad hoc commands

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/my-inventory.ini; the paths below show my-inventory.ini. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini --graph
```

**Output**

```text
@all:
  |--@ungrouped:
  |--@web:
  |  |--web1
  |  |--web2
  |--@db:
  |  |--db1
```

**Note:** The inventory is a tree. The group all holds every host. web and db are groups you made.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible all -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini --list-hosts
```

**Output**

```text
  hosts (3):
    web1
    web2
    db1
```

**Note:** all selects 3 hosts.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible web -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini --list-hosts
```

**Output**

```text
  hosts (2):
    web1
    web2
```

**Note:** web selects 2 hosts.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible 'all:!db' -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini --list-hosts
```

**Output**

```text
  hosts (2):
    web1
    web2
```

**Note:** all:!db means "all, except db". It selects 2 hosts.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible 'web:&db' -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini --list-hosts
```

**Output**

```text
[WARNING]: No hosts matched, nothing to do
  hosts (0):
```

**Note:** web:&db means "in web and also in db". No host is in both, so it selects 0.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible all -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -m setup -a 'filter=ansible_distribution*'
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "ansible_distribution": "Debian",
        "ansible_distribution_file_parsed": true,
        "ansible_distribution_file_path": "/etc/os-release",
        "ansible_distribution_file_variety": "Debian",
        "ansible_distribution_major_version": "12",
        "ansible_distribution_minor_version": "15",
        "ansible_distribution_release": "bookworm",
        "ansible_distribution_version": "12.15",
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false
}
db1 | SUCCESS => {
    "ansible_facts": {
        "ansible_distribution": "Debian",
        "ansible_distribution_file_parsed": true,
        "ansible_distribution_file_path": "/etc/os-release",
        "ansible_distribution_file_variety": "Debian",
        "ansible_distribution_major_version": "12",
        "ansible_distribution_minor_version": "15",
        "ansible_distribution_release": "bookworm",
        "ansible_distribution_version": "12.15",
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false
}
web2 | SUCCESS => {
    "ansible_facts": {
        "ansible_distribution": "Debian",
        "ansible_distribution_file_parsed": true,
        "ansible_distribution_file_path": "/etc/os-release",
        "ansible_distribution_file_variety": "Debian",
        "ansible_distribution_major_version": "12",
        "ansible_distribution_minor_version": "15",
        "ansible_distribution_release": "bookworm",
        "ansible_distribution_version": "12.15",
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false
}
```

**Note:** The setup module gathers facts. filter= keeps only the names that match.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible all -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -m setup -a filter=ansible_python_version
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "ansible_python_version": "3.11.2",
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false
}
db1 | SUCCESS => {
    "ansible_facts": {
        "ansible_python_version": "3.11.2",
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false
}
web2 | SUCCESS => {
    "ansible_facts": {
        "ansible_python_version": "3.11.2",
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false
}
```

**Note:** The Python that Ansible found on each target. It runs the modules with this one.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-config dump --only-changed
```

**Output**

```text
COLLECTIONS_PATHS(/work/ansible.cfg) = ['/work/collections']
CONFIG_FILE() = /work/ansible.cfg
DEFAULT_HOST_LIST(/work/ansible.cfg) = ['/work/inventory/fleet.ini']
HOST_KEY_CHECKING(/work/ansible.cfg) = False
INTERPRETER_PYTHON(/work/ansible.cfg) = auto_silent
RETRY_FILES_ENABLED(/work/ansible.cfg) = False

GALAXY_SERVERS:
```

**Note:** ansible.cfg sets interpreter_python to auto_silent. This shows the settings that differ from the defaults.

## Step 9

**Command**

```sh
ANSIBLE_PYTHON_INTERPRETER=auto node toolkit/ansible.mjs ansible all -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -m ping
```

**Output**

```text
[WARNING]: Host 'web1' is using the discovered Python interpreter at '/usr/bin/python3.11', but future installation of another Python interpreter could cause a different interpreter to be discovered. See https://docs.ansible.com/ansible-core/2.21/reference_appendices/interpreter_discovery.html for more information.
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
[WARNING]: Host 'web2' is using the discovered Python interpreter at '/usr/bin/python3.11', but future installation of another Python interpreter could cause a different interpreter to be discovered. See https://docs.ansible.com/ansible-core/2.21/reference_appendices/interpreter_discovery.html for more information.
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
[WARNING]: Host 'db1' is using the discovered Python interpreter at '/usr/bin/python3.11', but future installation of another Python interpreter could cause a different interpreter to be discovered. See https://docs.ansible.com/ansible-core/2.21/reference_appendices/interpreter_discovery.html for more information.
db1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "ping": "pong"
}
```

**Note:** With interpreter_python on its default (auto), Ansible printed 3 warning lines.

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible all -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -m ping
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
```

**Note:** With auto_silent from ansible.cfg, it printed 0 warning lines.

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible web -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -m apt -a 'name=nginx state=present'
```

**Output**

```text
[ERROR]: Task failed: Module failed: '/usr/bin/apt-get -y -o "Dpkg::Options::=--force-confdef" -o "Dpkg::Options::=--force-confold" -o DPkg::Lock::Timeout=60       install 'nginx=1.22.1-9+deb12u10'' failed: E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)
E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?

Origin: <adhoc 'apt' task>

{'action': 'apt', 'args': {'name': 'nginx', 'state': 'present'}, 'timeout': 0, 'async_val': 0, 'poll': 15}

web2 | FAILED! => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "cache_update_time": 1794156357,
    "cache_updated": false,
    "changed": false,
    "msg": "'/usr/bin/apt-get -y -o \"Dpkg::Options::=--force-confdef\" -o \"Dpkg::Options::=--force-confold\" -o DPkg::Lock::Timeout=60       install 'nginx=1.22.1-9+deb12u10'' failed: E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n",
    "rc": 100,
    "stderr": "E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n",
    "stderr_lines": [ 2 lines, the same text as "stderr", left out ],
    "stdout": "",
    "stdout_lines": []
}
web1 | FAILED! => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "cache_update_time": 1794156357,
    "cache_updated": false,
    "changed": false,
    "msg": "'/usr/bin/apt-get -y -o \"Dpkg::Options::=--force-confdef\" -o \"Dpkg::Options::=--force-confold\" -o DPkg::Lock::Timeout=60       install 'nginx=1.22.1-9+deb12u10'' failed: E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n",
    "rc": 100,
    "stderr": "E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n",
    "stderr_lines": [ 2 lines, the same text as "stderr", left out ],
    "stdout": "",
    "stdout_lines": []
}
```

**Note:** It fails: the user ansible is not root, and installing a package needs root. This is why we add -b (become).

## Step 12

**Command**

```sh
node toolkit/ansible.mjs ansible web -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -b -m apt -a 'name=nginx state=present'
```

**Output**

```text
web2 | CHANGED => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "cache_update_time": 1794156357,
    "cache_updated": false,
    "changed": true,
    "stderr": "",
    "stderr_lines": [],
    "stdout": "Reading package lists...\nBuilding dependency tree...\nReading state information...\nThe following additional packages will be installed:\n  iproute2 libatm1 libbpf1 libcap2-bin libelf1 libmnl0 libpam-cap libxtables12\n  nginx-common\nSuggested packages:\n  iproute2-doc fcgiwrap nginx-doc ssl-cert\nThe following NEW packages will be installed:\n  iproute2 libatm1 libbpf1 libcap2-bin ... [4272 more characters left out]
    "stdout_lines": [ 91 lines, the same text as "stdout", left out ]
}
web1 | CHANGED => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "cache_update_time": 1794156357,
    "cache_updated": false,
    "changed": true,
    "stderr": "",
    "stderr_lines": [],
    "stdout": "Reading package lists...\nBuilding dependency tree...\nReading state information...\nThe following additional packages will be installed:\n  iproute2 libatm1 libbpf1 libcap2-bin libelf1 libmnl0 libpam-cap libxtables12\n  nginx-common\nSuggested packages:\n  iproute2-doc fcgiwrap nginx-doc ssl-cert\nThe following NEW packages will be installed:\n  iproute2 libatm1 libbpf1 libcap2-bin ... [4271 more characters left out]
    "stdout_lines": [ 91 lines, the same text as "stdout", left out ]
}
```

**Note:** 2 hosts changed: nginx was installed on web1 and web2 only.

## Step 13

**Command**

```sh
node toolkit/ansible.mjs ansible web -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -b -m apt -a 'name=nginx state=present'
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "cache_update_time": 1794156357,
    "cache_updated": false,
    "changed": false
}
web2 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "cache_update_time": 1794156357,
    "cache_updated": false,
    "changed": false
}
```

**Note:** 0 hosts changed. The same command, run twice, changes things once. That is idempotence.

## Step 14

**Command**

```sh
node toolkit/ansible.mjs ansible all -i challenges/challenge-1-first-contact/part-2-inventory-and-ad-hoc/my-inventory.ini -m command -a uptime
```

**Output**

```text
web1 | CHANGED | rc=0 >>
 17:04:54 up  5:35,  0 user,  load average: 9.43, 8.28, 6.79
db1 | CHANGED | rc=0 >>
 17:04:54 up  5:35,  0 user,  load average: 9.43, 8.28, 6.79
web2 | CHANGED | rc=0 >>
 17:04:54 up  5:35,  0 user,  load average: 9.43, 8.28, 6.79
```

**Note:** 3 of 3 hosts say CHANGED, although uptime only reads. The command module cannot know, so it always says changed.
