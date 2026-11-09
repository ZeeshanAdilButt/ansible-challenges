# Results: Challenge 3, part 2: facts

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/facts.yml; the paths below show facts.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/missing-fact.yml
```

**Output**

```text

PLAY [Ask for the IPv4 address] ************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]

TASK [Show the IPv4 address] ***************************************************
[ERROR]: Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': object of type 'dict' has no attribute 'default_ipv4'

Task failed.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/missing-fact.yml:8:7

6   hosts: web1
7   tasks:
8     - name: Show the IPv4 address
        ^ column 7

<<< caused by >>>

Finalization of task args for 'ansible.builtin.debug' failed.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/missing-fact.yml:9:7

7   tasks:
8     - name: Show the IPv4 address
9       ansible.builtin.debug:
        ^ column 7

<<< caused by >>>

Error while resolving value for 'msg': object of type 'dict' has no attribute 'default_ipv4'
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/missing-fact.yml:10:14

 8     - name: Show the IPv4 address
 9       ansible.builtin.debug:
10         msg: "IPV4={{ ansible_facts['default_ipv4']['address'] }}"
                ^ column 14

fatal: [web1]: FAILED! => {"msg": "Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': object of type 'dict' has no attribute 'default_ipv4'"}

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** On new servers the IPv4 fact does not exist, and nothing warned you when the facts were gathered. The error comes only when a task asks for it.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/facts.yml
```

**Output**

```text

PLAY [Read facts the new way] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]
ok: [db1]

TASK [Install iproute2, the ip command that Ansible uses for network facts] ****
changed: [web1]
changed: [web2]
changed: [db1]

TASK [Gather the facts again] **************************************************
ok: [db1]
ok: [web2]
ok: [web1]

TASK [Show the distribution] ***************************************************
ok: [web1] => {
    "msg": "DISTRIBUTION=Debian"
}
ok: [web2] => {
    "msg": "DISTRIBUTION=Debian"
}
ok: [db1] => {
    "msg": "DISTRIBUTION=Debian"
}

TASK [Show the IPv4 address] ***************************************************
ok: [web1] => {
    "msg": "IPV4=172.25.0.5"
}
ok: [web2] => {
    "msg": "IPV4=172.25.0.4"
}
ok: [db1] => {
    "msg": "IPV4=172.25.0.3"
}

TASK [Show the memory in MB] ***************************************************
ok: [web1] => {
    "msg": "MEMORY_MB=15835"
}
ok: [web2] => {
    "msg": "MEMORY_MB=15835"
}
ok: [db1] => {
    "msg": "MEMORY_MB=15835"
}

TASK [Show the package manager] ************************************************
ok: [web1] => {
    "msg": "PKG_MGR=apt"
}
ok: [web2] => {
    "msg": "PKG_MGR=apt"
}
ok: [db1] => {
    "msg": "PKG_MGR=apt"
}

PLAY RECAP *********************************************************************
db1                        : ok=7    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=7    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Four facts from three hosts, read with ansible_facts[...].

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml
```

**Output**

```text

PLAY [Read facts the old way] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]
ok: [db1]

TASK [Show the distribution with the old name] *********************************
[WARNING]: Deprecation warnings can be disabled by setting `deprecation_warnings=False` in ansible.cfg.
[DEPRECATION WARNING]: INJECT_FACTS_AS_VARS default to `True` is deprecated, top-level facts will not be auto injected after the change. This feature will be removed from ansible-core version 2.24.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml:11:14

 9     - name: Show the distribution with the old name
10       ansible.builtin.debug:
11         msg: "OLD DISTRIBUTION={{ ansible_distribution }}"
                ^ column 14

Use `ansible_facts["fact_name"]` (no `ansible_` prefix) instead.

ok: [web1] => {
    "msg": "OLD DISTRIBUTION=Debian"
}
ok: [web2] => {
    "msg": "OLD DISTRIBUTION=Debian"
}
ok: [db1] => {
    "msg": "OLD DISTRIBUTION=Debian"
}

TASK [Show the package manager with the old name] ******************************
[DEPRECATION WARNING]: INJECT_FACTS_AS_VARS default to `True` is deprecated, top-level facts will not be auto injected after the change. This feature will be removed from ansible-core version 2.24.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml:15:14

13     - name: Show the package manager with the old name
14       ansible.builtin.debug:
15         msg: "OLD PKG_MGR={{ ansible_pkg_mgr }}"
                ^ column 14

Use `ansible_facts["fact_name"]` (no `ansible_` prefix) instead.

ok: [web1] => {
    "msg": "OLD PKG_MGR=apt"
}
ok: [web2] => {
    "msg": "OLD PKG_MGR=apt"
}
ok: [db1] => {
    "msg": "OLD PKG_MGR=apt"
}

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The old way still works. Ansible printed 2 deprecation warnings: one for each task that uses an injected fact, not one for each host.

## Step 4

**Command**

```sh
ANSIBLE_INJECT_FACT_VARS=false node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml
```

**Output**

```text

PLAY [Read facts the old way] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [db1]
ok: [web1]
ok: [web2]

TASK [Show the distribution with the old name] *********************************
[ERROR]: Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'ansible_distribution' is undefined

Task failed.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml:9:7

7   hosts: all
8   tasks:
9     - name: Show the distribution with the old name
        ^ column 7

<<< caused by >>>

Finalization of task args for 'ansible.builtin.debug' failed.
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml:10:7

 8   tasks:
 9     - name: Show the distribution with the old name
10       ansible.builtin.debug:
         ^ column 7

<<< caused by >>>

Error while resolving value for 'msg': 'ansible_distribution' is undefined
Origin: /work/challenges/challenge-3-one-template-three-hosts/part-2-facts/old-style.yml:11:14

 9     - name: Show the distribution with the old name
10       ansible.builtin.debug:
11         msg: "OLD DISTRIBUTION={{ ansible_distribution }}"
                ^ column 14

fatal: [web1]: FAILED! => {"msg": "Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'ansible_distribution' is undefined"}
fatal: [web2]: FAILED! => {"msg": "Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'ansible_distribution' is undefined"}
fatal: [db1]: FAILED! => {"msg": "Task failed: Finalization of task args for 'ansible.builtin.debug' failed: Error while resolving value for 'msg': 'ansible_distribution' is undefined"}

PLAY RECAP *********************************************************************
db1                        : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web1                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0   
web2                       : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** With injection off, the old name does not exist. This is what "removed" will look like.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/gather-full.yml
```

**Output**

```text

PLAY [Gather all facts] ********************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [db1]
ok: [web1]

TASK [Count the facts] *********************************************************
ok: [web1] => {
    "msg": "FACT_COUNT=105"
}
ok: [web2] => {
    "msg": "FACT_COUNT=105"
}
ok: [db1] => {
    "msg": "FACT_COUNT=105"
}

TASK [Is the IPv4 fact there?] *************************************************
ok: [web1] => {
    "msg": "HAS_DEFAULT_IPV4=True"
}
ok: [web2] => {
    "msg": "HAS_DEFAULT_IPV4=True"
}
ok: [db1] => {
    "msg": "HAS_DEFAULT_IPV4=True"
}

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** All facts: 105 facts per host, and the IPv4 fact is there.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/gather-min.yml
```

**Output**

```text

PLAY [Gather the minimal facts] ************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [db1]
ok: [web1]

TASK [Count the facts] *********************************************************
ok: [web1] => {
    "msg": "FACT_COUNT=53"
}
ok: [web2] => {
    "msg": "FACT_COUNT=53"
}
ok: [db1] => {
    "msg": "FACT_COUNT=53"
}

TASK [Is the IPv4 fact there?] *************************************************
ok: [web1] => {
    "msg": "HAS_DEFAULT_IPV4=False"
}
ok: [web2] => {
    "msg": "HAS_DEFAULT_IPV4=False"
}
ok: [db1] => {
    "msg": "HAS_DEFAULT_IPV4=False"
}

PLAY RECAP *********************************************************************
db1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** gather_subset: min: 53 facts per host, and no IPv4 fact.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-3-one-template-three-hosts/part-2-facts/time-gather.yml   (three runs; mean of the three hosts per run)
```

**Output**

```text
Settings as they are (seconds per module call):
all facts                      1.75  3.56  2.92   median 2.92 s
gather_subset: min             1.98  2.50  1.92   median 1.98 s
ping, no facts                 1.32  1.43  1.70   median 1.43 s

With ANSIBLE_PIPELINING=True (seconds per module call):
all facts                      2.35  2.08  2.58   median 2.35 s
gather_subset: min             1.31  1.52  1.85   median 1.52 s
ping, no facts                 1.01  0.80  1.25   median 1.01 s
```

**Note:** Seconds for one call of the module on one host, measured inside the playbook (five calls, averaged), so starting Ansible is not counted. Every call still pays for the SSH trip, which the ping row shows.
