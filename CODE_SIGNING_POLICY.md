# Code signing and release integrity

*Last updated: 2026-11-24.*

**DeskSweep installers are not code-signed.** An application to the free SignPath Foundation program was declined, and a paid certificate is not in place. This page explains what that means for you and how releases are built.

## What this means on Windows

- **SmartScreen** may show "Windows protected your PC / unrecognized app" when you run a downloaded installer. Choose **More info → Run anyway**.
- **Smart App Control** (an optional Windows 11 protection, on by default on some new PCs) blocks unsigned apps it has never seen before, with no "run anyway" option. If it is on, Windows reports that an Application Control policy blocked the file. The options are to switch Smart App Control off in *Windows Security → App & browser control → Smart App Control* (Microsoft documents that turning it back on can require resetting Windows, depending on your version), or to [run DeskSweep from source](README.md) (`npm start`), which works because it uses the stock, well-known Electron binary.

## How releases are built

- Installers are built only by the GitHub Actions workflow [`release.yml`](.github/workflows/release.yml), from the tagged source in this repository, and published as a [GitHub release](https://github.com/SaylakCreative/DeskSweep-/releases). Nothing is built on a developer machine for release.
- Each release includes `latest.yml`, which lists the installer's **SHA-512 checksum**. The in-app updater refuses a download whose checksum does not match. You can verify a manual download the same way: `Get-FileHash -Algorithm SHA512 <file>` and compare it with `latest.yml` (base64-encoded there).
- The maintainer's GitHub account is the root of trust for updates. It uses multi-factor authentication.

## Signing in the future

If a certificate becomes available, releases will be signed and this page updated. The release workflow already contains a dormant signing job (see [docs/signing](docs/signing/README.md)).

## Privacy

See the [Privacy policy](PRIVACY.md): DeskSweep collects no data; its only network access is the optional update check.

## Reporting problems

If you believe a DeskSweep build is malicious or violates this policy, please [open an issue](https://github.com/SaylakCreative/DeskSweep-/issues).
