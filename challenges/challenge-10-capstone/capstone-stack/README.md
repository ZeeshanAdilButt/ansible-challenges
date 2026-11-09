# The capstone fleet: the brief

You are the person who has to run this system. It has three hosts. A customer talks to the first, the first talks to the second, the second talks to the third. You write the Ansible that builds it, rolls a change across it, and brings it back when the change goes wrong.

```text
customer --> web1 (nginx, port 80) --> web2 (the app, port 8080) --> db1 (redis, port 6379, with a password)
             group web                 group app                      group db
```

The file [inventory.ini](inventory.ini) names the hosts and the three groups. Each group has a role with the same name: `roles/web`, `roles/app`, `roles/db`. [site.yml](site.yml) applies them in the order the pieces need each other: database, app, proxy.

## What you write, and what is given

| Given | You write |
|---|---|
| `inventory.ini`, `site.yml`, `ci.mjs`, `vault-pass.sh`, `.ansible-lint` | `roles/web/tasks/main.yml`, `roles/web/handlers/main.yml`, `roles/web/templates/nginx.conf.j2` |
| `group_vars/all/vars.yml` (every setting and its name), `vars/release-2.yml`, `tasks/release.yml` | `roles/app/tasks/main.yml`, `roles/app/handlers/main.yml` |
| In each role: `meta/main.yml`, `defaults/main.yml`. In `roles/app/templates`: the app (`app.py.j2`), its settings file (`app.conf.j2`) and its init script (`capstone-app.init.j2`) | `roles/db/tasks/main.yml`, `roles/db/handlers/main.yml`, `roles/db/templates/redis.conf.j2` |
| The starter of `RUNBOOK.md` and `DEFENCE.md` | `requirements.yml` (the pin), `group_vars/all/vault.yml` (the secret), `rollout.yml` (part 2), `recover.yml` (part 3), `RUNBOOK.md` (part 3), `DEFENCE.md` (part 4) |

Every file you must write has `TODO` comments that say what it needs. Read them in order.

## What each role must do

**db** (redis 7, from apt)

1. Install `redis-server` and `python3-redis` (the module that talks to redis needs it).
2. Write `/etc/redis/redis.conf` from `redis.conf.j2`: owner `root`, group `redis`, mode `0640`. It needs these lines: `daemonize yes`, `pidfile /run/redis/redis-server.pid`, `logfile /var/log/redis/redis-server.log`, `dir /var/lib/redis`, `bind 0.0.0.0`, `port {{ db_port }}`, `requirepass {{ db_password }}`, `maxmemory {{ db_maxmemory_mb }}mb`, `maxmemory-policy allkeys-lru`, `save ""`, `appendonly no`.
3. The service `redis-server` is running and enabled.
4. A change to the config must reach the running redis. **Do not use `state: restarted` for redis here.** In these containers `service redis-server restart` cannot stop redis: the init script finds the process with `start-stop-daemon --exec`, which needs to read `/proc/<pid>/exe`, and root in a container without extra capabilities cannot read it for a process of another user. The restart "works" and nothing changes. Use the module `community.general.redis` with `command: config` to set `maxmemory` while redis runs. The file keeps it for the next start.
5. A check: ask the running redis for its settings (`community.general.redis_info`) and assert that `maxmemory` is `db_maxmemory_mb` MB in bytes. A value given with `-e` on the command line is text, so write `db_maxmemory_mb | int` before you multiply it.

**app** (the Python service, rendered from templates)

1. A system user `capstone` (`app_user`) with the shell `/usr/sbin/nologin` and no home.
2. Three folders: `/opt/capstone-app` (owner root), `/etc/capstone-app` (owner root, group `capstone`, mode `0750`), `/var/log/capstone-app` (owner `capstone`, mode `0750`).
3. Three files from the given templates: `app.py` (mode `0644`), `app.conf` (owner root, group `capstone`, mode `0640`; it holds the database password), and the init script `/etc/init.d/capstone-app` (mode `0755`).
4. The service `capstone-app` is running and enabled. A change to `app.py` or `app.conf` restarts it (handler `Restart the app`).
5. A check: `GET http://127.0.0.1:8080/health` answers 200 (the `uri` module, up to 8 tries, 1 second apart).

**web** (nginx, from apt)

1. Install `nginx`.
2. Write `/etc/nginx/nginx.conf` from `nginx.conf.j2`. The template needs `worker_connections {{ web_worker_connections }};`, a `server` that listens on `{{ web_port }}`, the header `X-Capstone-Release` with the release, and `proxy_pass http://{{ app_host }}:{{ app_port }};`. Let nginx test the file before it is used: `validate: nginx -t -c %s`.
3. The service `nginx` is running and enabled. A config change reloads it (handler `Reload nginx`).
4. A check: `GET http://127.0.0.1:80/health` answers 200. That one request goes through all three hosts.

Names: use the module names in full (`ansible.builtin.apt`, not `apt`). Start every task name with a capital letter. A check never changes anything, so it must not report `changed`.

**The containers have no systemd.** `service` works through init scripts. That is why the app has an init script and not a unit file. On a real server you would write a unit file, and the `service` task would stay the same.

## The secret

The database password is not in any file you commit. It is in an encrypted vault. Three commands make it, from the root folder of your repository:

```text
# 1. The vault password: one line, in a file that git ignores. Make up your own.
echo "pick-a-long-password" > challenges/challenge-10-capstone/capstone-stack/.vault-pass

# 2. The database password, in a plain file for a moment. It is a made-up value for this practice.
echo "vault_db_password: a-made-up-database-password" > challenges/challenge-10-capstone/capstone-stack/group_vars/all/vault.yml

# 3. Encrypt it. After this the file starts with $ANSIBLE_VAULT.
node toolkit/ansible.mjs ansible-vault encrypt challenges/challenge-10-capstone/capstone-stack/group_vars/all/vault.yml --vault-password-file challenges/challenge-10-capstone/capstone-stack/vault-pass.sh
```

`group_vars/all/vars.yml` already says `db_password: "{{ vault_db_password }}"`, so the roles read `db_password`.

Why `vault-pass.sh` and not the file itself? On Docker Desktop for Windows every file in a shared folder looks executable, and Ansible then tries to run a vault password file as a program and fails with `Exec format error`. `vault-pass.sh` is a program on purpose: it prints the file. `ci.mjs` sets `ANSIBLE_VAULT_PASSWORD_FILE` for you. For a command you type yourself, add `--vault-password-file challenges/challenge-10-capstone/capstone-stack/vault-pass.sh`.

Two places show a password by mistake. A template task with `--diff` prints the file's text, so a template that holds the password needs `diff: false`. A task that is given the password (for example to log in to redis) should have `no_log: true`, so that its result is never printed. The pipeline searches everything it printed for the password.

## The pin

`requirements.yml` lists the collection the roles use, `community.general`. Pin it to the exact version `13.0.0`: `version: "13.0.0"`. A range (`>=13`) or no version means a different collection next month. `ci.mjs` installs the collection in its first stage. The collection goes in the control container (`/home/learner/.ansible/collections`), not in your repository: on Docker Desktop for Windows, unpacking one collection into a shared folder takes more than an hour.

## Run it

```text
node toolkit/fleet.mjs up
node challenges/challenge-10-capstone/capstone-stack/ci.mjs
```

`ci.mjs` runs seven stages and stops at the first one that fails: `deps` (install the pinned collection), `lint` (ansible-lint, profile `production`), `syntax`, `apply` (site.yml with `--diff`), `idempotence` (site.yml again: it must say `changed=0`), `check` (check mode: nothing would change) and `health` (the proxy answers 200).

Why is check mode after `apply`? On a new fleet it fails on the first task that needs something that is not there yet (for example the redis service before redis is installed). It is a check for a fleet that already exists: "has anything drifted?".

Then follow the four parts in [the challenge README](../README.md).
