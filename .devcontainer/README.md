# ShelfLife Dev Container

This devcontainer provides a consistent development environment for the ShelfLife app.

## Features

- **Node.js 20**: Latest LTS version
- **pnpm**: Fast, disk space efficient package manager
- **Git & GitHub CLI**: Version control and GitHub integration
- **VS Code Extensions**: 
  - ESLint & Prettier for code quality
  - Tailwind CSS IntelliSense
  - Prisma support for database
  - Docker tools
  - GitHub Copilot

## Ports

- `3000`: Next.js default development server
- `5173`: Vite development server (if using React/Vue directly)
- `8080`: Alternative backend/API port

## Usage

1. Open this folder in VS Code
2. When prompted, click "Reopen in Container"
3. Wait for the container to build and initialize
4. Start developing!

## SSH Keys

Your local SSH keys are mounted read-only for git operations with private repositories.
