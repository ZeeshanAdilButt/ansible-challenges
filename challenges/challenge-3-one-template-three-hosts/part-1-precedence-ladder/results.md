# Results: Challenge 3, part 1: the precedence ladder

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-defaults"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-defaults"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=role-defaults"
}
ok: [web2] => {
    "msg": "PROBE app_port=role-defaults"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 1, added: role defaults (roles/appconf/defaults/main.yml). Winner on web1: role-defaults. Winner on web2: role-defaults.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=inventory-group-var"
}
ok: [web2] => {
    "msg": "ROLE app_port=inventory-group-var"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=inventory-group-var"
}
ok: [web2] => {
    "msg": "PROBE app_port=inventory-group-var"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 2, added: inventory file group var ([web:vars]). Winner on web1: inventory-group-var. Winner on web2: inventory-group-var.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=inventory-group_vars-all"
}
ok: [web2] => {
    "msg": "ROLE app_port=inventory-group_vars-all"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=inventory-group_vars-all"
}
ok: [web2] => {
    "msg": "PROBE app_port=inventory-group_vars-all"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 3, added: inventory group_vars/all. Winner on web1: inventory-group_vars-all. Winner on web2: inventory-group_vars-all.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=playbook-group_vars-all"
}
ok: [web2] => {
    "msg": "ROLE app_port=playbook-group_vars-all"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=playbook-group_vars-all"
}
ok: [web2] => {
    "msg": "PROBE app_port=playbook-group_vars-all"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 4, added: playbook group_vars/all. Winner on web1: playbook-group_vars-all. Winner on web2: playbook-group_vars-all.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=inventory-group_vars-web"
}
ok: [web2] => {
    "msg": "ROLE app_port=inventory-group_vars-web"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=inventory-group_vars-web"
}
ok: [web2] => {
    "msg": "PROBE app_port=inventory-group_vars-web"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 5, added: inventory group_vars/web. Winner on web1: inventory-group_vars-web. Winner on web2: inventory-group_vars-web.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "ROLE app_port=playbook-group_vars-web"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "PROBE app_port=playbook-group_vars-web"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 6, added: playbook group_vars/web. Winner on web1: playbook-group_vars-web. Winner on web2: playbook-group_vars-web.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "ROLE app_port=inventory-host-var"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "PROBE app_port=inventory-host-var"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 7, added: inventory file host var (web2 app_port=...). Winner on web1: playbook-group_vars-web. Winner on web2: inventory-host-var.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "ROLE app_port=inventory-host_vars-web2"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "PROBE app_port=inventory-host_vars-web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 8, added: inventory host_vars/web2. Winner on web1: playbook-group_vars-web. Winner on web2: inventory-host_vars-web2.

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "ROLE app_port=playbook-host_vars-web2"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=playbook-group_vars-web"
}
ok: [web2] => {
    "msg": "PROBE app_port=playbook-host_vars-web2"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 9, added: playbook host_vars/web2. Winner on web1: playbook-group_vars-web. Winner on web2: playbook-host_vars-web2.

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=play-vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=play-vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=play-vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=play-vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 10, added: play vars:. Winner on web1: play-vars. Winner on web2: play-vars.

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=play-vars_files"
}
ok: [web2] => {
    "msg": "ROLE app_port=play-vars_files"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=play-vars_files"
}
ok: [web2] => {
    "msg": "PROBE app_port=play-vars_files"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 11, added: play vars_files:. Winner on web1: play-vars_files. Winner on web2: play-vars_files.

## Step 12

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=role-vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=role-vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 12, added: role vars (roles/appconf/vars/main.yml). Winner on web1: role-vars. Winner on web2: role-vars.

## Step 13

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=block-vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=block-vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 13, added: block vars:. Winner on web1: block-vars. Winner on web2: block-vars.

## Step 14

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=task-vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=task-vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 14, added: task vars:. Winner on web1: task-vars. Winner on web2: task-vars.

## Step 15

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [Load a vars file] ********************************************************
ok: [web1]
ok: [web2]

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=include_vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=include_vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=include_vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=include_vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 15, added: include_vars task. Winner on web1: include_vars. Winner on web2: include_vars.

## Step 16

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [Load a vars file] ********************************************************
ok: [web1]
ok: [web2]

TASK [Set a fact] **************************************************************
ok: [web1]
ok: [web2]

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=set_fact"
}
ok: [web2] => {
    "msg": "ROLE app_port=set_fact"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=set_fact"
}
ok: [web2] => {
    "msg": "PROBE app_port=set_fact"
}

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 16, added: set_fact task. Winner on web1: set_fact. Winner on web2: set_fact.

## Step 17

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [Load a vars file] ********************************************************
ok: [web1]
ok: [web2]

TASK [Set a fact] **************************************************************
ok: [web1]
ok: [web2]

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-params"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-params"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=set_fact"
}
ok: [web2] => {
    "msg": "PROBE app_port=set_fact"
}

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 17, added: role params (app_port: written next to role: in roles:). Winner on web1: set_fact. Winner on web2: set_fact. Inside the role: web1 role-params, web2 role-params. A task after the role cannot see role params.

## Step 18

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml -e app_port=extra-vars
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [Load a vars file] ********************************************************
ok: [web1]
ok: [web2]

TASK [Set a fact] **************************************************************
ok: [web1]
ok: [web2]

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=extra-vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=extra-vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=extra-vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=extra-vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Step 18, added: extra vars (-e on the command line). Winner on web1: extra-vars. Winner on web2: extra-vars.

## Step 19

**Command**

```sh
cat challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text
---
- name: Which app_port wins?
  hosts: web
  gather_facts: false
  vars:
    app_port: play-vars
  vars_files:
    - vars/extra.yml
  pre_tasks:
    - name: Load a vars file
      ansible.builtin.include_vars:
        file: vars/included.yml

    - name: Set a fact
      ansible.builtin.set_fact:
        app_port: set_fact

  roles:
    - role: appconf
      app_port: role-params
  tasks:
    - name: Probe
      block:
        - name: Print the winner
          ansible.builtin.debug:
            msg: "PROBE app_port={{ app_port }}"
          vars:
            app_port: task-vars
      vars:
        app_port: block-vars
```

**Note:** This file, as it is when all 18 places are switched on.

## Step 20

**Command**

```sh
cat challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini
```

**Output**

```text
[web]
web1
web2 app_port=inventory-host-var

[web:vars]
app_port=inventory-group-var

[all:vars]
ansible_user=ansible
ansible_ssh_private_key_file=/home/learner/.ssh/id_ed25519
```

**Note:** This file, as it is when all 18 places are switched on.

## Step 21

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-params"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-params"
}

TASK [Print the winner] ********************************************************
[ERROR]: Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'app_port' is undefined

Task failed.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml:11:11

 9     - name: Probe
10       block:
11         - name: Print the winner
             ^ column 11

<<< caused by >>>

Finalization of task args for 'ansible.builtin.debug' failed.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml:12:11

10       block:
11         - name: Print the winner
12           ansible.builtin.debug:
             ^ column 11

<<< caused by >>>

Error while resolving value for 'msg': 'app_port' is undefined
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml:13:18

11         - name: Print the winner
12           ansible.builtin.debug:
13             msg: "PROBE app_port={{ app_port }}"
                    ^ column 18

fatal: [web1]: FAILED! => {"msg": "Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'app_port' is undefined"}
fatal: [web2]: FAILED! => {"msg": "Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'app_port' is undefined"}

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web2                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Only role params are set. The task inside the role sees them. The task after the role does not: the variable is undefined there, and the play stops.

## Step 22

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=role-entry-vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=role-entry-vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=role-vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=role-vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** vars: under the role entry, against a vars/main.yml file inside the role.

## Step 23

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/inv/inventory.ini challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/work/site.yml
```

**Output**

```text

PLAY [Which app_port wins?] ****************************************************

TASK [Load a vars file] ********************************************************
ok: [web1]
ok: [web2]

TASK [appconf : Show what the role sees] ***************************************
ok: [web1] => {
    "msg": "ROLE app_port=include_vars"
}
ok: [web2] => {
    "msg": "ROLE app_port=include_vars"
}

TASK [Print the winner] ********************************************************
ok: [web1] => {
    "msg": "PROBE app_port=include_vars"
}
ok: [web2] => {
    "msg": "PROBE app_port=include_vars"
}

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** vars: under the role entry, against an include_vars task that ran before the role.
