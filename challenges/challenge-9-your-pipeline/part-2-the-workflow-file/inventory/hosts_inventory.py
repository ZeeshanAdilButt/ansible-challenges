#!/usr/bin/env python3
"""A dynamic inventory: read hosts.txt and print the JSON that Ansible expects.

Ansible runs this program with --list (give me everything) or --host NAME (give me the
variables of one host). Use it like this:

    node toolkit/ansible.mjs ansible-inventory -i challenges/challenge-9-your-pipeline/part-2-the-workflow-file/inventory/hosts_inventory.py --graph

The file to read comes from the environment variable ANP_HOSTS_FILE. Without it, the script
reads hosts.txt in the folder above this one.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
HOSTS_FILE = os.environ.get("ANP_HOSTS_FILE", os.path.join(HERE, "..", "hosts.txt"))

# The login settings every practice host needs (the same as inventory/fleet.ini).
COMMON_VARS = {
    "ansible_user": "ansible",
    "ansible_ssh_private_key_file": "/home/learner/.ssh/id_ed25519",
}


def read_hosts(path):
    """Return a list of (host, group). Skip empty lines and comments."""
    pairs = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            host, group = line.split()
            pairs.append((host, group))
    return pairs


def build_inventory(pairs):
    """Return the inventory as a dict: {group: {"hosts": [...]}, "_meta": {"hostvars": {host: {...}}}}."""
    inventory = {"_meta": {"hostvars": {}}}
    # TODO: for every (host, group) pair:
    #   1. add the host to the list inventory[group]["hosts"] (make the group the first time you see it);
    #   2. give the host its variables: inventory["_meta"]["hostvars"][host] = COMMON_VARS
    return inventory


def main(argv):
    if len(argv) == 2 and argv[1] == "--list":
        print(json.dumps(build_inventory(read_hosts(HOSTS_FILE)), indent=2))
    elif len(argv) == 3 and argv[1] == "--host":
        # All the variables are already in _meta of the --list answer, so an empty answer is enough here.
        print(json.dumps({}))
    else:
        sys.exit("Usage: hosts_inventory.py --list | --host NAME")


if __name__ == "__main__":
    main(sys.argv)
