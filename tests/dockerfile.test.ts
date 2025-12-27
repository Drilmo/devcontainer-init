import { describe, test, expect } from "bun:test";
import { generateDockerfile } from "../src/generators/dockerfile";
import type { DevcontainerConfig } from "../src/types";

const baseConfig: DevcontainerConfig = {
  runtime: "node-pnpm",
  runtimeVersion: "20",
  timezone: "Europe/Paris",
  ports: [3000],
  enableFirewall: false,
  claudeMode: "none",
  extensions: [],
};

describe("generateDockerfile", () => {
  describe("Node.js runtime", () => {
    test("should use correct Node base image", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("FROM node:20");
    });

    test("should use specified Node version", () => {
      const config: DevcontainerConfig = { ...baseConfig, runtimeVersion: "22" };
      const result = generateDockerfile(config);
      expect(result).toContain("FROM node:22");
    });

    test("should install pnpm for node-pnpm runtime", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("npm install -g pnpm");
      expect(result).not.toContain("bun.sh/install");
    });

    test("should install bun for node-bun runtime", () => {
      const bunConfig: DevcontainerConfig = { ...baseConfig, runtime: "node-bun" };
      const result = generateDockerfile(bunConfig);
      expect(result).toContain("bun.sh/install");
      expect(result).not.toContain("npm install -g pnpm");
    });

    test("should use node user", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("USER node");
      expect(result).toContain("ARG USERNAME=node");
    });
  });

  describe("Python runtime", () => {
    const pythonConfig: DevcontainerConfig = { ...baseConfig, runtime: "python", runtimeVersion: "3.12" };

    test("should use correct Python base image", () => {
      const result = generateDockerfile(pythonConfig);
      expect(result).toContain("FROM python:3.12");
    });

    test("should use vscode user", () => {
      const result = generateDockerfile(pythonConfig);
      expect(result).toContain("ARG USERNAME=vscode");
      expect(result).toContain("USER vscode");
    });

    test("should install Python tools", () => {
      const result = generateDockerfile(pythonConfig);
      expect(result).toContain("pip install --user poetry black pylint pytest");
    });
  });

  describe("Claude CLI", () => {
    test("should install Claude CLI when claudeMode is local", () => {
      const claudeConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "local" };
      const result = generateDockerfile(claudeConfig);
      expect(result).toContain("npm install -g @anthropic-ai/claude-code");
      expect(result).toContain('alias cc="claude --dangerously-skip-permissions"');
    });

    test("should install Claude CLI when claudeMode is fresh", () => {
      const freshConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "fresh" };
      const result = generateDockerfile(freshConfig);
      expect(result).toContain("npm install -g @anthropic-ai/claude-code");
    });

    test("should not install Claude CLI when claudeMode is none", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).not.toContain("@anthropic-ai/claude-code");
      expect(result).not.toContain("alias cc=");
    });

    test("should install Node.js for Claude CLI in Python runtime", () => {
      const pythonClaudeConfig: DevcontainerConfig = {
        ...baseConfig,
        runtime: "python",
        runtimeVersion: "3.12",
        claudeMode: "local",
      };
      const result = generateDockerfile(pythonClaudeConfig);
      expect(result).toContain("nodesource.com/setup_20.x");
      expect(result).toContain("npm install -g @anthropic-ai/claude-code");
    });
  });

  describe("Firewall", () => {
    test("should include firewall packages when enabled", () => {
      const firewallConfig: DevcontainerConfig = { ...baseConfig, enableFirewall: true };
      const result = generateDockerfile(firewallConfig);
      expect(result).toContain("iptables");
      expect(result).toContain("ipset");
      expect(result).toContain("iproute2");
      expect(result).toContain("dnsutils");
      expect(result).toContain("aggregate");
    });

    test("should not include firewall packages when disabled", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).not.toContain("iptables");
      expect(result).not.toContain("ipset");
    });

    test("should setup firewall script when enabled", () => {
      const firewallConfig: DevcontainerConfig = { ...baseConfig, enableFirewall: true };
      const result = generateDockerfile(firewallConfig);
      expect(result).toContain("COPY init-firewall.sh /usr/local/bin/");
      expect(result).toContain("chmod +x /usr/local/bin/init-firewall.sh");
      expect(result).toContain("sudoers.d/node-firewall");
    });
  });

  describe("Common features", () => {
    test("should install zsh with plugins", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("zsh-in-docker");
      expect(result).toContain("ENV SHELL=/bin/zsh");
    });

    test("should setup command history persistence", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("mkdir /commandhistory");
      expect(result).toContain("HISTFILE=/commandhistory/.bash_history");
    });

    test("should set DEVCONTAINER env variable", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("ENV DEVCONTAINER=true");
    });

    test("should install common dev tools", () => {
      const result = generateDockerfile(baseConfig);
      expect(result).toContain("git");
      expect(result).toContain("fzf");
      expect(result).toContain("gh");
      expect(result).toContain("jq");
    });
  });
});
