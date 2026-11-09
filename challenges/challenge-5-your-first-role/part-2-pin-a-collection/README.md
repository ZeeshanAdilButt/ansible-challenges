# Challenge 5, part 2: pin a collection

**Time:** about 45 minutes. **Download:** about 170 KB from Ansible Galaxy (the collection `ansible.posix`), four times. This part needs the internet. No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Your playbook uses a module that is not part of Ansible itself. It comes from a **collection**. Today you install the collection, the playbook works, and you go home. In three months a colleague installs it on a new machine and gets a **newer** version. A module has a new default, or a renamed option. The same playbook now behaves differently, and nothing in your repository changed.

You want the same collection, in the same version, on every machine, every time.

## The idea

- A **collection** is a package of Ansible content (modules, plugins, roles) with a name in two parts, `namespace.name`, for example `ansible.posix`. Modules inside are called by their full name: `ansible.posix.sysctl`. Ansible-core itself ships only `ansible.builtin`.
- **Ansible Galaxy** is the public place where collections are published.
- **`requirements.yml`** lists the collections a project needs. `ansible-galaxy collection install -r requirements.yml -p collections` installs them into the folder `collections/` of the project. (`ansible.cfg` points Ansible at that folder, and `.gitignore` keeps it out of git.)
- To **pin** a collection means to name one exact version. With no version, Galaxy gives you the newest. With `version: "2.1.0"`, you get 2.1.0 today, next year and on your colleague's machine.

## Your task

Open `requirements.yml` in this folder. It lists `ansible.posix` with no version. Add one line under the name: `version: "2.1.0"`. An exact version is three numbers. Do not use `>=` or `*`: they are ranges, and a range is not a pin.

`use-it.yml` is given. It calls `ansible.posix.sysctl` to write a kernel setting into a file (it does not touch the running kernel). `bad-requirements.yml` is given too. It asks for a version that does not exist.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-5-your-first-role/part-2-pin-a-collection/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-5-your-first-role/part-2-pin-a-collection/requirements.yml` | Add the version. |
| 3 | `node challenges/challenge-5-your-first-role/part-2-pin-a-collection/run.mjs` | Starts with `fleet reset` and an empty `collections/`. Tries the playbook with no collection, installs without a pin, installs your pin three times, uses the module twice, installs again, tries an impossible pin. About 7 minutes on Docker Desktop for Windows (see the box below). On Linux it takes much less. |
| 4 | `node toolkit/show-facts.mjs c5.p2` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-5-your-first-role/part-2-pin-a-collection/test.mjs` | The test passes. |

## What you should see

Before any install, the playbook stops before it touches a host:

```text
[ERROR]: couldn't resolve module/action 'ansible.posix.sysctl'. This often indicates a misspelling, missing collection, or incorrect module path.
```

The exit code is 4.

An install with no version takes the newest version. When we recorded this, it was **2.2.2**. Your pin gives **2.1.0**. (Galaxy had 2.2.2 as newest and 2.1.0 from 2025-07-17 when we looked. A newer one may exist for you.)

With the collection installed, `use-it.yml` changes 2 hosts the first time and 0 the second time. The collection's module is idempotent, like the built-in ones.

A second install changes nothing:

```text
Nothing to do. All requested collections are already installed. If you want to reinstall them, consider using `--force`.
```

So a pin protects you only when you **change the pin on purpose** and reinstall (`--force`).

The impossible pin fails with the exit code 1:

```text
[ERROR]: Failed to resolve the requested dependencies map. Could not satisfy the following requirements:
* ansible.posix:99.0.0 (direct request)
```

The full recorded run is in [results.md](results.md). Your numbers will be different. The shape should be the same.

![Seconds to install the pinned collection](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c5.p2.pinned_version` | The `Version` column of `ansible-galaxy collection list -p collections` after your install. The test also checks it against your `requirements.yml`. |
| `c5.p2.install_s` | The median of three installs of your `requirements.yml`, each into an empty `collections/` folder. |
| `c5.p2.latest_version` | The same list after an install with no version. |
| `c5.p2.missing_collection_exit_code`, `..._message` | The exit code and the first line of the error of `use-it.yml` before any install. |
| `c5.p2.use_changed_first`, `c5.p2.use_changed_second` | The `changed=` column of the recaps of `use-it.yml`, added up over the web hosts. |
| `c5.p2.second_install_nothing` | Whether the second install printed `Nothing to do`. |
| `c5.p2.bad_pin_exit_code`, `c5.p2.bad_pin_message` | The exit code and the error line of the install of `bad-requirements.yml`. |

## What is different on Docker Desktop

The install is **slow** into the project folder on Docker Desktop for Windows. The collection has hundreds of small files, and the project folder is shared from Windows, where every file operation is slow. We measured 65 to 145 seconds for one install into `collections/`, and 2 to 4 seconds for the same install into a folder on the container's own disk. On Linux and on WSL2 with the repository inside the Linux file system, expect seconds. `install_s` is therefore a number about your machine, not about Galaxy.

## Stuck?

- `requirements.yml has no exact version yet`: do the task above.
- `couldn't resolve module/action 'ansible.posix.sysctl'` **after** the install: the collection is not in `collections/`, or `ansible.cfg` was changed. Run `node toolkit/ansible.mjs ansible-galaxy collection list -p collections`.
- The install seems to hang: it is slow on Docker Desktop (see above). Give it a few minutes.
- A network error from Galaxy: try again. This part needs the internet.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 5`. The folder `collections/` is not Docker state: delete it yourself if you want it gone.
