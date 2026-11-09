# Results: Challenge 5, part 1: move a playbook into a role

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the files in reference/; the paths below show the files without it. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/before.yml
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Install nginx] ***********************************************************
changed: [web2]
changed: [web1]

TASK [Make the web root] *******************************************************
changed: [web2]
changed: [web1]

TASK [Write the index page] ****************************************************
changed: [web1]
changed: [web2]

TASK [Write the nginx site config] *********************************************
changed: [web2]
changed: [web1]

TASK [Start nginx] *************************************************************
changed: [web1]
changed: [web2]

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 12: 5 tasks and the handler changed on each of 2 web hosts. Handler runs: 2.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/before.yml
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

TASK [Make the web root] *******************************************************
ok: [web2]
ok: [web1]

TASK [Write the index page] ****************************************************
ok: [web2]
ok: [web1]

TASK [Write the nginx site config] *********************************************
ok: [web1]
ok: [web2]

TASK [Start nginx] *************************************************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 0. This is the "before" picture: it works, and the second run changes nothing.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/site.yml --list-tasks
```

**Output**

```text

playbook: challenges/challenge-5-your-first-role/part-1-move-to-a-role/reference/site.yml

  play #1 (web): Web servers with nginx	TAGS: []
    tasks:
      webserver : Install nginx	TAGS: []
      webserver : Make the web root	TAGS: []
      webserver : Write the index page	TAGS: []
      webserver : Write the nginx site config	TAGS: []
      webserver : Start nginx	TAGS: []
```

**Note:** ansible-playbook can list the tasks without running them. A task that comes from a role is shown with the role name in front.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/site.yml
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [webserver : Install nginx] ***********************************************
changed: [web1]
changed: [web2]

TASK [webserver : Make the web root] *******************************************
changed: [web1]
changed: [web2]

TASK [webserver : Write the index page] ****************************************
changed: [web1]
changed: [web2]

TASK [webserver : Write the nginx site config] *********************************
changed: [web1]
changed: [web2]

TASK [webserver : Start nginx] *************************************************
changed: [web2]
changed: [web1]

RUNNING HANDLER [webserver : Reload nginx] *************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 12. Handler runs: 2. The same numbers as the playbook.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/site.yml
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [webserver : Install nginx] ***********************************************
ok: [web1]
ok: [web2]

TASK [webserver : Make the web root] *******************************************
ok: [web2]
ok: [web1]

TASK [webserver : Write the index page] ****************************************
ok: [web2]
ok: [web1]

TASK [webserver : Write the nginx site config] *********************************
ok: [web1]
ok: [web2]

TASK [webserver : Start nginx] *************************************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 0.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/site.yml -e site_port=9090
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [webserver : Install nginx] ***********************************************
ok: [web1]
ok: [web2]

TASK [webserver : Make the web root] *******************************************
ok: [web2]
ok: [web1]

TASK [webserver : Write the index page] ****************************************
ok: [web1]
ok: [web2]

TASK [webserver : Write the nginx site config] *********************************
changed: [web2]
changed: [web1]

TASK [webserver : Start nginx] *************************************************
ok: [web1]
ok: [web2]

RUNNING HANDLER [webserver : Reload nginx] *************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 4: the template changed and the handler ran, on each host.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible web -m command -a 'grep listen /etc/nginx/conf.d/site.conf'
```

**Output**

```text
web2 | CHANGED | rc=0 >>
    listen 9090;
web1 | CHANGED | rc=0 >>
    listen 9090;
```

**Note:** The config now says 9090.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/typo.yml
```

**Output**

```text
[ERROR]: The role 'webservr' was not found in: /work/challenges/challenge-5-your-first-role/part-1-move-to-a-role/roles:/home/learner/.ansible/roles:/usr/share/ansible/roles:/etc/ansible/roles:/work/challenges/challenge-5-your-first-role/part-1-move-to-a-role
Origin: /work/challenges/challenge-5-your-first-role/part-1-move-to-a-role/typo.yml:7:7

5   become: true
6   roles:
7     - webservr
        ^ column 7
```

**Note:** Exit code 1. Ansible looked for the role in the places it knows and did not find it.
