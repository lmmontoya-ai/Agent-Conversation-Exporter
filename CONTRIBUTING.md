# Contributing

Thanks for contributing to ACE.

## Development setup

```bash
npm install
npm run dev
```

## Before opening a PR

Run the same checks as CI:

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

## Workflow

1. Open an issue first for non-trivial changes.
2. Keep PRs focused and small.
3. Link the issue in the PR description (`Closes #123`).
4. Include screenshots/recordings for UI changes.

## Coding expectations

- Prefer clear and explicit code over clever abstractions.
- Keep behavior changes covered by tests.
- Do not introduce unrelated refactors in the same PR.

## Releases

Maintainers create releases by pushing a `v*` tag.

See `docs/releasing.md` for details.
