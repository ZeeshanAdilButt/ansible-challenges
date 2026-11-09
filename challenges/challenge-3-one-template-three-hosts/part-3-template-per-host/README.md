# Challenge 3, part 3: one template, three hosts

**Time:** about 45 minutes. **Download:** nothing. No package is installed and no image is pulled. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Your three servers each need a config file. The files are almost the same, but not quite: each one has its own name, the web servers listen on one port, `web2` on another, the database on a third, and the web servers must list their peers while the database must not. You could keep three files. Then you change one thing, and you must change it in three places, and sooner or later you forget one.

You want one file that says all of this once, and three results that are right.

## The idea

A **template** is a text file with holes in it. Ansible fills the holes separately for each host, then copies the result to that host. The `template` module does this. The language of the holes is **Jinja2**:

- `{{ app_port }}` is a hole for a value. It is replaced by the value of the variable for this host.
- `{% if ... %} ... {% else %} ... {% endif %}` is a condition. The lines inside are used only when the condition is true.
- `{% for peer in groups['web'] %} ... {% endfor %}` is a loop. The lines inside are written once for each item.
- `{# ... #}` is a comment. It never reaches the server.

Where do the values come from? This is part 1 again. Look at the files next to the playbook. `group_vars/web.yml` sets `app_port: 8080` for the group `web`. `host_vars/web2.yml` sets `app_port: 8081` for one host, and a host variable beats a group variable, which you measured in part 1. `group_vars/db.yml` and `group_vars/all.yml` do the rest. And the template reads three more things that Ansible provides: `inventory_hostname` (the name of the host), `group_names` (the groups the host is in) and `groups` (all groups with their hosts). And one fact from part 2: `ansible_facts['distribution']`.

Because the template is rendered again on every run, it is **idempotent**: if the result on the server already equals the new result, nothing changes. And `--diff` shows what a change would do to the file.

## Your task

Open `app.conf.j2`. It has a long comment that shows the exact result you must produce for `web1` and for `db1`. Only the first two lines of the template are written. Add what the `TODO` lines say: the port line, the operating system line, and a condition with a loop that tells web hosts from the database host.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/app.conf.j2` | Write the template. |
| 3 | `node challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/run.mjs` | Starts with `fleet reset`. Renders the file on all three hosts, reads the three files back, runs again, changes the port on `web1` only with `--diff`, restores it, runs again. Saves the facts. |
| 4 | `node toolkit/show-facts.mjs c3.p3` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-3-one-template-three-hosts/part-3-template-per-host/test.mjs` | The test passes. |

The fleet keeps running after this part, with `/etc/myapp/app.conf` on all three hosts. `node toolkit/fleet.mjs reset` removes it.

## What you should see

The first run changes six things: the folder and the file, on three hosts. The three files, read back from the servers:

```text
web1:                                     db1:
# Managed by Ansible. ...                 # Managed by Ansible. ...
server_name = web1                        server_name = db1
listen_port = 8080                        listen_port = 5432
os = Debian                               os = Debian
role = web                                role = database
peer = web1
peer = web2
```

`web2` looks like `web1`, but with `server_name = web2` and `listen_port = 8081`. So web1 and web2 have 7 lines each, and db1 has 5. One template made three different files.

The second run says `changed=0` everywhere.

Then the run changes one value on one host: `--limit web1 -e app_port=9090`. `--diff` prints the file as a change of one line:

```text
-listen_port = 8080
+listen_port = 9090
```

and only `web1` changes (`changed=1`). The next run without `-e` changes it back (`changed=1`), and the run after it says `changed=0`. Notice what the diff compares: the file on the server (`before`) and the freshly rendered text (`after`). It shows a temporary file on the control node as the "after" path. Do not look for that file.

The full recorded run is in [results.md](results.md). Your numbers will be the same.

![Lines in the config file that one template made on each host, and changes per run](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c3.p3.lines_web1`, `c3.p3.lines_web2`, `c3.p3.lines_db1` | Lines in `/etc/myapp/app.conf` on each host, read back with an ad hoc `cat`. |
| `c3.p3.differs` | True when the three files are all different from each other. |
| `c3.p3.port_web1`, `c3.p3.port_web2`, `c3.p3.port_db1` | The `listen_port` line in each file. |
| `c3.p3.web_files_list_both_peers`, `c3.p3.db_file_has_no_peers` | Both web files hold `peer = web1` and `peer = web2`; the database file holds no `peer`. |
| `c3.p3.first_run_changed`, `c3.p3.second_run_changed`, `c3.p3.final_changed` | `changed=` in the PLAY RECAP, added up over all hosts. |
| `c3.p3.diff_changed`, `c3.p3.diff_removed`, `c3.p3.diff_added`, `c3.p3.restore_changed` | The run with `--diff --limit web1 -e app_port=9090`: its changes, the `-` and `+` port lines, and the changes of the run that restores the port. |
| `c3.p3.template_file` | The template the run used. The test reads it again. |

## What is different on Docker Desktop

Nothing for this part.

## Stuck?

- `'app_prot' is undefined` (or another name): the variable name in `{{ }}` has a typo. Ansible names the template file and the line.
- `Syntax error in template: Unexpected end of template. Jinja was looking for the following tags: 'endfor' or 'else'`: a `{% for %}` has no `{% endfor %}`. For a missing `{% endif %}` the message names `'elif' or 'else' or 'endif'`.
- Blank lines in the file: the `template` module removes the newline after a `{% ... %}` line, so a block tag on its own line leaves no blank line.
- `Could not read the value for c3.p3.port_web1`: your file has no line `listen_port = <number>`. Use that exact format.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 3`.
