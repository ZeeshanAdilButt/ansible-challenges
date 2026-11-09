# Results: Challenge 10, part 1: configure the fleet

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the reference roles; the paths above show capstone-stack. Date: 2026-11-08.

## Step 1

**Command**

```sh
node challenges/challenge-10-capstone/capstone-stack/ci.mjs
```

**Output**

```text
ok       deps            0.9 s  already installed: community.general 13.0.0
ok       lint           38.9 s  Passed: 0 failure(s), 0 warning(s) in 29 files processed of 36 encountered. Profile 'production' was required, and it passed.
ok       syntax          4.7 s  site.yml, rollout.yml, recover.yml
ok       apply          34.9 s  changed 14 task(s) on 3 hosts
ok       idempotence    15.5 s  changed=0 on every host
ok       check          16.9 s  no drift: nothing would change
ok       health          0.3 s  200, release 1, app web2, db ok

All stages passed.
```

**Note:** Seven stages, in order. The first one that fails stops the run, so the first red stage is the one to fix.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml   (the apply stage, first run)
```

**Output**

```text
TASK [db : Install redis and its Python client] ********************************
changed: [db1]
TASK [db : Write the redis config] *********************************************
changed: [db1]
TASK [db : Redis is running and starts at boot] ********************************
changed: [db1]
TASK [app : The app has its own unprivileged user] *****************************
changed: [web2]
TASK [app : The app has its folders] *******************************************
changed: [web2] => (item=/opt/capstone-app)
TASK [app : The app has its folders] *******************************************
changed: [web2] => (item=/etc/capstone-app)
TASK [app : The app has its folders] *******************************************
changed: [web2] => (item=/var/log/capstone-app)
TASK [app : Install the app code] **********************************************
changed: [web2]
TASK [app : Write the app settings] ********************************************
changed: [web2]
TASK [app : Install the init script] *******************************************
changed: [web2]
TASK [app : The app is running and starts at boot] *****************************
changed: [web2]
RUNNING HANDLER [app : Restart the app] ****************************************
changed: [web2]
TASK [web : Install nginx] *****************************************************
changed: [web1]
TASK [web : Write the proxy config, and let nginx test it first] ***************
changed: [web1]
TASK [web : The nginx service is running and starts at boot] *******************
changed: [web1]
RUNNING HANDLER [web : Reload nginx] *******************************************
changed: [web1]
PLAY RECAP *********************************************************************
db1                        : ok=7    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=9    changed=7    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The first run changed 14 tasks on 3 hosts. Handlers ran once each.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml   (the idempotence stage, second run)
```

**Output**

```text
PLAY RECAP *********************************************************************
db1                        : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=8    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The second run changed nothing: changed=0 on every host. That is idempotence.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible web -i challenges/challenge-10-capstone/capstone-stack/inventory.ini -m ansible.builtin.uri -a 'url=http://localhost/health return_content=true'
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "changed": false,
    "connection": "close",
    "content": "{\"status\": \"ok\", \"release\": \"1\", \"host\": \"web2\", \"db\": \"ok\"}",
    "content_length": "60",
    "content_type": "application/json",
    "cookies": {},
    "cookies_string": "",
    "date": "Sun, 08 Nov 2026 20:01:27 GMT",
    "elapsed": 0,
    "json": {
        "db": "ok",
        "host": "web2",
        "release": "1",
        "status": "ok"
    },
    "msg": "OK (60 bytes)",
    "redirected": false,
    "server": "nginx/1.22.1",
    "status": 200,
    "url": "http://localhost/health",
    "x_capstone_release": "1"
}
```

**Note:** The request goes to nginx on web1. nginx asks the app on web2. The app logs in to redis on db1 and sends PING. Answer: status 200, db ok.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible db -i challenges/challenge-10-capstone/capstone-stack/inventory.ini -m ansible.builtin.command -a 'redis-cli -h 127.0.0.1 ping'
```

**Output**

```text
db1 | CHANGED | rc=0 >>
NOAUTH Authentication required.
```

**Note:** redis refuses a PING without the password (NOAUTH). The password from the vault is in force.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible app -i challenges/challenge-10-capstone/capstone-stack/inventory.ini -m ansible.builtin.command -a 'ps -o user=,args= -C python3'
```

**Output**

```text
web2 | CHANGED | rc=0 >>
capstone /usr/bin/python3 /opt/capstone-app/app.py
```

**Note:** The app runs as "capstone".

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml --diff -e db_maxmemory_mb=80 -e app_log_level=debug
```

**Output**

```text
PLAY RECAP *********************************************************************
db1                        : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=9    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Two settings changed on purpose (4 tasks). --diff printed 0 lines of file text. The last step below searches them for the password.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml
```

**Output**

```text
TASK [db : Write the redis config] *********************************************
changed: [db1]
RUNNING HANDLER [db : Apply the new redis settings] ****************************
changed: [db1]
TASK [app : Write the app settings] ********************************************
changed: [web2]
RUNNING HANDLER [app : Restart the app] ****************************************
changed: [web2]
PLAY RECAP *********************************************************************
db1                        : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=5    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=9    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The two settings are back to release 1 (4 tasks changed). The fleet is in the state the next parts expect.

## Step 9

**Command**

```sh
read the vault file, search every file of the stack and everything the pipeline printed for the secret
```

**Output**

```text
vault file encrypted:                true
secret values in the vault:          1
times a secret appears in a file:    0
times a secret appears in the output: 0
.vault-pass is git-ignored:          true
requirements.yml pins exactly:       true (1 collection)
roles that call a module from it:    2 place(s)
```

**Note:** The secret is only in the encrypted file. The pipeline output, including the --diff run, never shows it.
