# Challenge 3, part 2: facts

**Time:** about 45 minutes. **Download:** about 1.5 MB of Debian packages per host (the `ip` command, package `iproute2`, with seven small libraries). No image pull. **Safety rules:** [SAFETY.md](../../../SAFETY.md)

## The problem

One template must work on three different hosts. So it needs to know things about each host: its name, its operating system, its address, how much memory it has. You do not want to type these in. You want to ask the host.

There is a second problem. Ansible is changing how you read these values. The old way still works, but it prints a warning, and the warning has an end date. If you ignore it, your playbooks will break on a day you did not choose.

## The idea

A **fact** is a piece of information that Ansible collects from a host. At the start of each play, Ansible runs a module called `setup` on every host. This is the `Gathering Facts` task you see in every run. The answers are stored in a dictionary called `ansible_facts`. You read one value with square brackets: `ansible_facts['distribution']`.

The **old way** is a plain variable with the prefix `ansible_`, such as `{{ ansible_distribution }}`. Ansible copies every fact into such a variable (this is called injecting). You will see what Ansible says about it.

Three more ideas:

- A fact can be **missing**. Ansible does not warn when it cannot find one. The error comes later, in the task that asks for it.
- **Gathering costs time.** You can gather only a **subset** of the facts: `gather_subset: min`. You get fewer facts, and some groups (such as the network facts) are gone.
- Containers are not machines. The three hosts here share one kernel, so they report the same memory: the memory of the Docker virtual machine.

## Your task

Open `facts.yml` in this folder. The first two tasks are written for you (you will see why in the first step of the run). Four debug tasks print one fact each, with a label. Replace the word `TODO` in each of them with the right fact. The comment at the top of the file lists the four.

## Steps

The fleet must be running (`node toolkit/fleet.mjs up`). Run these in the root folder of your repository.

| # | Command | What happens |
|---|---|---|
| 1 | `node --test challenges/challenge-3-one-template-three-hosts/part-2-facts/test.mjs` | The test **fails** on purpose. Read the message. |
| 2 | Edit `challenges/challenge-3-one-template-three-hosts/part-2-facts/facts.yml` | Replace the four `TODO` words. |
| 3 | `node challenges/challenge-3-one-template-three-hosts/part-2-facts/run.mjs` | Starts with `fleet reset`. Shows a missing fact, runs your playbook, runs the old style and the old style with injection off, compares all facts with the minimal subset, and times the gathering. Saves the facts. It takes several minutes, mostly the timing. |
| 4 | `node toolkit/show-facts.mjs c3.p2` | Shows the saved numbers. |
| 5 | `node --test challenges/challenge-3-one-template-three-hosts/part-2-facts/test.mjs` | The test passes. |

The fleet keeps running after this part, with `iproute2` installed on all three hosts. `node toolkit/fleet.mjs reset` removes it.

## What you should see

**A missing fact.** On new servers, `ansible_facts['default_ipv4']` does not exist:

```text
Error while resolving value for 'msg': object of type 'dict' has no attribute 'default_ipv4'
```

Nothing warned you while the facts were gathered. The cause: Ansible finds the network facts by running the `ip` command, and the target image does not have it. The first task of `facts.yml` installs `iproute2` (that is the package with `ip`) and the second one gathers the facts again with `ansible.builtin.setup`. After that, the IPv4 address is there.

**Your four facts.** All three hosts say `Debian` and `apt`. Each host has its own IPv4 address on the practice network. All three say the same memory (`15835` MB on the reference machine). That number is the Docker virtual machine, not the container.

**The old style.** `old-style.yml` reads `ansible_distribution` and `ansible_pkg_mgr`. It works, and Ansible prints this once for each task that uses an injected fact (two tasks, so two warnings, not six):

```text
[DEPRECATION WARNING]: INJECT_FACTS_AS_VARS default to `True` is deprecated, top-level facts will not be auto injected after the change. This feature will be removed from ansible-core version 2.24.
...
Use `ansible_facts["fact_name"]` (no `ansible_` prefix) instead.
```

Read it slowly. It says the **default** of the setting `INJECT_FACTS_AS_VARS` will change, and it says what to do: use `ansible_facts["fact_name"]`. The end date is a version: 2.24. To see what the change will do, the run repeats the playbook with `ANSIBLE_INJECT_FACT_VARS=false`. Now the old name is gone: `'ansible_distribution' is undefined`. This is what a playbook with the old style will meet when the default changes.

**All facts, or a subset.** The default gathers 105 facts on each host. `gather_subset: min` gathers 53, and the network group is not among them: no `default_ipv4`. If your template needs the IPv4 address, `min` is wrong for it.

**What gathering costs.** `time-gather.yml` calls the module five times on each host and times it from inside the playbook, so the start of Ansible does not hide the answer. The recorded run:

```text
Settings as they are (seconds per module call):
all facts                      median 2.92 s
gather_subset: min             median 1.98 s
ping, no facts                 median 1.43 s

With ANSIBLE_PIPELINING=True (seconds per module call):
all facts                      median 2.35 s
gather_subset: min             median 1.52 s
ping, no facts                 median 1.01 s
```

Read these numbers with care. Every call has a fixed cost: the SSH trip and starting Python on the host. That is the ping row. Gathering all facts costs more than a ping, and `min` costs a little more than a ping. But the machine that recorded this was busy with other work, and the three runs of each row differ a lot (all facts: 1.75, 3.56 and 2.92 seconds). Your numbers will differ. The order should be the same: ping is cheapest, `min` is next, all facts is the most expensive. With pipelining on (fewer SSH steps per call) the fixed cost drops. On three small containers the whole difference is about a second per host. On a server with many disks and network cards it is larger.

The full recorded run is in [results.md](results.md).

![Seconds for one module call on one host: all facts, minimal facts, ping (median of three runs)](chart.svg)

## Where each number comes from

| Fact | Where it comes from |
|---|---|
| `c3.p2.hosts_reported`, `c3.p2.distribution`, `c3.p2.pkg_mgr` | The labels `DISTRIBUTION=` and `PKG_MGR=` printed by your debug tasks. |
| `c3.p2.default_ipv4_web1`, `c3.p2.memtotal_mb_web1`, `c3.p2.memtotal_same_on_all_hosts` | The labels `IPV4=` and `MEMORY_MB=`. The last one is true when all three hosts print the same number. |
| `c3.p2.missing_fact_error` | The output of `missing-fact.yml` on new servers contains `has no attribute 'default_ipv4'`. |
| `c3.p2.deprecation_lines`, `c3.p2.deprecation_text`, `c3.p2.deprecation_remedy`, `c3.p2.deprecation_removal_version` | Lines that start with `[DEPRECATION WARNING]` in the output of `old-style.yml`, the first one without its prefix, the line that starts with `Use `, and the version in it. |
| `c3.p2.inject_off_error` | With `ANSIBLE_INJECT_FACT_VARS=false`, the output contains `'ansible_distribution' is undefined`. |
| `c3.p2.fact_count_full`, `c3.p2.fact_count_min`, `c3.p2.min_has_default_ipv4` | The number of entries in `ansible_facts` (the `length` filter) on `web1` in `gather-full.yml` and `gather-min.yml`, and whether `default_ipv4` is in the facts of the second one. |
| `c3.p2.gather_full_s`, `c3.p2.gather_min_s`, `c3.p2.gather_ping_s` | Median of three runs of `time-gather.yml`. In each run, the average seconds per call, then the mean of the three hosts. |
| `c3.p2.gather_full_pipelined_s`, `c3.p2.gather_min_pipelined_s`, `c3.p2.gather_ping_pipelined_s` | The same with `ANSIBLE_PIPELINING=True`. |
| `c3.p2.reset_s`, `c3.p2.playbook_file` | Seconds for `fleet reset`, and the playbook the run used. |

## What is different on Docker Desktop

The memory number is the Docker virtual machine's memory, because containers share its kernel. On Linux without a virtual machine it is the memory of your computer. Timings depend on your machine.

## Stuck?

- `facts.yml still has the word TODO`: replace it in all four debug tasks.
- `object of type 'dict' has no attribute 'default_ipv4'` in your playbook: you removed the first two tasks, or the fleet was reset after them. Keep the `iproute2` task and the `setup` task before the debug tasks.
- A host is in a bad state: `node toolkit/fleet.mjs reset`.
- Something is left over from a crashed run: `node toolkit/cleanup.mjs 3`.
