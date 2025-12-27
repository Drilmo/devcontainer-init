import { describe, test, expect } from "bun:test";
import { generateFirewallScript, getFirewallDomains } from "../src/generators/firewall";
import type { DevcontainerConfig } from "../src/types";

const baseConfig: DevcontainerConfig = {
  runtime: "node-pnpm",
  runtimeVersion: "20",
  timezone: "Europe/Paris",
  ports: [3000],
  enableFirewall: true,
  claudeMode: "none",
  extensions: [],
};

describe("getFirewallDomains", () => {
  test("should always include GitHub domains", () => {
    const domains = getFirewallDomains(baseConfig);
    expect(domains).toContain("api.github.com");
    expect(domains).toContain("github.com");
  });

  test("should include npm registry for Node runtime", () => {
    const domains = getFirewallDomains(baseConfig);
    expect(domains).toContain("registry.npmjs.org");
  });

  test("should include npm registry for node-bun runtime", () => {
    const bunConfig: DevcontainerConfig = { ...baseConfig, runtime: "node-bun" };
    const domains = getFirewallDomains(bunConfig);
    expect(domains).toContain("registry.npmjs.org");
  });

  test("should include PyPI for Python runtime", () => {
    const pythonConfig: DevcontainerConfig = { ...baseConfig, runtime: "python" };
    const domains = getFirewallDomains(pythonConfig);
    expect(domains).toContain("pypi.org");
    expect(domains).toContain("files.pythonhosted.org");
    expect(domains).not.toContain("registry.npmjs.org");
  });

  test("should include Anthropic domains when claudeMode is local", () => {
    const claudeConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "local" };
    const domains = getFirewallDomains(claudeConfig);
    expect(domains).toContain("api.anthropic.com");
    expect(domains).toContain("sentry.io");
    expect(domains).toContain("statsig.anthropic.com");
    expect(domains).toContain("statsig.com");
  });

  test("should include Anthropic domains when claudeMode is fresh", () => {
    const freshConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "fresh" };
    const domains = getFirewallDomains(freshConfig);
    expect(domains).toContain("api.anthropic.com");
  });

  test("should not include Anthropic domains when claudeMode is none", () => {
    const domains = getFirewallDomains(baseConfig);
    expect(domains).not.toContain("api.anthropic.com");
    expect(domains).not.toContain("sentry.io");
  });
});

describe("generateFirewallScript", () => {
  test("should generate valid bash script", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toStartWith("#!/bin/bash");
    expect(script).toContain("set -euo pipefail");
  });

  test("should include domain whitelist", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain('"api.github.com"');
    expect(script).toContain('"github.com"');
    expect(script).toContain('"registry.npmjs.org"');
  });

  test("should setup iptables rules", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("iptables -F");
    expect(script).toContain("iptables -P INPUT DROP");
    expect(script).toContain("iptables -P OUTPUT DROP");
  });

  test("should allow DNS traffic", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("iptables -A OUTPUT -p udp --dport 53 -j ACCEPT");
    expect(script).toContain("iptables -A INPUT -p udp --sport 53 -j ACCEPT");
  });

  test("should allow SSH traffic", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT");
  });

  test("should allow localhost traffic", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("iptables -A INPUT -i lo -j ACCEPT");
    expect(script).toContain("iptables -A OUTPUT -o lo -j ACCEPT");
  });

  test("should create ipset for allowed domains", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("ipset create allowed-domains hash:net");
    expect(script).toContain("ipset add allowed-domains");
  });

  test("should fetch GitHub IP ranges", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("curl -s https://api.github.com/meta");
    expect(script).toContain('jq -r \'(.web + .api + .git)[]\'');
  });

  test("should detect and allow host network", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("HOST_IP=$(ip route | grep default");
    expect(script).toContain('iptables -A INPUT -s "$HOST_NETWORK"');
    expect(script).toContain('iptables -A OUTPUT -d "$HOST_NETWORK"');
  });

  test("should preserve Docker DNS rules", () => {
    const script = generateFirewallScript(baseConfig);
    expect(script).toContain("DOCKER_DNS_RULES");
    expect(script).toContain("127\\.0\\.0\\.11");
  });

  test("should include Anthropic domains when Claude is enabled", () => {
    const claudeConfig: DevcontainerConfig = { ...baseConfig, claudeMode: "local" };
    const script = generateFirewallScript(claudeConfig);
    expect(script).toContain('"api.anthropic.com"');
    expect(script).toContain('"statsig.anthropic.com"');
  });

  test("should include PyPI domains for Python", () => {
    const pythonConfig: DevcontainerConfig = { ...baseConfig, runtime: "python" };
    const script = generateFirewallScript(pythonConfig);
    expect(script).toContain('"pypi.org"');
    expect(script).toContain('"files.pythonhosted.org"');
  });
});
