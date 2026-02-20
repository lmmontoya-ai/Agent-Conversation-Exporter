# ACE: Agent Conversation Exporter

[![CI](https://github.com/lmmontoya-ai/Agent-Conversation-Exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/lmmontoya-ai/Agent-Conversation-Exporter/actions/workflows/ci.yml)
[![Release](https://github.com/lmmontoya-ai/Agent-Conversation-Exporter/actions/workflows/release.yml/badge.svg)](https://github.com/lmmontoya-ai/Agent-Conversation-Exporter/actions/workflows/release.yml)

A macOS-first Electron app that exports Codex Desktop/CLI conversations to clean, structured Markdown. Ready to share, archive, or publish.

## Installation

> **Note:** ACE is not notarized with Apple. macOS will block it on first launch.

1. Download the latest `.dmg` from [Releases](https://github.com/lmmontoya-ai/Agent-Conversation-Exporter/releases).
2. Drag **ACE** into Applications.
3. If blocked, open **System Settings > Privacy & Security > Open Anyway**.

Or from Terminal:

```bash
xattr -cr "/Applications/ACE: Agent Conversation Exporter.app"
```

## Features

- Session scan from `~/.codex/sessions`, `~/.codex/archived_sessions`, and `~/.codex/history.jsonl`
- Clean and develop export modes
- Export to file, copy to clipboard, batch export
- Guided onboarding
- Responsive UI with resizable panes
- Reduced-motion support

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

## Release

Tag-based releases are fully automated through GitHub Actions.

See `docs/releasing.md`.

## Project Structure

```text
src/main        Electron main process and services
src/preload     Secure IPC bridge (window.codexExporter)
src/shared      Shared types + contracts
src/renderer    React UI and state
tests/          Unit and integration tests
```

## Governance

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## Privacy

All processing is local. No conversation data leaves your machine.
