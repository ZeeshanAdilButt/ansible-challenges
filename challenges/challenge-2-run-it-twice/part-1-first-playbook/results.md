# Results: Challenge 2, part 1: your first playbook

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/site.yml; the paths below show site.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml --syntax-check
```

**Output**

```text

playbook: challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml
```

**Note:** Syntax check: Ansible read the file and found nothing wrong. It did not connect to any host.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml --list-tasks
```

**Output**

```text

playbook: challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml

  play #1 (web): Web servers	TAGS: []
    tasks:
      Install nginx	TAGS: []
      Write the home page	TAGS: []
      Start nginx	TAGS: []

  play #2 (db): Database server	TAGS: []
    tasks:
      Install redis	TAGS: []
      Start redis	TAGS: []
```

**Note:** The playbook has 5 tasks in 2 plays. Gathering Facts is added by Ansible and is not counted.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml
```

**Output**

```text

PLAY [Web servers] *************************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
changed: [web2]
changed: [web1]

TASK [Write the home page] *****************************************************
changed: [web1]
changed: [web2]

TASK [Start nginx] *************************************************************
changed: [web1]
changed: [web2]

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
changed: [db1]

TASK [Start redis] *************************************************************
changed: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** First run: 8 changes in total. Every task that had work to do says changed.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml
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
ok: [web1]

TASK [Start nginx] *************************************************************
ok: [web2]
ok: [web1]

PLAY [Database server] *********************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]

TASK [Install redis] ***********************************************************
ok: [db1]

TASK [Start redis] *************************************************************
ok: [db1]

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Second run: 0 changes. The servers already match the playbook, so every task says ok.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible web -m uri -a 'url=http://localhost/ return_content=yes'
```

**Output**

```text
web1 | SUCCESS => {
    "accept_ranges": "bytes",
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "connection": "close",
    "content": "Hello from web1\n",
    "content_length": "16",
    "content_type": "text/html",
    "cookies": {},
    "cookies_string": "",
    "date": "Sun, 08 Nov 2026 17:26:38 GMT",
    "elapsed": 0,
    "etag": "\"6af0b0ae-10\"",
    "last_modified": "Sun, 08 Nov 2026 17:26:06 GMT",
    "msg": "OK (16 bytes)",
    "redirected": false,
    "server": "nginx/1.22.1",
    "status": 200,
    "url": "http://localhost/"
}
web2 | SUCCESS => {
    "accept_ranges": "bytes",
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "connection": "close",
    "content": "Hello from web2\n",
    "content_length": "16",
    "content_type": "text/html",
    "cookies": {},
    "cookies_string": "",
    "date": "Sun, 08 Nov 2026 17:26:38 GMT",
    "elapsed": 0,
    "etag": "\"6af0b0af-10\"",
    "last_modified": "Sun, 08 Nov 2026 17:26:07 GMT",
    "msg": "OK (16 bytes)",
    "redirected": false,
    "server": "nginx/1.22.1",
    "status": 200,
    "url": "http://localhost/"
}
```

**Note:** 2 web hosts answer with status 200 and their own page.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible db -b -m command -a 'redis-cli ping'
```

**Output**

```text
db1 | CHANGED | rc=0 >>
PONG
```

**Note:** redis answers PONG. (The command module says CHANGED here for the reason you saw in challenge 1: it cannot know that ping only reads.)
