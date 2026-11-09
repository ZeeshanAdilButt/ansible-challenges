# Results: Challenge 7, part 3: break idempotence

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used reference/main.yml. Date: 2026-11-08.

## Step 1

**Command**

```sh
tail -n 4 challenges/challenge-7-test-your-role/part-3-break-idempotence/scratch/broken/webserver/tasks/main.yml
```

**Output**

```text

- name: Check the nginx config
  ansible.builtin.command: nginx -t
```

**Note:** The new task runs nginx -t to check the config. It only reads, but the command module reports changed on every run.

## Step 2

**Command**

```sh
node toolkit/molecule.mjs run 7 challenges/challenge-7-test-your-role/part-3-break-idempotence/scratch/broken/webserver molecule test
```

**Output**

```text
INFO     [default > discovery] scenario test matrix: dependency, cleanup, destroy, syntax, create, prepare, converge, idempotence, side_effect, verify, cleanup, destroy
INFO     [default > prerun] Performing prerun with role_name_check=0...
INFO     [default > dependency] Executing
WARNING  [default > dependency] Missing roles requirements file: requirements.yml
WARNING  [default > dependency] Missing collections requirements file: collections.yml
WARNING  [default > dependency] Executed: 2 missing (Remove from test_sequence to suppress)
INFO     [default > cleanup] Executing
WARNING  [default > cleanup] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > destroy] Executing
INFO     Sanity checks: 'docker'

PLAY [Destroy] *****************************************************************

TASK [Set async_dir for HOME env] **********************************************
ok: [localhost]

TASK [Destroy molecule instance(s)] ********************************************
changed: [localhost] => (item=anp-c7-instance)

TASK [Wait for instance(s) deletion to complete] *******************************
FAILED - RETRYING: [localhost]: Wait for instance(s) deletion to complete (299 retries left).
ok: [localhost] => (item=anp-c7-instance)

TASK [Delete docker networks(s)] ***********************************************
skipping: [localhost]

PLAY RECAP *********************************************************************
localhost                  : ok=3    changed=1    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0

INFO     [default > destroy] Executed: Successful
INFO     [default > syntax] Executing

playbook: /work/challenges/challenge-7-test-your-role/part-3-break-idempotence/scratch/broken/webserver/molecule/default/converge.yml
INFO     [default > syntax] Executed: Successful
INFO     [default > create] Executing

PLAY [Create] ******************************************************************

TASK [Set async_dir for HOME env] **********************************************
ok: [localhost]

TASK [Log into a Docker registry] **********************************************
skipping: [localhost] => (item=(censored due to no_log))
skipping: [localhost]

TASK [Check presence of custom Dockerfiles] ************************************
ok: [localhost] => (item=anp-c7-instance)

TASK [Create Dockerfiles from image names] *************************************
skipping: [localhost] => (item=None)
skipping: [localhost]

TASK [Synchronization the context] *********************************************
skipping: [localhost] => (item=None)
skipping: [localhost]

TASK [Discover local Docker images] ********************************************
ok: [localhost] => (item=unix://var/run/docker.sock)

TASK [Create docker network(s)] ************************************************
skipping: [localhost]

TASK [Build an Ansible compatible image (new)] *********************************
skipping: [localhost] => (item=molecule_local/python:3.12-slim-bookworm)
skipping: [localhost]

TASK [Determine the CMD directives] ********************************************
ok: [localhost] => (item=anp-c7-instance)

TASK [Create molecule instance(s)] *********************************************
changed: [localhost] => (item=anp-c7-instance)

TASK [Wait for instance(s) creation to complete] *******************************
FAILED - RETRYING: [localhost]: Wait for instance(s) creation to complete (299 retries left).
changed: [localhost] => (item=anp-c7-instance)

PLAY RECAP *********************************************************************
localhost                  : ok=6    changed=2    unreachable=0    failed=0    skipped=5    rescued=0    ignored=0

INFO     [default > create] Executed: Successful
INFO     [default > prepare] Executing
WARNING  [default > prepare] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > converge] Executing

PLAY [Converge] ****************************************************************

TASK [Gathering Facts] *********************************************************
ok: [anp-c7-instance]

TASK [Run the role] ************************************************************
included: acme.webserver for anp-c7-instance

TASK [acme.webserver : Install nginx] ******************************************
changed: [anp-c7-instance]

TASK [acme.webserver : Write the site config] **********************************
changed: [anp-c7-instance]

TASK [acme.webserver : Write the home page] ************************************
changed: [anp-c7-instance]

TASK [acme.webserver : Make sure nginx is running] *****************************
changed: [anp-c7-instance]

TASK [acme.webserver : Check the nginx config] *********************************
changed: [anp-c7-instance]

RUNNING HANDLER [acme.webserver : Reload nginx] ********************************
changed: [anp-c7-instance]

PLAY RECAP *********************************************************************
anp-c7-instance            : ok=8    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0

INFO     [default > converge] Executed: Successful
INFO     [default > idempotence] Executing

PLAY [Converge] ****************************************************************

TASK [Gathering Facts] *********************************************************
ok: [anp-c7-instance]

TASK [Run the role] ************************************************************
included: acme.webserver for anp-c7-instance

TASK [acme.webserver : Install nginx] ******************************************
ok: [anp-c7-instance]

TASK [acme.webserver : Write the site config] **********************************
ok: [anp-c7-instance]

TASK [acme.webserver : Write the home page] ************************************
ok: [anp-c7-instance]

TASK [acme.webserver : Make sure nginx is running] *****************************
ok: [anp-c7-instance]

TASK [acme.webserver : Check the nginx config] *********************************
changed: [anp-c7-instance]

PLAY RECAP *********************************************************************
anp-c7-instance            : ok=7    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0

CRITICAL Idempotence test failed because of the following tasks:
*  => acme.webserver : Check the nginx config
ERROR    [default > idempotence] [31mExecuted: Failed[0m
WARNING  [default > idempotence] An error occurred during the test sequence action: 'idempotence'. Cleaning up.
INFO     [default > cleanup] Executing
WARNING  [default > cleanup] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > destroy] Executing

PLAY [Destroy] *****************************************************************

TASK [Set async_dir for HOME env] **********************************************
ok: [localhost]

TASK [Destroy molecule instance(s)] ********************************************
changed: [localhost] => (item=anp-c7-instance)

TASK [Wait for instance(s) deletion to complete] *******************************
FAILED - RETRYING: [localhost]: Wait for instance(s) deletion to complete (299 retries left).
changed: [localhost] => (item=anp-c7-instance)

TASK [Delete docker networks(s)] ***********************************************
skipping: [localhost]

PLAY RECAP *********************************************************************
localhost                  : ok=3    changed=2    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0

INFO     [default > destroy] Executed: Successful
INFO     [default > scenario] Pruning extra files from scenario ephemeral directory
ERROR    Idempotence test failed because of the following tasks:
*  => acme.webserver : Check the nginx config
WARNING  Molecule executed 1 scenario (1 missing files)

DETAILS                                                                        
default > dependency: Executed: 2 missing (Remove from test_sequence to suppress)
default > cleanup: Executed: Missing playbook (Remove from test_sequence to suppress)
default > destroy: Executed: Successful
default > syntax: Executed: Successful
default > create: Executed: Successful
default > prepare: Executed: Missing playbook (Remove from test_sequence to suppress)
default > converge: Executed: Successful
default > idempotence: Executed: Successful
default > cleanup: Executed: Missing playbook (Remove from test_sequence to suppress)
default > destroy: Executed: Successful

SCENARIO RECAP                                                                 
default                   : actions=10  successful=6  disabled=0  skipped=0  missing=5  failed=0
```

**Note:** Exit code 1. The idempotence step failed. It names 1 task: *  => acme.webserver : Check the nginx config. The verify step never ran. Molecule still destroyed the test machine. The recap at the end says failed=0, although the exit code is not 0 (see NOTES.md). This run took 99.9 s.

## Step 3

**Command**

```sh
node toolkit/molecule.mjs run 7 challenges/challenge-7-test-your-role/part-3-break-idempotence/roles/webserver molecule test
```

**Output**

```text
INFO     [default > discovery] scenario test matrix: dependency, cleanup, destroy, syntax, create, prepare, converge, idempotence, side_effect, verify, cleanup, destroy
INFO     [default > prerun] Performing prerun with role_name_check=0...
INFO     [default > dependency] Executing
WARNING  [default > dependency] Missing roles requirements file: requirements.yml
WARNING  [default > dependency] Missing collections requirements file: collections.yml
WARNING  [default > dependency] Executed: 2 missing (Remove from test_sequence to suppress)
INFO     [default > cleanup] Executing
WARNING  [default > cleanup] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > destroy] Executing
INFO     Sanity checks: 'docker'

PLAY [Destroy] *****************************************************************

TASK [Set async_dir for HOME env] **********************************************
ok: [localhost]

TASK [Destroy molecule instance(s)] ********************************************
changed: [localhost] => (item=anp-c7-instance)

TASK [Wait for instance(s) deletion to complete] *******************************
FAILED - RETRYING: [localhost]: Wait for instance(s) deletion to complete (299 retries left).
ok: [localhost] => (item=anp-c7-instance)

TASK [Delete docker networks(s)] ***********************************************
skipping: [localhost]

PLAY RECAP *********************************************************************
localhost                  : ok=3    changed=1    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0

INFO     [default > destroy] Executed: Successful
INFO     [default > syntax] Executing

playbook: /work/challenges/challenge-7-test-your-role/part-3-break-idempotence/roles/webserver/molecule/default/converge.yml
INFO     [default > syntax] Executed: Successful
INFO     [default > create] Executing

PLAY [Create] ******************************************************************

TASK [Set async_dir for HOME env] **********************************************
ok: [localhost]

TASK [Log into a Docker registry] **********************************************
skipping: [localhost] => (item=(censored due to no_log))
skipping: [localhost]

TASK [Check presence of custom Dockerfiles] ************************************
ok: [localhost] => (item=anp-c7-instance)

TASK [Create Dockerfiles from image names] *************************************
skipping: [localhost] => (item=None)
skipping: [localhost]

TASK [Synchronization the context] *********************************************
skipping: [localhost] => (item=None)
skipping: [localhost]

TASK [Discover local Docker images] ********************************************
ok: [localhost] => (item=unix://var/run/docker.sock)

TASK [Create docker network(s)] ************************************************
skipping: [localhost]

TASK [Build an Ansible compatible image (new)] *********************************
skipping: [localhost] => (item=molecule_local/python:3.12-slim-bookworm)
skipping: [localhost]

TASK [Determine the CMD directives] ********************************************
ok: [localhost] => (item=anp-c7-instance)

TASK [Create molecule instance(s)] *********************************************
changed: [localhost] => (item=anp-c7-instance)

TASK [Wait for instance(s) creation to complete] *******************************
FAILED - RETRYING: [localhost]: Wait for instance(s) creation to complete (299 retries left).
changed: [localhost] => (item=anp-c7-instance)

PLAY RECAP *********************************************************************
localhost                  : ok=6    changed=2    unreachable=0    failed=0    skipped=5    rescued=0    ignored=0

INFO     [default > create] Executed: Successful
INFO     [default > prepare] Executing
WARNING  [default > prepare] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > converge] Executing

PLAY [Converge] ****************************************************************

TASK [Gathering Facts] *********************************************************
ok: [anp-c7-instance]

TASK [Run the role] ************************************************************
included: acme.webserver for anp-c7-instance

TASK [acme.webserver : Install nginx] ******************************************
changed: [anp-c7-instance]

TASK [acme.webserver : Write the site config] **********************************
changed: [anp-c7-instance]

TASK [acme.webserver : Write the home page] ************************************
changed: [anp-c7-instance]

TASK [acme.webserver : Make sure nginx is running] *****************************
changed: [anp-c7-instance]

TASK [acme.webserver : Check the nginx config] *********************************
ok: [anp-c7-instance]

RUNNING HANDLER [acme.webserver : Reload nginx] ********************************
changed: [anp-c7-instance]

PLAY RECAP *********************************************************************
anp-c7-instance            : ok=8    changed=5    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0

INFO     [default > converge] Executed: Successful
INFO     [default > idempotence] Executing

PLAY [Converge] ****************************************************************

TASK [Gathering Facts] *********************************************************
ok: [anp-c7-instance]

TASK [Run the role] ************************************************************
included: acme.webserver for anp-c7-instance

TASK [acme.webserver : Install nginx] ******************************************
ok: [anp-c7-instance]

TASK [acme.webserver : Write the site config] **********************************
ok: [anp-c7-instance]

TASK [acme.webserver : Write the home page] ************************************
ok: [anp-c7-instance]

TASK [acme.webserver : Make sure nginx is running] *****************************
ok: [anp-c7-instance]

TASK [acme.webserver : Check the nginx config] *********************************
ok: [anp-c7-instance]

PLAY RECAP *********************************************************************
anp-c7-instance            : ok=7    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0

INFO     [default > idempotence] Executed: Successful
INFO     [default > side_effect] Executing
WARNING  [default > side_effect] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > verify] Executing

PLAY [Verify] ******************************************************************

TASK [Collect the installed packages] ******************************************
ok: [anp-c7-instance]

TASK [Assert that nginx is installed] ******************************************
ok: [anp-c7-instance] => {
    "changed": false,
    "msg": "nginx is installed"
}

TASK [Read the site config] ****************************************************
ok: [anp-c7-instance]

TASK [Assert that the config listens on port 8080] *****************************
ok: [anp-c7-instance] => {
    "changed": false,
    "msg": "the config listens on 8080"
}

TASK [Ask the web server for the home page] ************************************
ok: [anp-c7-instance]

TASK [Assert that the page answers 200 and says hello] *************************
ok: [anp-c7-instance] => {
    "changed": false,
    "msg": "the page answers 200 and says hello"
}

PLAY RECAP *********************************************************************
anp-c7-instance            : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0

INFO     [default > verify] Executed: Successful
INFO     [default > cleanup] Executing
WARNING  [default > cleanup] Executed: Missing playbook (Remove from test_sequence to suppress)
INFO     [default > destroy] Executing

PLAY [Destroy] *****************************************************************

TASK [Set async_dir for HOME env] **********************************************
ok: [localhost]

TASK [Destroy molecule instance(s)] ********************************************
changed: [localhost] => (item=anp-c7-instance)

TASK [Wait for instance(s) deletion to complete] *******************************
FAILED - RETRYING: [localhost]: Wait for instance(s) deletion to complete (299 retries left).
changed: [localhost] => (item=anp-c7-instance)

TASK [Delete docker networks(s)] ***********************************************
skipping: [localhost]

PLAY RECAP *********************************************************************
localhost                  : ok=3    changed=2    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0

INFO     [default > destroy] Executed: Successful
INFO     [default > scenario] Pruning extra files from scenario ephemeral directory
WARNING  Molecule executed 1 scenario (1 missing files)

DETAILS                                                                        
default > dependency: Executed: 2 missing (Remove from test_sequence to suppress)
default > cleanup: Executed: Missing playbook (Remove from test_sequence to suppress)
default > destroy: Executed: Successful
default > syntax: Executed: Successful
default > create: Executed: Successful
default > prepare: Executed: Missing playbook (Remove from test_sequence to suppress)
default > converge: Executed: Successful
default > idempotence: Executed: Successful
default > side_effect: Executed: Missing playbook (Remove from test_sequence to suppress)
default > verify: Executed: Successful
default > cleanup: Executed: Missing playbook (Remove from test_sequence to suppress)
default > destroy: Executed: Successful

SCENARIO RECAP                                                                 
default                   : actions=12  successful=7  disabled=0  skipped=0  missing=6  failed=0
```

**Note:** Exit code 0. With changed_when: false the idempotence step passes (0 failing tasks) and verify runs. This run took 118.4 s.
