import type { DevcontainerConfig } from "../types";

export function generateDockerfile(config: DevcontainerConfig): string {
  const isNode = config.runtime.startsWith("node");
  const isPython = config.runtime === "python";
  const user = isPython ? "vscode" : "node";

  const firewallPackages = config.enableFirewall
    ? ` \\
  iptables \\
  ipset \\
  iproute2 \\
  dnsutils \\
  aggregate`
    : "";

  const zshSetup = `# Install zsh with plugins
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v\${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \\
  -p git \\
  -p fzf \\
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \\
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \\
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \\
  -x`;

  const claudeAliases =
    config.claudeMode !== "none"
      ? `
# Add Claude CLI aliases
RUN echo "" >> ~/.zshrc && \\
    echo "# Claude CLI aliases" >> ~/.zshrc && \\
    echo 'alias cc="claude --dangerously-skip-permissions"' >> ~/.zshrc && \\
    echo 'alias ccc="claude --dangerously-skip-permissions -c"' >> ~/.zshrc
`
      : "";

  const firewallSetup = config.enableFirewall
    ? `
# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \\
  echo "${user} ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/${user}-firewall && \\
  chmod 0440 /etc/sudoers.d/${user}-firewall
USER ${user}
`
    : "";

  if (isNode) {
    const packageManager =
      config.runtime === "node-pnpm"
        ? `# Install pnpm
RUN npm install -g pnpm
`
        : `# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$PATH:/home/node/.bun/bin
`;

    const claudeCli =
      config.claudeMode !== "none"
        ? `# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code
${claudeAliases}`
        : "";

    return `FROM node:${config.runtimeVersion}

ARG TZ
ENV TZ="$TZ"

# Install basic development tools
RUN apt-get update && apt-get install -y --no-install-recommends \\
  less \\
  git \\
  procps \\
  sudo \\
  fzf \\
  zsh \\
  man-db \\
  unzip \\
  gnupg2 \\
  gh \\
  jq \\
  nano \\
  vim${firewallPackages} \\
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \\
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \\
  && mkdir /commandhistory \\
  && touch /commandhistory/.bash_history \\
  && chown -R $USERNAME /commandhistory

ENV DEVCONTAINER=true

# Create workspace and config directories
RUN mkdir -p /workspace /home/node/.claude && \\
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

USER node

# Set up npm global
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Shell config
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano

${zshSetup}

${packageManager}
${claudeCli}
${firewallSetup}`;
  }

  if (isPython) {
    const claudeCli =
      config.claudeMode !== "none"
        ? `# Install Node.js for Claude CLI
USER root
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \\
  apt-get install -y nodejs && \\
  npm install -g @anthropic-ai/claude-code
USER vscode
${claudeAliases}`
        : "";

    return `FROM python:${config.runtimeVersion}

ARG TZ
ENV TZ="$TZ"

# Install basic development tools
RUN apt-get update && apt-get install -y --no-install-recommends \\
  less \\
  git \\
  procps \\
  sudo \\
  fzf \\
  zsh \\
  man-db \\
  unzip \\
  gnupg2 \\
  gh \\
  jq \\
  nano \\
  vim \\
  curl${firewallPackages} \\
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create non-root user
ARG USERNAME=vscode
RUN useradd -ms /bin/zsh $USERNAME && \\
  echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Persist bash history
RUN mkdir /commandhistory && \\
  touch /commandhistory/.bash_history && \\
  chown -R $USERNAME /commandhistory

ENV DEVCONTAINER=true

# Create workspace and config directories
RUN mkdir -p /workspace /home/vscode/.claude && \\
  chown -R vscode:vscode /workspace /home/vscode/.claude

WORKDIR /workspace

USER vscode

# Shell config
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano

${zshSetup}

# Install Python tools
RUN pip install --user poetry black pylint pytest

${claudeCli}
${firewallSetup}`;
  }

  return "";
}
