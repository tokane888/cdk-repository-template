FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

RUN npm install -g npm@latest

# install npm packages
# TODO: remove cc-sdd and @byperover/cipher if not using Claude Code
RUN npm install -g aws-cdk
RUN npm install -g cc-sdd@latest
RUN npm install -g cspell
RUN npm install -g dprint
RUN npm install -g tsx
RUN npm install -g @biomejs/biome
RUN npm install -g @byterover/cipher

# install other packages
RUN curl -LO https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_amd64.deb
RUN apt-get install -y ./git-delta_0.18.2_amd64.deb
