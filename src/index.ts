#!/usr/bin/env bun
import { input, select, checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { mkdir } from "fs/promises";
import { join, resolve } from "path";
import type { DevcontainerConfig, Runtime, ClaudeMode } from "./types";
import { generateDevcontainerJson, generateDockerfile, generateFirewallScript } from "./generators";

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

  await generateDevcontainerFiles(resolvedPath, config);

  console.log(chalk.green.bold("\n  .devcontainer créé avec succès !\n"));
  console.log(chalk.gray(`  Chemin: ${devcontainerPath}\n`));
  console.log(chalk.blue("  Pour démarrer:"));
  console.log(chalk.white(`    code ${resolvedPath}`));
  console.log(chalk.white("    # Puis 'Reopen in Container'\n"));
}

async function generateDevcontainerFiles(targetPath: string, config: DevcontainerConfig) {
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

main().catch((error) => {
  console.error(chalk.red("Erreur:"), error.message);
  process.exit(1);
});
