# Challenge 5, part 1: move a playbook into a role

**Time:** about 75 minutes. **Download:** about 2 MB of Debian packages per web host (nginx and a few libraries), twice. No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

`before.yml` works. It installs nginx, writes a page and a config, and starts the server. But it is one long file, and it lives in one place. Next month a second project needs the same web server. You will copy the file, change one line, and now you have two copies to keep right. A year later you have five.

You want to write this once and **use** it many times, with a short playbook that only says "these hosts get that role".

## The idea

A **role** is a folder with a fixed shape. Ansible knows the shape, so it finds each part by itself:

```text
roles/webserver/
  tasks/main.yml        the tasks (a plain list)
  handlers/main.yml     the handlers (a plain list)
  defaults/main.yml     variables with the weakest priority: easy to override
  templates/site.conf.j2   templates the role uses
  meta/main.yml         who made it, its name, its namespace
```

Moving a playbook into a role is mostly cutting and pasting, with two changes in how you write it:

- In a role's `tasks/main.yml` and `handlers/main.yml` there is no `hosts:`, no `tasks:` line and no extra indent. It is just a list of tasks.
- Variables that the user may want to change go to `defaults/main.yml`. A default is the **weakest** place for a variable: `-e site_port=9090` on the command line, or a variable in the playbook, wins over it. So the role has a sensible value, and nobody has to edit the role to change it.

`meta/main.yml` holds `galaxy_info`. Give it a `role_name` and a `namespace`. The two together make the full name, `namespace.role_name`. This looks like paperwork, but tools use it: the course research found that Molecule (challenge 7) stops with `InvalidPrerequisiteError: Computed fully qualified role name of motd does not follow current galaxy requirements` for a role that has no namespace.

The playbook after the move is short:

```yaml
- name: Web servers with nginx
  hosts: web
  become: true
  roles:
    - webserver
```

Ansible looks for `webserver` in a folder named `roles` next to the playbook.

## Your task

The folder has `before.yml` (given, it works) and the skeleton of a role in `roles/webserver/`. Each file in the skeleton has a `TODO`. Do all six:

1. `tasks/main.yml`: move the five tasks of `before.yml` here.
2. `handlers/main.yml`: move the handler here.
3. `defaults/main.yml`: move the variable `site_port` here.
4. `templates/site.conf.j2`: copy the template from the `templates` folder next to `before.yml`. (Keep the original there: `before.yml` still uses it.)
5. `meta/main.yml`: fill in `role_name` (`webserver`), `namespace` (a lower case word, for example `acme` or your own name), `author` and `description`.
6. `site.yml`: call the role with a `roles:` list.

`typo.yml` is given. It has a typo in the role name, on purpose.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-5-your-first-role/part-1-move-to-a-role/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit the six files | Do the six TODOs. |
| 3 | `node challenges/challenge-5-your-first-role/part-1-move-to-a-role/run.mjs` | Starts with `fleet reset`. Runs `before.yml` twice, lists the tasks of your role, resets, runs your role twice, overrides the port, then runs the typo playbook. About 3 minutes. |
| 4 | `node toolkit/show-facts.mjs c5.p1` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-5-your-first-role/part-1-move-to-a-role/test.mjs` | The test passes. |

You can check your work early, without the fleet: `node toolkit/ansible.mjs ansible-playbook challenges/challenge-5-your-first-role/part-1-move-to-a-role/site.yml --list-tasks` should list five tasks that start with `webserver :`.

## What you should see

`before.yml`, first run: `changed=6` on each web host (five tasks and the handler). Second run: `changed=0`.

`--list-tasks` shows where each task comes from. A task from a role has the role name in front:

```text
      webserver : Install nginx	TAGS: []
      webserver : Make the web root	TAGS: []
      ...
```

The role, on new targets, gives the **same** numbers: `changed=6` on each host, and `RUNNING HANDLER [webserver : Reload nginx]` (the handler also shows the role name). Second run: `changed=0`.

With `-e site_port=9090` only the config file and the handler change: `changed=2` on each host. The default `8080` lost, as it should.

The typo playbook fails before it touches a host, with a message that lists every folder Ansible looked in:

```text
[ERROR]: The role 'webservr' was not found in: /work/.../roles:/home/learner/.ansible/roles:/usr/share/ansible/roles:/etc/ansible/roles:/work/...
```

The playbook shrinks from 35 lines of code to 5 (blank lines, comments and the `---` line are not counted).

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Lines of code in the playbook, before and after the move](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c5.p1.tasks_moved` | Lines that start with `webserver :` in the output of `--list-tasks`. |
| `c5.p1.playbook_lines_before`, `c5.p1.playbook_lines_after` | Lines of `before.yml` and of your `site.yml` that are not empty, not a comment and not `---`. |
| `c5.p1.before_changed_run1`, `..._run2`, `c5.p1.role_changed_run1`, `..._run2` | The `changed=` column of the play recap, added up over the web hosts. |
| `c5.p1.role_handler_runs_run1` | Hosts listed under `RUNNING HANDLER [webserver : Reload nginx]`. |
| `c5.p1.override_changed`, `c5.p1.override_port_9090` | The recap of the run with `-e site_port=9090`, and a `grep listen` of the config on the hosts. |
| `c5.p1.typo_exit_code`, `c5.p1.typo_message` | The exit code and the first line of the error of `typo.yml`. |

## What is different on Docker Desktop

Nothing for this part.

## Stuck?

- `No task comes from the role webserver`: `tasks/main.yml` is still empty, or `site.yml` has no `roles:` list.
- `The tasks/main.yml file for role 'webserver' must contain a list of tasks`: you pasted `tasks:` or `hosts:` into `tasks/main.yml`. A role's task file is a plain list that starts with `- name:`.
- `Could not find or access 'site.conf.j2'`: the template is not in `roles/webserver/templates/` yet (TODO 4).
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 5`.
