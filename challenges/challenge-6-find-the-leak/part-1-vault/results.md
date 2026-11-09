# Results: Challenge 6, part 1: the vault

Recorded run. Machine: win32, Docker Engine 29.9.2, Node 22.22.2. All secrets are fake.. Date: 2026-11-08.

## Step 1

**Command**

```sh
node toolkit/ansible.mjs ansible-vault encrypt_string --vault-password-file /home/learner/.vault-pass demo-secret-not-real-0001 --name api_token
```

**Output**

```text
api_token: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          30343433663932313638326437363934376264323833386236376139343361316663383039313938
          3061633038633366613166333162343033353165303636340a363231383131353163373436386434
          30616137623637343830326430343865353038636366633233643737626265333266613537306165
          3464306630626561620a396633626236303163636663623031616534393338646233633463366132
          32343363656633323431326664316131313234613433653639373837396131306332
```

**Note:** encrypt_string turns one value into a block you can paste into any vars file. The first line says it is a vault.

## Step 2

**Command**

```sh
head -n 3 challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml
```

**Output**

```text
$ANSIBLE_VAULT;1.1;AES256
32626165333535663736613032376666343532646562633365353138343763373432393465333830
6162343163343037323737313832316431373964656538370a663332663433613465353734373134
```

**Note:** The file on disk starts with the vault header, then hex. The secret appears in it 0 times.

## Step 3

**Command**

```sh
node toolkit/ansible.mjs ansible-vault view --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml
```

**Output**

```text
# FAKE value for the course. It is not a real secret.
db_password: demo-secret-not-real-0001
```

**Note:** view decrypts to the screen. Nothing is written to disk.

## Step 4

**Command**

```sh
node toolkit/ansible.mjs ansible-vault edit --vault-password-file /home/learner/.vault-pass /tmp/edit-demo.yml
```

**Output**

```text
[ERROR]: Unable to execute the command "vi /home/learner/.ansible/tmp/ansible-local-2405gvotpoe9/tmpou3v2q7j.yml": [Errno 2] No such file or directory: 'vi'
```

**Note:** edit needs an editor. The control image has none (vi, nano and vim are not installed), so edit fails.

## Step 5

**Command**

```sh
docker exec -w /work -e "EDITOR=sed -i s/demo-secret-not-real-0001/demo-secret-not-real-0002/" anp-control ansible-vault edit --vault-password-file /home/learner/.vault-pass /tmp/edit-demo.yml
```

**Output**

```text
(no output)
```

**Note:** With EDITOR set to a sed command, edit decrypts to a temporary file, runs the editor on it and encrypts the result again. It printed nothing.

## Step 6

**Command**

```sh
node toolkit/ansible.mjs ansible-vault view --vault-password-file /home/learner/.vault-pass /tmp/edit-demo.yml
```

**Output**

```text
# FAKE value for the course. It is not a real secret.
db_password: demo-secret-not-real-0002
```

**Note:** The copy now holds the changed value. Your real file was not touched.

## Step 7

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-1-vault/site.yml
```

**Output**

```text

PLAY [Deploy the demo app config] **********************************************

TASK [Gathering Facts] *********************************************************
ok: [web2]
ok: [web1]

TASK [Make the config folder] **************************************************
changed: [web1]
changed: [web2]

TASK [Write the app config] ****************************************************
changed: [web1]
changed: [web2]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=2    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** Run with the password file: 2 hosts changed, 0 failed.

## Step 8

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook --vault-password-file /home/learner/.vault-pass challenges/challenge-6-find-the-leak/part-1-vault/site.yml
```

**Output**

```text

PLAY [Deploy the demo app config] **********************************************

TASK [Gathering Facts] *********************************************************
ok: [web1]
ok: [web2]

TASK [Make the config folder] **************************************************
ok: [web1]
ok: [web2]

TASK [Write the app config] ****************************************************
ok: [web2]
ok: [web1]

PLAY RECAP *********************************************************************
web1                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
web2                       : ok=3    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
```

**Note:** The second run changed 0 hosts: the vault does not break idempotence.

## Step 9

**Command**

```sh
docker exec anp-web1 stat -c "%a %U" /etc/demo-app/app.conf
```

**Output**

```text
600 root
```

**Note:** The password reached the target in a file only root can read (mode 600).

## Step 10

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook --vault-password-file /tmp/wrong-pass challenges/challenge-6-find-the-leak/part-1-vault/site.yml
```

**Output**

```text
[ERROR]: Invalid vars_files file '/work/challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml': Decryption failed (no vault secrets were found that could decrypt).

Invalid vars_files file '/work/challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml'.

<<< caused by >>>

Decryption failed (no vault secrets were found that could decrypt).
Origin: /work/challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml
```

**Note:** Exit code 1. Ansible stopped before it touched a host.

## Step 11

**Command**

```sh
node toolkit/ansible.mjs ansible-playbook challenges/challenge-6-find-the-leak/part-1-vault/site.yml
```

**Output**

```text
[ERROR]: Invalid vars_files file '/work/challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml': Attempting to decrypt but no vault secrets found.

Invalid vars_files file '/work/challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml'.

<<< caused by >>>

Attempting to decrypt but no vault secrets found.
Origin: /work/challenges/challenge-6-find-the-leak/part-1-vault/vars/secrets.yml
```

**Note:** Without any password: exit code 1.

## Step 12

**Command**

```sh
git diff   (in a demo repository: the same change to a plain file and to a vaulted file)
```

**Output**

```text
 plain.yml   |  2 +-
 vaulted.yml | 18 +++++++++---------
 2 files changed, 10 insertions(+), 10 deletions(-)

---- git diff plain.yml
diff --git a/plain.yml b/plain.yml
index 9a3aefa..eadaa87 100644
--- a/plain.yml
+++ b/plain.yml
@@ -1,2 +1,2 @@
 # FAKE value for the course
-db_password: demo-secret-not-real-0001
+db_password: demo-secret-not-real-0002
---- git diff vaulted.yml
diff --git a/vaulted.yml b/vaulted.yml
index 611d000..86d9e6c 100644
--- a/vaulted.yml
+++ b/vaulted.yml
@@ -1,10 +1,10 @@
 $ANSIBLE_VAULT;1.1;AES256
-32626165333535663736613032376666343532646562633365353138343763373432393465333830
-6162343163343037323737313832316431373964656538370a663332663433613465353734373134
-36363734333466376132613334313335613239313030323538343737336462383938383632626133
-3165643733333132310a666239303633313535376361643933616639313235366433366239393466
-63613735653764656464376265363863333034353035623063346466326563663335616337396136
-30663937326138336238626133376335326239633064373734396262613063373639316263633236
-37663737636563613564636161663437643332303463376134666331653538636533306634623963
-63366633393266343561343662633137323733643330653435373266623430346437653435643935
-3631
+36643433363132326530363166666235633834663533626664316639633439653331363632323865
+3339333962656437396362306538633437623839383234330a666233343565353563323338323235
+39336639346539363632633962613233383032626363366338323263376332353834383434386432
+3865643461623738380a356632313538386637333665356461323332663636643361336531386136
+39663238613234626533363864653131636363666661653839343538623637333738653663326635
+32306464613939646661356365663332303138373365393361613730376664613364653238666262
+61326537303734636364396134303662383230323464626364326537653735623261336265393561
+65646539623839316635353762643839353766623433363938613636336163376563366532633766
+3237
```

**Note:** A plain file shows the old and the new secret in the diff. A vaulted file shows hex that changed from top to bottom. Nobody can review the change, but nobody can read it either.
