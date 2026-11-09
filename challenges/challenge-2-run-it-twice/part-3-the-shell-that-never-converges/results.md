# Results: Challenge 2, part 3: the shell that never converges

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the files in reference/; the paths below show the files in the part folder. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/shell-version.yml
```

**Output**

```text

PLAY [The same job, written with shell and command] ****************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Add a line to the app settings] ******************************************
changed: [web1]
changed: [web2]

TASK [Install curl] ************************************************************
changed: [web2]
changed: [web1]

TASK [Make the app folder] *****************************************************
changed: [web1]
changed: [web2]

TASK [Read the app settings] ***************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Shell and command, run 1: 8 changes in total (web1 4, web2 4).

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/shell-version.yml
```

**Output**

```text

PLAY [The same job, written with shell and command] ****************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Add a line to the app settings] ******************************************
changed: [web1]
changed: [web2]

TASK [Install curl] ************************************************************
changed: [web2]
changed: [web1]

TASK [Make the app folder] *****************************************************
changed: [web1]
changed: [web2]

TASK [Read the app settings] ***************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Shell and command, run 2: 8 changes in total (web1 4, web2 4).

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/shell-version.yml
```

**Output**

```text

PLAY [The same job, written with shell and command] ****************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Add a line to the app settings] ******************************************
changed: [web2]
changed: [web1]

TASK [Install curl] ************************************************************
changed: [web1]
changed: [web2]

TASK [Make the app folder] *****************************************************
changed: [web2]
changed: [web1]

TASK [Read the app settings] ***************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Shell and command, run 3: 8 changes in total (web1 4, web2 4).

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -b -m command -a 'cat /etc/myapp.conf'
```

**Output**

```text
web1 | CHANGED | rc=0 >>
app_mode=production
app_mode=production
app_mode=production
```

**Note:** /etc/myapp.conf on web1 now holds 3 line(s).

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/module-version.yml
```

**Output**

```text

PLAY [The same job, written with modules] **************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Add a line to the app settings] ******************************************
changed: [web2]
changed: [web1]

TASK [Install curl] ************************************************************
changed: [web2]
changed: [web1]

TASK [Make the app folder] *****************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Modules, run 1: 6 changes in total (web1 3, web2 3).

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/module-version.yml
```

**Output**

```text

PLAY [The same job, written with modules] **************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Add a line to the app settings] ******************************************
ok: [web1]
ok: [web2]

TASK [Install curl] ************************************************************
ok: [web1]
ok: [web2]

TASK [Make the app folder] *****************************************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Modules, run 2: 0 changes in total (web1 0, web2 0).

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/module-version.yml
```

**Output**

```text

PLAY [The same job, written with modules] **************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Add a line to the app settings] ******************************************
ok: [web2]
ok: [web1]

TASK [Install curl] ************************************************************
ok: [web1]
ok: [web2]

TASK [Make the app folder] *****************************************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Modules, run 3: 0 changes in total (web1 0, web2 0).

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -b -m command -a 'cat /etc/myapp.conf'
```

**Output**

```text
web1 | CHANGED | rc=0 >>
app_mode=production
```

**Note:** /etc/myapp.conf on web1 now holds 1 line(s).

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/creates-version.yml
```

**Output**

```text

PLAY [The same job, still shell and command, made safe to repeat] **************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Add a line to the app settings] ******************************************
changed: [web1]
changed: [web2]

TASK [Install curl] ************************************************************
changed: [web1]
changed: [web2]

TASK [Make the app folder] *****************************************************
changed: [web1]
changed: [web2]

TASK [Read the app settings] ***************************************************
ok: [web2]
ok: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Shell and command with creates, run 1: 6 changes in total (web1 3, web2 3).

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/creates-version.yml
```

**Output**

```text

PLAY [The same job, still shell and command, made safe to repeat] **************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Add a line to the app settings] ******************************************
ok: [web1]
ok: [web2]

TASK [Install curl] ************************************************************
ok: [web1]
ok: [web2]

TASK [Make the app folder] *****************************************************
ok: [web1]
ok: [web2]

TASK [Read the app settings] ***************************************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Shell and command with creates, run 2: 0 changes in total (web1 0, web2 0).

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/creates-version.yml
```

**Output**

```text

PLAY [The same job, still shell and command, made safe to repeat] **************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Add a line to the app settings] ******************************************
ok: [web2]
ok: [web1]

TASK [Install curl] ************************************************************
ok: [web1]
ok: [web2]

TASK [Make the app folder] *****************************************************
ok: [web1]
ok: [web2]

TASK [Read the app settings] ***************************************************
ok: [web1]
ok: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Shell and command with creates, run 3: 0 changes in total (web1 0, web2 0).

## Step 12

**Command**

```sh
node toolkit/ansible.mjs ansible web1 -b -m command -a 'cat /etc/myapp.conf'
```

**Output**

```text
web1 | CHANGED | rc=0 >>
app_mode=production
```

**Note:** /etc/myapp.conf on web1 now holds 1 line(s).
