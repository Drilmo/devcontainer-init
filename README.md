# devcontainer-init

CLI interactive pour initialiser des devcontainers VS Code avec support pour Node.js, Python et Claude Code.

## Installation

```bash
# Cloner le repo
git clone https://github.com/jeremybeutin/devcontainer-init.git
cd devcontainer-init

# Installer les dépendances
bun install

# Lier globalement
bun link
```

## Utilisation

```bash
# Depuis n'importe quel répertoire
cd /chemin/vers/mon-projet
devcontainer-init
```

La CLI pose les questions suivantes :

1. **Répertoire cible** - Par défaut le répertoire courant (`.`)
2. **Runtime** - Node.js (pnpm), Node.js (bun), ou Python
3. **Version** - Node 18/20/22 ou Python 3.10/3.11/3.12
4. **Claude Code** - Oui/Non
5. **Configuration Claude** - Local (monte ~/.claude) ou Frais (instance vierge)
6. **Nom du container** - Affiché dans VS Code
7. **Timezone** - Par défaut Europe/Paris
8. **Ports** - Ports à exposer (3000 pour Node, 8000 pour Python)
9. **Firewall** - Whitelist réseau (GitHub, npm/PyPI, Anthropic)
10. **Extensions VS Code** - Sélection multiple

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

# Type check
bun run typecheck

# Build binaire standalone
bun run build
```

## License

MIT
