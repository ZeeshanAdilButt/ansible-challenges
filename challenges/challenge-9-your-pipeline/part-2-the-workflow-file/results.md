# Results: Challenge 9, part 2: the workflow file and a dynamic inventory

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run used the files in reference/. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-9-your-pipeline/part-2-the-workflow-file/inventory/hosts_inventory.py --graph
```

**Output**

```text
@all:
  |--@ungrouped:
  |--@web:
  |  |--web1
  |  |--web2
  |--@db:
  |  |--db1
```

**Note:** The groups and hosts that the script built from hosts.txt.

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-9-your-pipeline/part-2-the-workflow-file/inventory/hosts_inventory.py --list
```

**Output**

```text
{
    "_meta": {
        "hostvars": {
            "db1": {
                "ansible_ssh_private_key_file": "/home/learner/.ssh/id_ed25519",
                "ansible_user": "ansible"
            },
            "web1": {
                "ansible_ssh_private_key_file": "/home/learner/.ssh/id_ed25519",
                "ansible_user": "ansible"
            },
            "web2": {
                "ansible_ssh_private_key_file": "/home/learner/.ssh/id_ed25519",
                "ansible_user": "ansible"
            }
        },
        "profile": "inventory_legacy"
    },
    "all": {
        "children": [
            "ungrouped",
            "web",
            "db"
        ]
    },
    "db": {
        "hosts": [
            "db1"
        ]
    },
    "web": {
        "hosts": [
            "web1",
            "web2"
        ]
    }
}
```

**Note:** Ansible turned the script output into its own inventory JSON, with the login variables on each host.

## Step 3

**Command**

```sh
ANP_HOSTS_FILE=/work/challenges/challenge-9-your-pipeline/part-2-the-workflow-file/other-hosts.txt node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-9-your-pipeline/part-2-the-workflow-file/inventory/hosts_inventory.py --graph
```

**Output**

```text
@all:
  |--@ungrouped:
  |--@web:
  |  |--web1
  |  |--web2
  |  |--web3
  |--@db:
  |  |--db1
```

**Note:** The script reads whatever file the variable names: 4 hosts now. (The toolkit passes variables that start with ANSIBLE_ by itself. This one is passed by run.mjs.)

## Step 4

**Command**

```sh
grep -nE "^\s+(- name|uses|run):" challenges/challenge-9-your-pipeline/part-2-the-workflow-file/.github/workflows/ansible.yml
```

**Output**

```text
27:      - name: Get the code
28:        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
30:      - name: Install Node
31:        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
36:      - name: Build the pinned control image
37:        run: docker build -t anp-control:1 -f challenges/challenge-9-your-pipeline/part-2-the-workflow-file/ci/Dockerfile .
40:      - name: Start the practice fleet
41:        run: node toolkit/fleet.mjs up
43:      - name: lint
44:        run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --only lint
46:      - name: syntax-check
47:        run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --only syntax-check
49:      - name: molecule
50:        run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --only molecule
52:      - name: check-mode
53:        run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --only check-mode
55:      - name: apply
56:        run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --only apply
58:      - name: second-run
59:        run: node challenges/challenge-9-your-pipeline/part-1-stages-locally/ci.mjs --only second-run
61:      - name: Stop the fleet
63:        run: node toolkit/fleet.mjs down
```

**Note:** The workflow parses as YAML. Its stage steps, in order: lint, syntax-check, molecule, check-mode, apply, second-run. 2 of 2 actions are pinned by a 40-character commit. It was not run on GitHub.

## Step 5

**Command**

```sh
docker image inspect python:3.12-slim-bookworm --format '{{json .RepoDigests}}'
```

**Output**

```text
["python@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df"]
```

**Note:** The digest of the image on this machine. This is how a learner finds the digest for ci/Dockerfile.

## Step 6

**Command**

```sh
grep -h "==" fleet/control/Dockerfile challenges/challenge-9-your-pipeline/part-2-the-workflow-file/ci/Dockerfile
```

**Output**

```text
ansible-core==2.21.6 ansible-lint==26.11.0 molecule-plugins[docker]==26.11.0 molecule==26.11.0
ansible-core==2.21.6 ansible-lint==26.11.0 molecule-plugins[docker]==26.11.0 molecule==26.11.0
```

**Note:** The four pip pins in the two Dockerfiles agree.
