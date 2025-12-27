import type { DevcontainerConfig } from "../types";

export function generateDevcontainerJson(config: DevcontainerConfig): Record<string, unknown> {
  const user = config.runtime === "python" ? "vscode" : "node";

  const json: Record<string, unknown> = {
    name: "${localWorkspaceFolderBasename}",
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
