#!/bin/sh
# Ansible runs this and reads the vault password from what it prints.
# On Docker Desktop for Windows every file in the shared folder looks executable, and Ansible then treats a
# plain password file as a script and fails. So the password file is read by this small script instead.
cat "$(dirname "$0")/.vault-pass"
