# Results: Challenge 9, part 1: the stages, locally

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/guard.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-9-your-pipeline/part-1-stages-locally/inventory/practice.ini challenges/challenge-9-your-pipeline/part-1-stages-locally/guard.yml
```

**Output**

```text

PLAY [Guard, stop unless this is the practice environment] *********************

TASK [Check the environment] ***************************************************
ok: [web1] => {
    "changed": false,
    "msg": "Environment is practice. Go on."
}

PLAY RECAP *********************************************************************
web1                       : ok=1    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The guard passes for the practice inventory (exit code 0).

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-9-your-pipeline/part-1-stages-locally/inventory/production.ini challenges/challenge-9-your-pipeline/part-1-stages-locally/site.yml
```

**Output**

```text

PLAY [Guard, stop unless this is the practice environment] *********************

TASK [Check the environment] ***************************************************
[ERROR]: Task failed: Action failed: Refusing to run. deploy_environment is 'production', not 'practice'.
Origin: /work/challenges/challenge-9-your-pipeline/part-1-stages-locally/guard.yml:16:7

14   run_once: true
15   tasks:
16     - name: Check the environment
         ^ column 7

fatal: [prod-web1]: FAILED! => {
    "assertion": "deploy_environment | default('not set') == 'practice'",
    "changed": false,
    "evaluated_to": false,
    "msg": "Refusing to run. deploy_environment is 'production', not 'practice'."
}

PLAY RECAP *********************************************************************
prod-web1                  : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** The guard refuses the fake production inventory (exit code 2). The banner play never started.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-9-your-pipeline/part-1-stages-locally/inventory/production.ini challenges/challenge-9-your-pipeline/part-1-stages-locally/site.yml -vvv | grep -c "ESTABLISH SSH CONNECTION"
```

**Output**

```text
0
```

**Note:** 0 SSH connections were opened. The guard runs with connection: local, so it stops the run before Ansible reaches any host.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i 'web1,' challenges/challenge-9-your-pipeline/part-1-stages-locally/guard.yml
```

**Output**

```text

PLAY [Guard, stop unless this is the practice environment] *********************

TASK [Check the environment] ***************************************************
[ERROR]: Task failed: Action failed: Refusing to run. deploy_environment is 'not set', not 'practice'.
Origin: /work/challenges/challenge-9-your-pipeline/part-1-stages-locally/guard.yml:16:7

14   run_once: true
15   tasks:
16     - name: Check the environment
         ^ column 7

fatal: [web1]: FAILED! => {
    "assertion": "deploy_environment | default('not set') == 'practice'",
    "changed": false,
    "evaluated_to": false,
    "msg": "Refusing to run. deploy_environment is 'not set', not 'practice'."
}

PLAY RECAP *********************************************************************
web1                       : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** An inventory that does not set deploy_environment at all is refused too (exit code 2).

## Step 5

**Command**

```sh
node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs
```

**Output**

```text
PASSED   lint            14.9 s   ansible-lint passed the "production" profile
PASSED   syntax-check     2.2 s   the playbook parses
PASSED   molecule        89.4 s   molecule test passed (7 of 12 actions successful)
PASSED   check-mode       5.8 s   check mode ran, 2 hosts would change
PASSED   apply            5.7 s   applied, 2 hosts changed
PASSED   second-run       5.4 s   second run changed 0 hosts

The pipeline passed.
```

**Note:** The six stages, in order, exit code 0.

## Step 6

**Command**

```sh
node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --playbook broken-site.yml
```

**Output**

```text
FAILED   lint             9.9 s   ansible-lint found problems (exit code 2)

WARNING  Listing 2 violation(s) that are fatal
name[missing]: All tasks should be named.
broken-site.yml:11 Task/Handler: command echo hello

no-changed-when: Commands should not change things if nothing needs doing.
broken-site.yml:11 Task/Handler: command echo hello

Read documentation for instructions on how to ignore specific rule violations.

# Rule Violation Summary

  1 name profile:basic tags:idiom
  1 no-changed-when profile:basic tags:command-shell,idempotency

Failed: 2 failure(s), 0 warning(s) in 2 files processed of 2 encountered. Profile 'production' was required, but 'min' profile passed.

SKIPPED  syntax-check     0.0 s   not run, an earlier stage failed
SKIPPED  molecule         0.0 s   not run, an earlier stage failed
SKIPPED  check-mode       0.0 s   not run, an earlier stage failed
SKIPPED  apply            0.0 s   not run, an earlier stage failed
SKIPPED  second-run       0.0 s   not run, an earlier stage failed

The pipeline failed. Fix the stage that failed, then run it again.
```

**Note:** The lint stage fails (exit code 1), and the five stages after it are skipped. Nothing touched the fleet.

## Step 7

**Command**

```sh
node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --inventory inventory/production.ini --only check-mode
```

**Output**

```text
FAILED   check-mode       2.0 s   check mode failed (exit code 2)

PLAY [Guard, stop unless this is the practice environment] *********************

TASK [Check the environment] ***************************************************
[ERROR]: Task failed: Action failed: Refusing to run. deploy_environment is 'production', not 'practice'.
Origin: /work/challenges/challenge-9-your-pipeline/part-1-stages-locally/guard.yml:16:7

14   run_once: true
15   tasks:
16     - name: Check the environment
         ^ column 7

fatal: [prod-web1]: FAILED! => {
    "assertion": "deploy_environment | default('not set') == 'practice'",
    "changed": false,
    "evaluated_to": false,
    "msg": "Refusing to run. deploy_environment is 'production', not 'practice'."
}

PLAY RECAP *********************************************************************
prod-web1                  : ok=0    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0


The pipeline failed. Fix the stage that failed, then run it again.
```

**Note:** The check-mode stage fails at the guard (exit code 1).

## Step 8

**Command**

```sh
docker exec anp-web1 cat /etc/banner.d/welcome.txt
```

**Output**

```text
Welcome to web1.
This server is managed by Ansible. Team: platform.
Changes made by hand will be overwritten.
```

**Note:** What the role wrote on web1. web2 has the same file with its own name.
