# ACE: Agent Conversation Exporter

A macOS-first Electron app that exports Codex Desktop/CLI conversations to clean, structured Markdown. Ready to share, archive, or publish.

## Installation

> **Note:** ACE is not notarized with Apple. macOS will block it on first launch — follow the step below to open it.

1. Download the latest `.dmg` from the [Releases](https://github.com/lmmontoya-ai/Agent-Conversation-Exporter/releases) page
2. Open the `.dmg` and drag **ACE** into your Applications folder
3. On first launch, macOS will say the app "can't be opened because the developer cannot be verified"
4. **Fix:** Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to ACE

Or from the terminal:
```bash
xattr -cr "/Applications/ACE: Agent Conversation Exporter.app"
```

## Features

- **Session sources** — scans `~/.codex/sessions`, `~/.codex/archived_sessions`, and `~/.codex/history.jsonl`
- **Export modes**
  - `Clean` — readable user + assistant transcript (`## User`, `## Assistant`)
  - `Develop` — full event/tool timeline for debugging traces
- **Export workflows** — single file, batch export, or copy to clipboard
- **Onboarding** — guided first-run setup to locate your sessions
- **Responsive** — adapts from desktop to mobile with drawer navigation
- **Resizable panes** with persisted widths
- **Reduced-motion** support

## Stack

- Electron + electron-vite + React + TypeScript
- Radix UI primitives + Tailwind v4
- Framer Motion
- Zustand state management
- Vitest + Testing Library

## Development

```bash
npm install
npm run dev
```

```bash
npm run build        # typecheck + build
npm run build:mac    # build .dmg
npm run typecheck
npm run test
```

## Project Structure

```
src/main        Electron main process and export services
src/preload     Secure IPC bridge (window.codexExporter)
src/shared      Shared types and IPC channel contracts
src/renderer    React UI — shell, state, components
tests/          Unit and integration tests
```

## Notes

- All processing is local. No data leaves your machine.
- `history.jsonl` sessions are marked partial — only lightweight records are available from that source.
