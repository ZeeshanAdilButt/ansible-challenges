# A managed node: a small Debian 12 "server" that Ansible reaches over SSH.
# No systemd here. sshd is started with the init script ("service ssh start"),
# and docker's init (tini) is PID 1, so "service ssh reload" and "restart" work.
FROM debian:bookworm-slim

LABEL anp.fleet="1" anp.role="target"

# The apt lists are kept on purpose, so "apt: name=nginx" works at once, like on a server.
# python3-apt is what the apt module uses; apt-utils stops debconf from printing a warning on every install.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server python3 python3-apt apt-utils sudo procps ca-certificates \
 && mkdir -p /run/sshd \
 && rm -f /etc/ssh/ssh_host_*_key /etc/ssh/ssh_host_*_key.pub

# The user Ansible logs in as. Key login only. The password field is '*': not a usable password, but not "locked" either.
RUN useradd --create-home --shell /bin/bash ansible \
 && usermod -p '*' ansible \
 && echo 'ansible ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ansible \
 && chmod 0440 /etc/sudoers.d/ansible

RUN printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/10-anp.conf

COPY anp-target-entrypoint.sh /usr/local/bin/anp-target-entrypoint.sh
RUN chmod 755 /usr/local/bin/anp-target-entrypoint.sh

EXPOSE 22
ENTRYPOINT ["/usr/local/bin/anp-target-entrypoint.sh"]
