#!/bin/sh
# Runs when the control container starts. It puts the practice key where ssh looks for it.
set -eu

# If the container runs as the host user's id (Linux), make sure that id has a passwd entry.
# ssh refuses to run for an id that has no name.
if ! getent passwd "$(id -u)" >/dev/null 2>&1; then
  echo "hostuser:x:$(id -u):$(id -g):host user:/home/learner:/bin/bash" >> /etc/passwd
fi

install -d -m 700 "$HOME/.ssh"
if [ -f /keys/id_ed25519 ]; then
  # The key in /keys can look world-readable on a bind mount, and ssh refuses such a key.
  # So we copy it and set mode 600.
  install -m 600 /keys/id_ed25519 "$HOME/.ssh/id_ed25519"
  install -m 644 /keys/id_ed25519.pub "$HOME/.ssh/id_ed25519.pub"
else
  echo "anp-control: no key in /keys. Run: node toolkit/fleet.mjs keys" >&2
fi

exec "$@"
