#!/usr/bin/env bun
import { input, select, checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { mkdir } from "fs/promises";
import { join, resolve, basename } from "path";

type Runtime = "node-pnpm" | "node-bun" | "python";
type ClaudeMode = "none" | "local" | "fresh";

interface DevcontainerConfig {
  containerName: string;
  runtime: Runtime;
  runtimeVersion: string;
  timezone: string;
  ports: number[];
  enableFirewall: boolean;
  claudeMode: ClaudeMode;
  extensions: string[];
}

const RUNTIME_OPTIONS = [
  { value: "node-pnpm" as Runtime, name: "Node.js avec pnpm" },
  { value: "node-bun" as Runtime, name: "Node.js avec bun" },
  { value: "python" as Runtime, name: "Python" },
];

const NODE_VERSIONS = [
  { value: "22", name: "Node 22 (Latest LTS)" },
  { value: "20", name: "Node 20 (LTS)" },
  { value: "18", name: "Node 18 (Maintenance)" },
];

const PYTHON_VERSIONS = [
  { value: "3.12", name: "Python 3.12" },
  { value: "3.11", name: "Python 3.11" },
  { value: "3.10", name: "Python 3.10" },
];

const BASE_EXTENSIONS = [
  { name: "ESLint", value: "dbaeumer.vscode-eslint", checked: true, runtime: ["node-pnpm", "node-bun"] },
  { name: "Prettier", value: "esbenp.prettier-vscode", checked: true, runtime: ["node-pnpm", "node-bun"] },
  { name: "Python", value: "ms-python.python", checked: true, runtime: ["python"] },
  { name: "Pylance", value: "ms-python.vscode-pylance", checked: true, runtime: ["python"] },
  { name: "Claude Code", value: "anthropic.claude-code", checked: true, runtime: ["node-pnpm", "node-bun", "python"] },
  { name: "Conventional Commits", value: "vivaxy.vscode-conventional-commits", checked: true, runtime: ["node-pnpm", "node-bun", "python"] },
  { name: "Git Graph", value: "mhutchie.git-graph", checked: true, runtime: ["node-pnpm", "node-bun", "python"] },
];

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function writeFile(path: string, content: string): Promise<void> {
  await Bun.write(path, content);
}

async function main() {
  console.log(chalk.blue.bold("\n  Devcontainer Initializer\n"));
  console.log(chalk.gray("  Configurez votre environnement de développement\n"));

  const targetDir = await input({
    message: "Répertoire cible",
    default: ".",
  });

  const resolvedPath = resolve(targetDir);

  if (!(await exists(resolvedPath))) {
    const create = await confirm({
      message: `Le répertoire ${resolvedPath} n'existe pas. Le créer ?`,
      default: true,
    });
    if (create) {
      await mkdir(resolvedPath, { recursive: true });
    } else {
      console.log(chalk.red("Annulé."));
      process.exit(1);
    }
  }

  const devcontainerPath = join(resolvedPath, ".devcontainer");
  if (await exists(devcontainerPath)) {
    const overwrite = await confirm({
      message: chalk.yellow("Un .devcontainer existe déjà. Écraser ?"),
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.red("Annulé."));
      process.exit(1);
    }
  }

  const runtime = await select({
    message: "Runtime / Environnement",
    choices: RUNTIME_OPTIONS,
  });

  const runtimeVersion = await select({
    message: runtime === "python" ? "Version Python" : "Version Node.js",
    choices: runtime === "python" ? PYTHON_VERSIONS : NODE_VERSIONS,
    default: runtime === "python" ? "3.12" : "20",
  });

  const useClaude = await confirm({
    message: "Utiliser Claude Code ?",
    default: true,
  });

  let claudeMode: ClaudeMode = "none";
  if (useClaude) {
    claudeMode = await select({
      message: "Configuration Claude",
      choices: [
        { value: "local" as ClaudeMode, name: "Local - Monter ~/.claude (garde ta config, historique, API key)" },
        { value: "fresh" as ClaudeMode, name: "Frais - Nouvelle instance (config vierge)" },
      ],
    });
  }

  const containerName = await input({
    message: "Nom du container (affiché dans VS Code)",
    default: runtime === "python" ? "Python Dev" : "Node Dev",
  });

  const timezone = await input({
    message: "Timezone",
    default: "Europe/Paris",
  });

  const defaultPorts = runtime === "python" ? "8000" : "3000";
  const portsInput = await input({
    message: "Ports à exposer (séparés par des virgules)",
    default: defaultPorts,
  });
  const ports = portsInput
    .split(",")
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => !isNaN(p));

  const enableFirewall = await confirm({
    message: "Activer le firewall (whitelist GitHub, npm/PyPI, Anthropic) ?",
    default: claudeMode !== "none",
  });

  const availableExtensions = BASE_EXTENSIONS.filter((ext) => ext.runtime.includes(runtime));

  const extensions = await checkbox({
    message: "Extensions VS Code",
    choices: availableExtensions.map(({ name, value, checked }) => ({ name, value, checked })),
  });

  const config: DevcontainerConfig = {
    containerName,
    runtime,
    runtimeVersion,
    timezone,
    ports,
    enableFirewall,
    claudeMode,
    extensions,
  };

  console.log(chalk.blue("\nGénération du .devcontainer...\n"));

  await generateDevcontainer(resolvedPath, config);

  console.log(chalk.green.bold("\n  .devcontainer créé avec succès !\n"));
  console.log(chalk.gray(`  Chemin: ${devcontainerPath}\n`));
  console.log(chalk.blue("  Pour démarrer:"));
  console.log(chalk.white(`    code ${resolvedPath}`));
  console.log(chalk.white("    # Puis 'Reopen in Container'\n"));
}

async function generateDevcontainer(targetPath: string, config: DevcontainerConfig) {
  const devcontainerPath = join(targetPath, ".devcontainer");
  await mkdir(devcontainerPath, { recursive: true });

  const devcontainerJson = generateDevcontainerJson(config);
  await writeFile(join(devcontainerPath, "devcontainer.json"), JSON.stringify(devcontainerJson, null, 2) + "\n");
  console.log(chalk.gray(`  ✓ devcontainer.json`));

  const dockerfile = generateDockerfile(config);
  await writeFile(join(devcontainerPath, "Dockerfile"), dockerfile);
  console.log(chalk.gray(`  ✓ Dockerfile (${config.runtime} ${config.runtimeVersion})`));

  if (config.enableFirewall) {
    const firewallScript = generateFirewallScript(config);
    await writeFile(join(devcontainerPath, "init-firewall.sh"), firewallScript);
    console.log(chalk.gray(`  ✓ init-firewall.sh`));
  }
}

function generateDevcontainerJson(config: DevcontainerConfig) {
  const user = config.runtime === "python" ? "vscode" : "node";

  const json: Record<string, unknown> = {
    name: config.containerName,
    build: {
      dockerfile: "Dockerfile",
      args: {
        TZ: `\${localEnv:TZ:${config.timezone}}`,
      },
    },
    runArgs: [`--name=\${localWorkspaceFolderBasename}-devcontainer`],
    customizations: {
      vscode: {
        extensions: config.extensions,
        settings: {
          "editor.formatOnSave": true,
          "terminal.integrated.defaultProfile.linux": "zsh",
        },
      },
    },
    remoteUser: user,
    mounts: [`source=devcontainer-bashhistory-\${devcontainerId},target=/commandhistory,type=volume`],
    containerEnv: {} as Record<string, string>,
    workspaceMount: `source=\${localWorkspaceFolder},target=/\${localWorkspaceFolderBasename},type=bind,consistency=delegated`,
    workspaceFolder: `/\${localWorkspaceFolderBasename}`,
    forwardPorts: config.ports,
    portsAttributes: {} as Record<string, { label: string; onAutoForward: string }>,
  };

  if (config.enableFirewall) {
    (json.runArgs as string[]).unshift("--cap-add=NET_ADMIN", "--cap-add=NET_RAW");
    json.postCreateCommand = "sudo /usr/local/bin/init-firewall.sh";
  }

  if (config.claudeMode === "local") {
    (json.mounts as string[]).push(
      `source=\${localEnv:HOME}/.claude,target=/home/${user}/.claude,type=bind`,
      `source=\${localEnv:HOME}/.claude.json,target=/home/${user}/.claude.json,type=bind`
    );
    (json.containerEnv as Record<string, string>).CLAUDE_CONFIG_DIR = `/home/${user}/.claude`;
  }

  if (config.runtime.startsWith("node")) {
    (json.containerEnv as Record<string, string>).NODE_OPTIONS = "--max-old-space-size=4096";
    const settings = (json.customizations as { vscode: { settings: Record<string, unknown> } }).vscode.settings;
    settings["editor.defaultFormatter"] = "esbenp.prettier-vscode";
    settings["editor.codeActionsOnSave"] = { "source.fixAll.eslint": "explicit" };
  }

  if (config.runtime === "python") {
    const settings = (json.customizations as { vscode: { settings: Record<string, unknown> } }).vscode.settings;
    settings["python.defaultInterpreterPath"] = "/usr/local/bin/python";
    settings["editor.defaultFormatter"] = "ms-python.black-formatter";
  }

  config.ports.forEach((port, index) => {
    (json.portsAttributes as Record<string, { label: string; onAutoForward: string }>)[port.toString()] = {
      label: index === 0 ? "Application" : `Port ${port}`,
      onAutoForward: "notify",
    };
  });

  return json;
}

function generateDockerfile(config: DevcontainerConfig): string {
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

function generateFirewallScript(config: DevcontainerConfig): string {
  const domains = ["api.github.com", "github.com"];

  if (config.runtime.startsWith("node")) {
    domains.push("registry.npmjs.org");
  }

  if (config.runtime === "python") {
    domains.push("pypi.org", "files.pythonhosted.org");
  }

  if (config.claudeMode !== "none") {
    domains.push("api.anthropic.com", "sentry.io", "statsig.anthropic.com", "statsig.com");
  }

  const domainList = domains.map((d) => `"${d}"`).join(" ");

  return `#!/bin/bash
set -euo pipefail
IFS=$'\\n\\t'

# Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\\.0\\.0\\.11" || true)

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# Restore Docker DNS rules
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

# Allow DNS and localhost
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset
ipset create allowed-domains hash:net

# Fetch GitHub IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        continue
    fi
    ipset add allowed-domains "$cidr" 2>/dev/null || true
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Resolve allowed domains
for domain in ${domainList}; do
    echo "Resolving $domain..."
    ips=$(dig +short A "$domain" || true)
    while read -r ip; do
        if [[ "$ip" =~ ^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$ ]]; then
            ipset add allowed-domains "$ip" 2>/dev/null || true
        fi
    done < <(echo "$ips")
done

# Get host network
HOST_IP=$(ip route | grep default | cut -d" " -f3)
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\\.[0-9]*$/.0\\/24/")
echo "Host network: $HOST_NETWORK"

iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Set default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow only whitelisted domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

echo "Firewall configured successfully"
`;
}

main().catch((error) => {
  console.error(chalk.red("Erreur:"), error.message);
  process.exit(1);
});
