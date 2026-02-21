FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends git zip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
