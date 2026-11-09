# The control node: where every ansible command runs.
# Python 3.12 (ansible-core 2.21 needs 3.12 to 3.14) and the tools, pinned to exact versions.
FROM python:3.12-slim-bookworm

LABEL anp.fleet="1" anp.role="control"

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/learner \
    ANSIBLE_CONFIG=/work/ansible.cfg

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-client git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Exact pins: the course is written against these versions.
RUN pip install \
      "ansible-core==2.21.6" \
      "ansible-lint==26.11.0" \
      "molecule==26.11.0" \
      "molecule-plugins[docker]==26.11.0"

# A normal user, so files made in the mounted repository are not owned by root.
# /etc/passwd stays writable so the entrypoint can add the host user's id if it is not 1000.
RUN useradd --create-home --uid 1000 --shell /bin/bash learner \
 && chmod 777 /home/learner \
 && chmod 666 /etc/passwd \
 && git config --system --add safe.directory '*'

COPY anp-control-entrypoint.sh /usr/local/bin/anp-control-entrypoint.sh
RUN chmod 755 /usr/local/bin/anp-control-entrypoint.sh

USER 1000:1000
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/anp-control-entrypoint.sh"]
CMD ["sleep", "infinity"]
