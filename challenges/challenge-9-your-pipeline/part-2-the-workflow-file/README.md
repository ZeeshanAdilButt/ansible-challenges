# Challenge 9, part 2: the workflow file

**Time:** about 45 minutes. **Download:** nothing for this part (it reads files). The real workflow, when it runs on GitHub, builds the two fleet images on a GitHub machine, about 7 minutes. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

Your pipeline from part 1 runs on your laptop, when you remember to run it. A teammate pushes a change, forgets, and the playbook that reaches the servers has never been linted or tested. The cure is to let a machine run the pipeline on every push, the same way every time.

Then a new problem shows up. A pipeline that runs "the latest of everything" can fail on Monday although nobody changed anything: a tool released a new version over the weekend. So the pipeline has to **pin** what it uses.

**A real run.** The test on your laptop checks the file's structure and pins. The workflow itself runs on GitHub, so the maintainer also ran the reference version on GitHub-hosted runners on 2026-11-08. Two runs failed first, on purpose of the starter files: the starter `ci/Dockerfile` still held `@sha256:TODO` (`invalid reference format`, in 12 seconds), and the starter `guard.yml` from part 1 still held the wrong comparison, so `check-mode` stopped with `Refusing to run. deploy_environment is 'practice', not 'practice'.` The third run, with the reference Dockerfile, guard and workflow, passed in about 1 minute 35 seconds: lint 3 s, syntax-check 0 s, molecule 34 s, check-mode 3 s, apply 3 s, second-run 2 s (control image build 24 s and fleet start 13 s before them). Your own run happens in your own repository, so its numbers will differ.

## The idea

**GitHub Actions** is a service that runs a **workflow** on GitHub's machines when something happens, for example a push. A workflow is a YAML file in `.github/workflows/` at the root of the repository. It has **jobs**, and a job has **steps**. Each step has a `name` and either `run:` (a command) or `uses:` (a ready-made **action**).

Three kinds of pin appear in this part:

- **Actions by commit.** `uses: actions/checkout@v7` names a tag, and a tag can be moved to other code. `uses: actions/checkout@3d3c42e5...` (40 characters) names exactly one commit. A comment after it says which release it is. Find the commit of a release with `gh api repos/actions/checkout/git/ref/tags/v7.0.1`.
- **Tools by version.** The Python packages in the control image are pinned to exact versions (`ansible-core==2.21.6` and so on).
- **The base image by digest.** `python:3.12-slim-bookworm` is a tag. A **digest** (`sha256:` and 64 characters) names exactly one image. You find it on any machine that has pulled the image:

  ```text
  docker image inspect python:3.12-slim-bookworm --format '{{index .RepoDigests 0}}'
  ```

A **dynamic inventory** is a program that Ansible runs to ask "which hosts exist?". It prints JSON: groups with their hosts, and a `_meta` block with the variables of each host. The hosts can then come from any source (a cloud, a database, a file) instead of an INI file you edit by hand. Ours reads `hosts.txt`.

## Your task

Three files have a `TODO`:

1. `ci/Dockerfile`: put the real digest after `sha256:` on the `FROM` line.
2. `inventory/hosts_inventory.py`: write the loop in `build_inventory` that fills the groups and the host variables.
3. `.github/workflows/ansible.yml`: the six stage steps are in the wrong order. Put them in the order of part 1's `ci.mjs`: `lint`, `syntax-check`, `molecule`, `check-mode`, `apply`, `second-run`. Then delete the TODO comment.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`).

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-9-your-pipeline/part-2-the-workflow-file/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Fix the three files. | |
| 3 | `node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-9-your-pipeline/part-2-the-workflow-file/inventory/hosts_inventory.py --graph` | Shows what your script built. |
| 4 | `node challenges/challenge-9-your-pipeline/part-2-the-workflow-file/run.mjs` | Reads the three files, runs the inventory script twice (with `hosts.txt` and with a second file), parses the workflow, checks the pins. Saves the facts. |
| 5 | `node toolkit/show-facts.mjs c9.p2` | Shows the saved numbers. |
| 6 | `node --test challenges/challenge-9-your-pipeline/part-2-the-workflow-file/test.mjs` | The test passes. |

To use the workflow in your own repository, copy the folder `.github` from this part to the root of that repository, and copy `ci/Dockerfile` along with it.

If `inventory/hosts_inventory.py` does not run on Linux or macOS, make it executable: `chmod +x`. Ansible only runs inventory files that are executable.

## What you should see

```text
@all:
  |--@ungrouped:
  |--@web:
  |  |--web1
  |  |--web2
  |--@db:
  |  |--db1
```

With the second hosts file the script gives four hosts. The workflow parses as YAML, its stage steps come in the order `lint, syntax-check, molecule, check-mode, apply, second-run`, and both actions are pinned by a 40-character commit. The digest in `ci/Dockerfile` is the digest of the image on your machine. The four `pip` pins in `ci/Dockerfile` equal the four pins in `fleet/control/Dockerfile`: that is why the pinned file is a copy, and why the test compares them.

The full recorded run is in [results.md](results.md).

![What the pipeline files hold](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c9.p2.stages` | The names of the workflow steps that are stage names, in file order, after Python's YAML parser read the file (in the control container). |
| `c9.p2.inventory_hosts`, `c9.p2.inventory_groups` | Hosts and groups in the output of `ansible-inventory --list` for your script. |
| `c9.p2.inventory_hosts_other_file` | The same count with `ANP_HOSTS_FILE` pointing at a second file that `run.mjs` makes and deletes. |
| `c9.p2.actions_total`, `c9.p2.actions_pinned` | `uses:` lines in the workflow, and how many end with `@` and 40 hex characters. |
| `c9.p2.base_digest`, `c9.p2.digest_matches_local` | The digest in the `FROM` line, and whether `docker image inspect` on this machine lists it. |
| `c9.p2.pins_agree` | The four `pip` pins in `ci/Dockerfile` equal those in `fleet/control/Dockerfile`. |

## What is different on Docker Desktop

Nothing for this part. The digest in the file is the one our reference machine had; yours may differ if you pulled the image on another day. A different digest is not wrong, it is just a different build of the same tag. Use the one `docker image inspect` prints for you.

## Stuck?

- `ci/Dockerfile still has "sha256:TODO"`: find the digest with the `docker image inspect` command above.
- `The digest is not the digest of python:3.12-slim-bookworm on this machine`: you copied a digest from somewhere else, or the image was pulled again. Run the `docker image inspect` command and copy that.
- `The workflow is not valid YAML`: indentation in `.github/workflows/ansible.yml`. Steps start with `- name:` at the same indent.
- `ansible-inventory` says it could not parse the script: run it by hand with `node toolkit/fleet.mjs shell control`, then `python3 challenges/challenge-9-your-pipeline/part-2-the-workflow-file/inventory/hosts_inventory.py --list`, and read the error.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 9`.
