# Results: Challenge 6, part 2: hunt the leaks

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. All secrets are fake.. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-vault view --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/vars/secrets.yml
```

**Output**

```text
# FAKE value for the course. It is not a real secret.
db_password: demo-secret-not-real-0001
```

**Note:** The secret sits in the vault. Nobody can read vars/secrets.yml without the password. Now watch what the playbook does with it.

## Step 2

**Command**

```sh
git -C challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/scratch-repo log --oneline
```

**Output**

```text
a4b0eac Remove settings.env, use the vault
87c351e Add settings.env for the db
e4fd76c Add app.env
```

**Note:** The project has three commits. The last one deleted settings.env.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -v --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/leaky.yml
```

**Output**

```text
Using /work/ansible.cfg as config file

PLAY [Deploy the demo app] *****************************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Show the database password] **********************************************
ok: [web1] => {
    "db_password": "demo-secret-not-real-0001"
}
ok: [web2] => {
    "db_password": "demo-secret-not-real-0001"
}

TASK [Make the config folder] **************************************************
changed: [web1] => {"changed": true, "gid": 0, "group": "root", "mode": "0755", "owner": "root", "path": "/etc/demo-app", "size": 4096, "state": "directory", "uid": 0}
changed: [web2] => {"changed": true, "gid": 0, "group": "root", "mode": "0755", "owner": "root", "path": "/etc/demo-app", "size": 4096, "state": "directory", "uid": 0}

TASK [Write the app config] ****************************************************
changed: [web1] => {"changed": true, "checksum": "fee350587f65968cb7085859596110be4560aa87", "dest": "/etc/demo-app/app.conf", "gid": 0, "group": "root", "md5sum": "9fd34ce4338e7bb87eba35ae3f322eae", "mode": "0600", "owner": "root", "size": 50, "src": "/home/ansible/.ansible/tmp/ansible-tmp-1794169299.2323415-4429-58332593567300/.source.conf", "state": "file", "uid": 0}
changed: [web2] => {"changed": true, "checksum": "fee350587f65968cb7085859596110be4560aa87", "dest": "/etc/demo-app/app.conf", "gid": 0, "group": "root", "md5sum": "9fd34ce4338e7bb87eba35ae3f322eae", "mode": "0600", "owner": "root", "size": 50, "src": "/home/ansible/.ansible/tmp/ansible-tmp-1794169299.3166673-4432-206175936307684/.source.conf", "state": "file", "uid": 0}

TASK [Create the service accounts] *********************************************
changed: [web1] => (item={'name': 'reporting', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/reporting.pw", "gid": 0, "group": "root", "item": {"name": "reporting", "password": "demo-secret-not-real-0001"}, "md5sum": "8fafb58ec5c1bb2a9a770a34c2450166", "mode": "0600", "owner" ... [147 more characters left out]
changed: [web2] => (item={'name': 'reporting', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/reporting.pw", "gid": 0, "group": "root", "item": {"name": "reporting", "password": "demo-secret-not-real-0001"}, "md5sum": "8fafb58ec5c1bb2a9a770a34c2450166", "mode": "0600", "owner" ... [148 more characters left out]
changed: [web1] => (item={'name': 'backup', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/backup.pw", "gid": 0, "group": "root", "item": {"name": "backup", "password": "demo-secret-not-real-0001"}, "md5sum": "8fafb58ec5c1bb2a9a770a34c2450166", "mode": "0600", "owner": "root", ... [139 more characters left out]
changed: [web2] => (item={'name': 'backup', 'password': 'demo-secret-not-real-0001'}) => {"ansible_loop_var": "item", "changed": true, "checksum": "0a935728fff4fc2dde23bf9aba7ee4f50bf039b8", "dest": "/etc/demo-app/backup.pw", "gid": 0, "group": "root", "item": {"name": "backup", "password": "demo-secret-not-real-0001"}, "md5sum": "8fafb58ec5c1bb2a9a770a34c2450166", "mode": "0600", "owner": "root", ... [139 more characters left out]

TASK [Read the config back] ****************************************************
ok: [web1] => {"changed": false, "changed_when_result": false, "cmd": ["cat", "/etc/demo-app/app.conf"], "delta": "0:00:00.004679", "end": "2026-11-08 20:21:43.558879", "msg": "", "rc": 0, "start": "2026-11-08 20:21:43.554200", "stderr": "", "stderr_lines": [], "stdout": "DB_HOST=db1\nDB_PASSWORD=demo-secret-not-real-0001", "stdout_lines": ["DB_HOST=db1", "DB_PASSWORD=demo-secret-not-real-0001"]}
ok: [web2] => {"changed": false, "changed_when_result": false, "cmd": ["cat", "/etc/demo-app/app.conf"], "delta": "0:00:00.004295", "end": "2026-11-08 20:21:43.558495", "msg": "", "rc": 0, "start": "2026-11-08 20:21:43.554200", "stderr": "", "stderr_lines": [], "stdout": "DB_HOST=db1\nDB_PASSWORD=demo-secret-not-real-0001", "stdout_lines": ["DB_HOST=db1", "DB_PASSWORD=demo-secret-not-real-0001"]}

TASK [Start the report job] ****************************************************
changed: [web1] => {"ansible_job_id": "j333789981303.196", "changed": true, "changed_when_result": true, "finished": false, "results_file": "/root/.ansible_async/j333789981303.196", "started": true}
changed: [web2] => {"ansible_job_id": "j905479424741.196", "changed": true, "changed_when_result": true, "finished": false, "results_file": "/root/.ansible_async/j905479424741.196", "started": true}

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The run saved to leaky-output.txt. Look for demo-secret-not-real-0001 in it.

## Step 4

**Command**

```sh
docker exec anp-web1 ps -eo args  (only the lines that show the secret)
```

**Output**

```text
web1: /bin/sh -c sleep 120; echo run-report --password demo-secret-not-real-0001 > /dev/null
web2: /bin/sh -c sleep 120; echo run-report --password demo-secret-not-real-0001 > /dev/null
```

**Note:** A command line is public on the host. Any user on web1 can run ps and read it while the job runs.

## Step 5

**Command**

```sh
git -C challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/scratch-repo log --all -p | grep -n demo-secret-not-real-0001
```

**Output**

```text
22:-DB_PASSWORD=demo-secret-not-real-0001
38:+DB_PASSWORD=demo-secret-not-real-0001
```

**Note:** Git history shows the secret where it was added (+) and where it was removed (-). Deleting the file did not remove the secret from the old commit.

## Step 6

**Command**

```sh
node challenges/challenge-6-find-the-leak/scan.mjs challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/leaky-output.txt challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/scratch-repo
```

**Output**

```text
Searched for: demo-secret-not-real-0001
  2  debug task
  4  loop item
  2  registered result (-v)
  0  any other task
  2  process list on the targets
  0  files in the repository now
  2  lines in git history (log -p)
 12  TOTAL
```

**Note:** The scanner counts lines that show the secret, per place: 12 in all.
