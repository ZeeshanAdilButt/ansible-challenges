# Results: Challenge 5, part 3: the playbook and the role give the same result

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
ok: [web2]
ok: [web1]

TASK [Install nginx] ***********************************************************
changed: [web1]
changed: [web2]

TASK [Make the web root] *******************************************************
changed: [web1]
changed: [web2]

TASK [Write the index page] ****************************************************
changed: [web2]
changed: [web1]

TASK [Write the nginx site config] *********************************************
changed: [web1]
changed: [web2]

TASK [Start nginx] *************************************************************
changed: [web2]
changed: [web1]

RUNNING HANDLER [Reload nginx] *************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 12.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible web -m command -a 'sha256sum /etc/nginx/conf.d/site.conf /var/www/site/index.html'
```

**Output**

```text
web2 | CHANGED | rc=0 >>
1535a7dc415f831fbf5ca1f354d9412833254c489e7624a680f47976a7ad0590  /etc/nginx/conf.d/site.conf
1e45bd743161c8f3171d6ca9e4a869138cc1023eb9359a60c7246a892e112355  /var/www/site/index.html
web1 | CHANGED | rc=0 >>
dd7434f90006ad847b8f37f0bfaa5788fd30241a04bc4039e5fffe52b91d1212  /etc/nginx/conf.d/site.conf
290e5317e74329c1db67caa9e2e67bc0094d5c3d4054cd097eadffa8dec33063  /var/www/site/index.html
```

**Note:** The fingerprint (sha256) of each file the playbook wrote.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/before.yml
```

**Output**

```text

PLAY [Web servers with nginx] **************************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Install nginx] ***********************************************************
ok: [web2]
ok: [web1]

TASK [Make the web root] *******************************************************
ok: [web2]
ok: [web1]

TASK [Write the index page] ****************************************************
ok: [web1]
ok: [web2]

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

**Note:** Changed 0 on the second run.

## Step 4

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
changed: [web2]
changed: [web1]

TASK [webserver : Make the web root] *******************************************
changed: [web1]
changed: [web2]

TASK [webserver : Write the index page] ****************************************
changed: [web1]
changed: [web2]

TASK [webserver : Write the nginx site config] *********************************
changed: [web2]
changed: [web1]

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

**Note:** Changed 12.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible web -m command -a 'sha256sum /etc/nginx/conf.d/site.conf /var/www/site/index.html'
```

**Output**

```text
web2 | CHANGED | rc=0 >>
1535a7dc415f831fbf5ca1f354d9412833254c489e7624a680f47976a7ad0590  /etc/nginx/conf.d/site.conf
1e45bd743161c8f3171d6ca9e4a869138cc1023eb9359a60c7246a892e112355  /var/www/site/index.html
web1 | CHANGED | rc=0 >>
dd7434f90006ad847b8f37f0bfaa5788fd30241a04bc4039e5fffe52b91d1212  /etc/nginx/conf.d/site.conf
290e5317e74329c1db67caa9e2e67bc0094d5c3d4054cd097eadffa8dec33063  /var/www/site/index.html
```

**Note:** The same fingerprints, from the role.

## Step 6

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
ok: [web2]
ok: [web1]

TASK [webserver : Make the web root] *******************************************
ok: [web2]
ok: [web1]

TASK [webserver : Write the index page] ****************************************
ok: [web1]
ok: [web2]

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

**Note:** Changed 0 on the second run.

## Step 7

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
changed: [web2]
changed: [web1]

TASK [webserver : Make the web root] *******************************************
changed: [web1]
changed: [web2]

TASK [webserver : Write the index page] ****************************************
changed: [web2]
changed: [web1]

TASK [webserver : Write the nginx site config] *********************************
changed: [web1]
changed: [web2]

TASK [webserver : Start nginx] *************************************************
changed: [web1]
changed: [web2]

RUNNING HANDLER [webserver : Reload nginx] *************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=7    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Changed 12. This run has a different port on purpose.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible web -m command -a 'sha256sum /etc/nginx/conf.d/site.conf /var/www/site/index.html'
```

**Output**

```text
web1 | CHANGED | rc=0 >>
c1c6c9d543905d7b7e5745d795e4eefa1bd85998886d5158ac4e41c6070fa0bc  /etc/nginx/conf.d/site.conf
290e5317e74329c1db67caa9e2e67bc0094d5c3d4054cd097eadffa8dec33063  /var/www/site/index.html
web2 | CHANGED | rc=0 >>
dc9f96c9fe8c4e1a337765b3cc217d8b247a6814a327615544a31cdac14321ef  /etc/nginx/conf.d/site.conf
1e45bd743161c8f3171d6ca9e4a869138cc1023eb9359a60c7246a892e112355  /var/www/site/index.html
```

**Note:** The config file has a different fingerprint now. The index page does not.
