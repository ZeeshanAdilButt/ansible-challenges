# Results: Challenge 5, part 2: pin a collection

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/requirements.yml; the paths below show requirements.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-2-pin-a-collection/use-it.yml
```

**Output**

```text
[ERROR]: couldn't resolve module/action 'ansible.posix.sysctl'. This often indicates a misspelling, missing collection, or incorrect module path.
Origin: /work/challenges/challenge-5-your-first-role/part-2-pin-a-collection/use-it.yml:8:7

6   become: true
7   tasks:
8     - name: Write a sysctl setting into a file
        ^ column 7
```

**Note:** Exit code 4. The module ansible.posix.sysctl is not part of ansible-core, and no collection is installed yet.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-galaxy collection install ansible.posix -p collections
```

**Output**

```text
Starting galaxy collection install process
Process install dependency map
Starting collection install process
Downloading https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/ansible-posix-2.2.2.tar.gz to /home/learner/.ansible/tmp/ansible-local-267038g03gkf/tmpekh57osi/ansible-posix-2.2.2-qoqlwm6s
Installing 'ansible.posix:2.2.2' to '/work/collections/ansible_collections/ansible/posix'
ansible.posix:2.2.2 was installed successfully
```

**Note:** No version given: Galaxy picks the newest one.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-galaxy collection list -p collections
```

**Output**

```text

# /work/collections/ansible_collections
Collection    Version
------------- -------
ansible.posix 2.2.2
```

**Note:** The newest version today is 2.2.2. A pin keeps you on the version you tested.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-galaxy collection install -r challenges/challenge-5-your-first-role/part-2-pin-a-collection/requirements.yml -p collections
```

**Output**

```text
Starting galaxy collection install process
Process install dependency map
Starting collection install process
Downloading https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/ansible-posix-2.1.0.tar.gz to /home/learner/.ansible/tmp/ansible-local-2690t9b6weyw/tmppen1xm4n/ansible-posix-2.1.0-pp44o8b6
Installing 'ansible.posix:2.1.0' to '/work/collections/ansible_collections/ansible/posix'
ansible.posix:2.1.0 was installed successfully
```

**Note:** Downloaded from Galaxy and unpacked into collections/. Run three times from an empty folder: 114.5 s, 94.6 s, 59.6 s.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-galaxy collection list -p collections
```

**Output**

```text

# /work/collections/ansible_collections
Collection    Version
------------- -------
ansible.posix 2.1.0
```

**Note:** The collection list shows the exact version that is on disk.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-2-pin-a-collection/use-it.yml
```

**Output**

```text

PLAY [Use a module from a collection] ******************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Write a sysctl setting into a file] **************************************
[WARNING]: Deprecation warnings can be disabled by setting `deprecation_warnings=False` in ansible.cfg.
[DEPRECATION WARNING]: Importing 'to_native' from 'ansible.module_utils._text' is deprecated. This feature will be removed from ansible-core version 2.24. Use ansible.module_utils.common.text.converters instead.
changed: [web2]
changed: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 2: the module from the collection ran on each web host.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-2-pin-a-collection/use-it.yml
```

**Output**

```text

PLAY [Use a module from a collection] ******************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Write a sysctl setting into a file] **************************************
[WARNING]: Deprecation warnings can be disabled by setting `deprecation_warnings=False` in ansible.cfg.
[DEPRECATION WARNING]: Importing 'to_native' from 'ansible.module_utils._text' is deprecated. This feature will be removed from ansible-core version 2.24. Use ansible.module_utils.common.text.converters instead.
ok: [web2]
ok: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 0: the module is idempotent.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-galaxy collection install -r challenges/challenge-5-your-first-role/part-2-pin-a-collection/requirements.yml -p collections
```

**Output**

```text
Starting galaxy collection install process
Nothing to do. All requested collections are already installed. If you want to reinstall them, consider using `--force`.
```

**Note:** A second install does nothing when the pinned version is already there.

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible-galaxy collection install -r challenges/challenge-5-your-first-role/part-2-pin-a-collection/bad-requirements.yml -p collections
```

**Output**

```text
Starting galaxy collection install process
Process install dependency map
[ERROR]: Failed to resolve the requested dependencies map. Could not satisfy the following requirements:
* ansible.posix:99.0.0 (direct request)
Hint: Pre-releases hosted on Galaxy or Automation Hub are not installed by default unless a specific version is requested. To enable pre-releases globally, use --pre: [RequirementInformation(requirement=<ansible.posix:99.0.0 of type 'galaxy' from Galaxy>, parent=None)]: Requirements conflict: <ansible.posix:99.0.0 of type 'galaxy' from Galaxy>
```

**Note:** Exit code 1. Galaxy has no version 99.0.0, so the install stops. Nothing on disk changed.
