# Safety rules

These challenges start a small fleet of containers on your machine. Your machine also runs your other work, and Docker is shared. These rules keep the challenges small and keep your other work safe. They are repeated, short, in every README.

## The rules

1. **Everything we create has a name and a label.** The fleet is `anp-control`, `anp-web1`, `anp-web2`, `anp-db1` (and `anp-web3` to `anp-web6` for the rollout drills). It has the label `anp.fleet=1`, and its network is `anp-fleet`. Extra things a challenge starts are named like `anp-c3-probe` and carry the label `anp.challenge=3` (the number is the challenge). The toolkit adds names and labels for you.
2. **Cleanup uses the label and nothing else.** `node toolkit/cleanup.mjs 3` removes only objects with the label `anp.challenge=3`. `node toolkit/cleanup.mjs fleet` (or `node toolkit/fleet.mjs down`) removes only objects with `anp.fleet=1`. Neither touches your other containers, images, networks or volumes, and neither touches your repository.
3. **Never run `docker system prune`, `docker volume prune` or `docker image prune` here.** They delete things you did not create here. Other projects on your machine may need those images and volumes.
4. **Every container has limits.** The control container may use 1 GB of memory and 512 processes. Each target may use 256 MB and 256 processes. If an experiment goes wrong, it stops at the limit and does not use the whole machine.
5. **No `--privileged`.** The containers run with Docker's default permissions. The targets run `sudo` for the user `ansible`, so they cannot use the `no-new-privileges` option. The control container does use it. There is one named exception, and it is the same in challenges 7 and 9: Molecule runs in its own container (`anp-c7-molecule` or `anp-c9-molecule`, started by `toolkit/molecule.mjs`) with the Docker socket mounted, because Molecule starts and removes containers. That container runs as a normal user (not root, added to the group that owns the socket) with `no-new-privileges`. Whoever can use the socket controls your Docker, so that container is only used for Molecule, and the READMEs of challenges 7 and 9 say so.
6. **Ansible only reaches the fleet.** The inventories list only the fleet hosts, by their names on the private network `anp-fleet`. The targets are not published on any port of your machine. Nothing here touches a real server, a real account or a real password. Every secret in the challenges is fake and says so.
7. **The practice SSH key stays on your machine.** `node toolkit/fleet.mjs keys` makes it in `keys/`. The folder is git-ignored. Never commit it. It is only valid for the practice fleet.
8. **Check your free disk first.** Run `node toolkit/check-setup.mjs`. It stops you if less than 2 GB is free before the two images are built (0.3 GB once they exist). The two fleet images together are about 0.7 GB on disk (439 MB and 236 MB on the reference machine). Each README says the download size before any pull.
9. **Remove only what you made.** If you need to remove something by hand, use the full name, for example `docker rm -f anp-c3-probe`. Do not use wildcards, and do not remove by "everything".

## If something goes wrong

- A host is in a bad state: `node toolkit/fleet.mjs reset` makes the targets new again in a few seconds.
- Run `node toolkit/cleanup.mjs <challenge number>` for extras of one challenge, or `node toolkit/cleanup.mjs fleet` for the fleet.
- Run `docker ps -a --filter label=anp.fleet` and `docker ps -a --filter label=anp.challenge` to see what is left.
- If Docker itself is stuck, restart Docker Desktop or the docker service. Your images and repository stay.

## What is different on Docker Desktop

Docker Desktop runs Docker inside a small Linux virtual machine. The memory and disk Docker can use are the limits of that machine, not of your computer. On the Hyper-V or macOS setup, the limits are in Docker Desktop under Settings, then Resources. On the WSL 2 setup, they come from `.wslconfig` in your user folder; change them there and run `wsl --shutdown`. The READMEs have a box where behaviour differs.
