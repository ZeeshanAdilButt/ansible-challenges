# The control image for the pipeline on GitHub, pinned.
# It is the same image as fleet/control/Dockerfile, with one change: the base image is named by its digest.
#
# A tag such as python:3.12-slim-bookworm can point to a different image next month.
# A digest (sha256:...) names exactly one image, so a pipeline run next year uses the same base.
#
# TODO: replace the word TODO after "sha256:" with the digest of python:3.12-slim-bookworm.
# Find it on a machine that has pulled the image (your fleet build did):
#   docker image inspect python:3.12-slim-bookworm --format '{{index .RepoDigests 0}}'
# It prints python@sha256:... and the 64 characters after "sha256:" are what you need.
FROM python:3.12-slim-bookworm@sha256:TODO

LABEL anp.fleet="1" anp.role="control"

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/learner \
    ANSIBLE_CONFIG=/work/ansible.cfg

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-client git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Exact pins: the same versions as fleet/control/Dockerfile. The test checks that they agree.
RUN pip install \
      "ansible-core==2.21.6" \
      "ansible-lint==26.11.0" \
      "molecule==26.11.0" \
      "molecule-plugins[docker]==26.11.0"

RUN useradd --create-home --uid 1000 --shell /bin/bash learner \
 && chmod 777 /home/learner \
 && chmod 666 /etc/passwd \
 && git config --system --add safe.directory '*'

COPY fleet/control/anp-control-entrypoint.sh /usr/local/bin/anp-control-entrypoint.sh
RUN chmod 755 /usr/local/bin/anp-control-entrypoint.sh

USER 1000:1000
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/anp-control-entrypoint.sh"]
CMD ["sleep", "infinity"]
