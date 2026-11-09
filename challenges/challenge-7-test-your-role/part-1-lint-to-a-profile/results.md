# Results: Challenge 7, part 1: lint to a profile

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. The maintainer run linted reference/fix-me; the paths below show fix-me. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-lint challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml   (first 18 lines of the output)
```

**Output**

```text
WARNING  Listing 33 violation(s) that are fatal
name[casing]: All names should start with an uppercase letter.
roles/app/tasks/main.yml:2:9 Task/Handler: install curl

no-free-form: Avoid using free-form when calling module actions. (apt)
roles/app/tasks/main.yml:2 apt

fqcn[action-core]: Use FQCN for builtin module actions (apt).
roles/app/tasks/main.yml:3:3 Use `ansible.builtin.apt` or `ansible.legacy.apt` instead.

yaml[truthy]: Truthy value should be one of [false, true]
roles/app/tasks/main.yml:4

fqcn[action-core]: Use FQCN for builtin module actions (debug).
roles/app/tasks/main.yml:5:3 Use `ansible.builtin.debug` or `ansible.legacy.debug` instead.

name[missing]: All tasks should be named.
roles/app/tasks/main.yml:5 Task/Handler: debug msg=app installed
...
```

**Note:** ansible-lint printed 33 findings and exited with code 2. Each line starts with the rule name, for example fqcn[action-core].

## Step 2

**Command**

```sh
node toolkit/ansible.mjs ansible-lint -f json challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml   (findings counted per rule)
```

**Output**

```text
 10  fqcn[action-core]
  6  no-free-form
  5  name[missing]
  3  name[casing]
  3  no-changed-when
  3  yaml[truthy]
  1  command-instead-of-module
  1  ignore-errors
  1  name[play]
```

**Note:** The same findings as JSON, counted per rule. A tool can read this format, for example a pipeline.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-lint challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml   (the summary at the end)
```

**Output**

```text
# Rule Violation Summary
  1 command-instead-of-module profile:basic tags:command-shell,idiom
  6 no-free-form profile:basic tags:syntax,risk
  5 name profile:basic tags:idiom
  1 name profile:basic tags:idiom
  3 yaml profile:basic tags:formatting,yaml
  3 name profile:basic tags:idiom
  1 ignore-errors profile:basic tags:unpredictability
  3 no-changed-when profile:basic tags:command-shell,idempotency
 10 fqcn profile:basic tags:formatting
Failed: 33 failure(s), 0 warning(s) in 3 files processed of 3 encountered. Last profile that met the validation criteria was 'min'.
```

**Note:** The summary lists each rule family with its count, the profile it prints and its tags. The last line names the highest profile that passed: 'min'.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-lint --profile <name> challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml   (six runs, counts from -f json)
```

**Output**

```text
min           0 findings   exit code 0
basic        16 findings   exit code 2
moderate     19 findings   exit code 2
safety       19 findings   exit code 2
shared       23 findings   exit code 2
production   33 findings   exit code 2
```

**Note:** A profile is a set of rules. Each profile includes the one before it, so the count can only stay or go up: min, basic, moderate, safety, shared, production.

## Step 5

**Command**

```sh
node toolkit/ansible.mjs ansible-lint -f json --profile <name> challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml   (the first profile whose run reports each rule)
```

**Output**

```text
basic       command-instead-of-module
basic       name[missing]
basic       name[play]
basic       no-free-form
basic       yaml[truthy]
moderate    name[casing]
shared      ignore-errors
shared      no-changed-when
production  fqcn[action-core]
```

**Note:** Which rule belongs to which profile: the lowest profile whose run reports the rule. The rule also shows up in every stricter profile. The word after "profile:" in the summary of the default run is the same for every line, so it cannot be used for this.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-lint -P   (cut down to the rules this code hit)
```

**Output**

```text
basic       command-instead-of-module
basic       no-free-form
basic       name
basic       yaml
moderate    name[casing]
shared      ignore-errors
shared      no-changed-when
production  fqcn
```

**Note:** ansible-lint prints its own list of profiles and rules. Cut down to the rules the sloppy code hit, it shows the same profile for each rule as the table above (name[missing] and name[play] are covered by the family name).

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-lint --profile min challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/sloppy/site.yml
```

**Output**

```text
Passed: 0 failure(s), 0 warning(s) in 3 files processed of 3 encountered. Profile 'min' was required, but 'production' profile passed.
```

**Note:** With --profile min the sloppy code passes: min only checks that Ansible can load the files. Its last line says production passed, which is not what it checked (see NOTES.md).

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-lint --profile production challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/fix-me/site.yml
```

**Output**

```text
Passed: 0 failure(s), 0 warning(s) in 3 files processed of 3 encountered. Profile 'production' was required, and it passed.
```

**Note:** Your copy: 0 findings at production, exit code 0.

## Step 9

**Command**

```sh
node toolkit/ansible.mjs ansible-lint challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/fix-me/site.yml
```

**Output**

```text
Passed: 0 failure(s), 0 warning(s) in 3 files processed of 3 encountered. Last profile that met the validation criteria was 'production'.
```

**Note:** With every rule on, the highest profile your copy passes is 'production'.
