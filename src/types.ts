export type Runtime = "node-pnpm" | "node-bun" | "python";
export type ClaudeMode = "none" | "local" | "fresh";

export interface DevcontainerConfig {
  runtime: Runtime;
  runtimeVersion: string;
  timezone: string;
  ports: number[];
  enableFirewall: boolean;
  claudeMode: ClaudeMode;
  extensions: string[];
}
