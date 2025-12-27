import { describe, test, expect } from "bun:test";
import { generateDevcontainerJson } from "../src/generators/devcontainer-json";
import type { DevcontainerConfig } from "../src/types";

const baseConfig: DevcontainerConfig = {
  runtime: "node-pnpm",
  runtimeVersion: "20",
  timezone: "Europe/Paris",
  ports: [3000],
  enableFirewall: false,
  claudeMode: "none",
  extensions: ["dbaeumer.vscode-eslint"],
};

describe("generateDevcontainerJson", () => {
  test("should generate basic structure", () => {
    const result = generateDevcontainerJson(baseConfig);

    expect(result.name).toBe("${localWorkspaceFolderBasename}");
    expect(result.remoteUser).toBe("node");
    expect(result.workspaceFolder).toBe("/${localWorkspaceFolderBasename}");
    expect(result.forwardPorts).toEqual([3000]);
  });

  test("should use vscode user for Python runtime", () => {
    const pythonConfig: DevcontainerConfig = { ...baseConfig, runtime: "python" };
    const result = generateDevcontainerJson(pythonConfig);

    expect(result.remoteUser).toBe("vscode");
  });

  test("should add firewall capabilities when enabled", () => {
    const firewallConfig: DevcontainerConfig = { ...baseConfig, enableFirewall: true };
    const result = generateDevcontainerJson(firewallConfig);

    const runArgs = result.runArgs as string[];
    expect(runArgs).toContain("--cap-add=NET_ADMIN");
    expect(runArgs).toContain("--cap-add=NET_RAW");
    expect(result.postCreateCommand).toBe("sudo /usr/local/bin/init-firewall.sh");
  });

  test("should not add firewall capabilities when disabled", () => {
    const result = generateDevcontainerJson(baseConfig);

    const runArgs = result.runArgs as string[];
    expect(runArgs).not.toContain("--cap-add=NET_ADMIN");
    expect(result.postCreateCommand).toBeUndefined();
  });

  test("should add Claude mounts when claudeMode is local", () => {
    const claudeConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "local" };
    const result = generateDevcontainerJson(claudeConfig);

    const mounts = result.mounts as string[];
    expect(mounts.some((m) => m.includes(".claude,target=/home/node/.claude"))).toBe(true);
    expect(mounts.some((m) => m.includes(".claude.json"))).toBe(true);

    const containerEnv = result.containerEnv as Record<string, string>;
    expect(containerEnv.CLAUDE_CONFIG_DIR).toBe("/home/node/.claude");
  });

  test("should not add Claude mounts when claudeMode is fresh", () => {
    const freshConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "fresh" };
    const result = generateDevcontainerJson(freshConfig);

    const mounts = result.mounts as string[];
    expect(mounts.some((m) => m.includes(".claude,target"))).toBe(false);
  });

  test("should add Node-specific settings for node runtime", () => {
    const result = generateDevcontainerJson(baseConfig);

    const containerEnv = result.containerEnv as Record<string, string>;
    expect(containerEnv.NODE_OPTIONS).toBe("--max-old-space-size=4096");

    const settings = (result.customizations as { vscode: { settings: Record<string, unknown> } }).vscode.settings;
    expect(settings["editor.defaultFormatter"]).toBe("esbenp.prettier-vscode");
  });

  test("should add Python-specific settings for python runtime", () => {
    const pythonConfig: DevcontainerConfig = { ...baseConfig, runtime: "python" };
    const result = generateDevcontainerJson(pythonConfig);

    const settings = (result.customizations as { vscode: { settings: Record<string, unknown> } }).vscode.settings;
    expect(settings["python.defaultInterpreterPath"]).toBe("/usr/local/bin/python");
    expect(settings["editor.defaultFormatter"]).toBe("ms-python.black-formatter");
  });

  test("should configure multiple ports correctly", () => {
    const multiPortConfig: DevcontainerConfig = { ...baseConfig, ports: [3000, 5432, 6379] };
    const result = generateDevcontainerJson(multiPortConfig);

    expect(result.forwardPorts).toEqual([3000, 5432, 6379]);

    const portsAttributes = result.portsAttributes as Record<string, { label: string }>;
    expect(portsAttributes["3000"].label).toBe("Application");
    expect(portsAttributes["5432"].label).toBe("Port 5432");
    expect(portsAttributes["6379"].label).toBe("Port 6379");
  });

  test("should include provided extensions", () => {
    const extConfig: DevcontainerConfig = {
      ...baseConfig,
      extensions: ["ext1", "ext2", "ext3"],
    };
    const result = generateDevcontainerJson(extConfig);

    const extensions = (result.customizations as { vscode: { extensions: string[] } }).vscode.extensions;
    expect(extensions).toEqual(["ext1", "ext2", "ext3"]);
  });

  test("should use custom timezone", () => {
    const tzConfig: DevcontainerConfig = { ...baseConfig, timezone: "America/New_York" };
    const result = generateDevcontainerJson(tzConfig);

    const buildArgs = (result.build as { args: { TZ: string } }).args;
    expect(buildArgs.TZ).toBe("${localEnv:TZ:America/New_York}");
  });
});
