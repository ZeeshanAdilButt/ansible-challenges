# Results: Challenge 10, part 2: break it

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the reference rollout.yml; the paths above show capstone-stack. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml
```

**Output**

```text
TASK [db : Install redis and its Python client] ********************************
changed: [db1]
TASK [db : Write the redis config] *********************************************
changed: [db1]
TASK [db : Redis is running and starts at boot] ********************************
changed: [db1]
... (24 lines left out) ...
RUNNING HANDLER [web : Reload nginx] *******************************************
changed: [web1]
PLAY RECAP *********************************************************************
db1                        : ok=7    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=4    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=9    changed=7    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The starting point: release 1 on all three hosts, in 32.7 s. The proxy answers 200.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/rollout.yml
```

**Output**

```text
TASK [web : Write the proxy config, and let nginx test it first] ***************
changed: [web1]
RUNNING HANDLER [web : Reload nginx] *******************************************
changed: [web1]
TASK [app : Write the app settings] ********************************************
changed: [web2]
RUNNING HANDLER [app : Restart the app] ****************************************
changed: [web2]
TASK [db : Write the redis config] *********************************************
changed: [db1]
RUNNING HANDLER [db : Apply the new redis settings] ****************************
changed: [db1]
PLAY RECAP *********************************************************************
db1                        : ok=8    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=10   changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Batch sizes: 1, 1, 1. 3 hosts changed, 0 failed. The proxy header says release 2, the app says 2.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/rollout.yml -e app_log_level=verbose
```

**Output**

```text
TASK [web : Write the proxy config, and let nginx test it first] ***************
changed: [web1]
RUNNING HANDLER [web : Reload nginx] *******************************************
changed: [web1]
TASK [app : Write the app settings] ********************************************
changed: [web2]
[ERROR]: Task failed: Module failed: capstone-app stopped right after it started. Last lines of /var/log/capstone-app/app.log:
RUNNING HANDLER [app : Restart the app] ****************************************
fatal: [web2]: FAILED! => {"changed": false, "msg": "capstone-app stopped right after it started. Last lines of /var/log/capstone-app/app.log:\n172.31.0.4 \"GET /health HTTP/1.0\" 200 -\n172.31.0.4 \"GET /health HTTP/1.0\" 200 -\ncapstone-app: unknown log_level 'verbose', use one of: debug, info, warning, error\n"}
PLAY RECAP *********************************************************************
web1                       : ok=7    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=8    changed=1    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0
```

**Note:** Failed: web2 (task: app : Restart the app). Changed before the stop: web1. Never touched: db1.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible web -i challenges/challenge-10-capstone/capstone-stack/inventory.ini -m ansible.builtin.uri -a 'url=http://localhost/health status_code=200,502,503'
```

**Output**

```text
web1 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python3.11"
    },
    "body": "<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>nginx/1.22.1</center>\r\n</body>\r\n</html>\r\n",
    "changed": false,
    "connection": "close",
    "content_length": "157",
    "content_type": "text/html",
    "date": "Sun, 08 Nov 2026 19:23:49 GMT",
    "elapsed": 0,
    "msg": "HTTP Error 502: Bad Gateway",
    "redirected": false,
    "server": "nginx/1.22.1",
    "status": 502,
    "url": "http://localhost/health",
    "x_capstone_release": "2"
}
```

**Note:** The site is down for customers: the proxy answers 502 because the app behind it is gone. The proxy host has release 2.

## Step 5

**Command**

```sh
seven drills: the same bad setting (-e app_log_level=verbose) with a different play header each time
```

**Output**

```text
no serial: every host at once            changed 2  failed 1  never reached 0
serial: 1 and nothing else               changed 1  failed 1  never reached 1 (db1)
serial: 1 and max_fail_percentage: 25    changed 1  failed 1  never reached 1 (db1)
serial: 1 and any_errors_fatal: true     changed 1  failed 1  never reached 1 (db1)
serial: 2 and nothing else               changed 2  failed 1  never reached 0
serial: 2 and max_fail_percentage: 25    changed 1  failed 1  never reached 1 (db1)
serial: 2 and any_errors_fatal: true     changed 1  failed 1  never reached 1 (db1)
```

**Note:** Read the last column. With batches of one, a failed host is a failed batch and the play ends. With batches of two, a failed host is dropped and the next batch still runs, unless a stop keyword says otherwise.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook -i challenges/challenge-10-capstone/capstone-stack/inventory.ini challenges/challenge-10-capstone/capstone-stack/site.yml
```

**Output**

```text
TASK [app : Write the app settings] ********************************************
changed: [web2]
TASK [app : The app is running and starts at boot] *****************************
changed: [web2]
RUNNING HANDLER [app : Restart the app] ****************************************
... (4 lines left out) ...
changed: [web1]
PLAY RECAP *********************************************************************
db1                        : ok=6    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web1                       : ok=6    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=9    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Release 1 is back and the proxy answers 200. The fleet is left in this state.
