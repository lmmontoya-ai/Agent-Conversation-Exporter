# Releasing ACE

## 1. Prepare release commit

- Update version in `package.json`.
- Ensure CI is green on `main`.

## 2. Create and push tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 3. GitHub Actions release workflow

The release workflow will:
- build macOS (`.dmg`), Windows (`.exe`), Linux (`.AppImage`, `.deb`)
- generate `SHA256SUMS.txt`
- publish all files to the GitHub Release

## 4. Post-release validation

- Download each artifact from the release page.
- Verify checksums with `SHA256SUMS.txt`.
- Smoke-test install on at least one machine per platform.
