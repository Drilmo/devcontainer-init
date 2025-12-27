# devcontainer-init

CLI interactive pour initialiser des devcontainers VS Code avec support pour Node.js, Python et Claude Code.

## Installation

### Via npm (recommandé)

```bash
# Installation globale
npm install -g devcontainer-init

# Ou utilisation directe avec npx
npx devcontainer-init
```

### Via bun

```bash
# Installation globale
bun install -g devcontainer-init

# Ou utilisation directe avec bunx
bunx devcontainer-init
```

### Depuis les sources

```bash
git clone https://github.com/Drilmo/devcontainer-init.git
cd devcontainer-init
bun install
bun link
```

## Utilisation

```bash
cd /chemin/vers/mon-projet
devcontainer-init
```

La CLI pose les questions suivantes :

1. **Répertoire cible** - Par défaut le répertoire courant (`.`)
2. **Runtime** - Node.js (pnpm), Node.js (bun), ou Python
3. **Version** - Node 18/20/22 ou Python 3.10/3.11/3.12
4. **Claude Code** - Oui/Non, puis Local ou Frais
5. **Timezone** - Par défaut Europe/Paris
6. **Ports** - Ports à exposer (3000 pour Node, 8000 pour Python)
7. **Firewall** - Whitelist réseau (GitHub, npm/PyPI, Anthropic)
8. **Extensions VS Code** - Sélection multiple

## Fichiers générés

```
.devcontainer/
├── devcontainer.json   # Configuration VS Code
├── Dockerfile          # Image Docker
└── init-firewall.sh    # Script firewall (optionnel)
```

## Fonctionnalités

- **Nom dynamique** : Le container utilise `${localWorkspaceFolderBasename}` pour s'adapter au projet
- **Claude Code local** : Monte `~/.claude` pour garder ta config et ton historique
- **Firewall intelligent** : Whitelist dynamique selon le runtime et Claude
- **Extensions filtrées** : Propose uniquement les extensions pertinentes pour le runtime choisi

## Développement

```bash
# Mode watch
bun run dev

# Tests
bun test

# Type check
bun run typecheck

# Build pour npm
bun run build:npm
```

## License

MIT
