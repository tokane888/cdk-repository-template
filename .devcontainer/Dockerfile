FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# install npm packages
RUN npm install -g cc-sdd@latest
RUN npm install -g cspell
RUN npm install -g dprint
# Install cipher with retry logic to handle network issues
# RUN npm install -g @byterover/cipher || npm install -g @byterover/cipher || npm install -g @byterover/cipher
RUN npm install -g @byterover/cipher

# install other packages
RUN curl -LO https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_amd64.deb
RUN apt-get install -y ./git-delta_0.18.2_amd64.deb
