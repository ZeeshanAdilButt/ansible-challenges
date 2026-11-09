#!/bin/sh
# Runs when a target starts: install the practice public key, make a host key, start sshd.
set -eu

install -d -m 700 -o ansible -g ansible /home/ansible/.ssh
if [ -f /keys/id_ed25519.pub ]; then
  install -m 600 -o ansible -g ansible /keys/id_ed25519.pub /home/ansible/.ssh/authorized_keys
else
  echo "anp-target: no public key in /keys. Run: node toolkit/fleet.mjs keys" >&2
fi

# Every target makes its own host key when it starts. One ed25519 key is enough and is fast.
# (ssh-keygen -A also makes RSA and ECDSA keys, which made a reset about 3 seconds slower.)
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key

service ssh start

# Keep the container alive. PID 1 is docker's init (init: true), which reaps sshd's children.
exec sleep infinity
