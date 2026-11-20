# Code signing policy

DeskSweep is free and open source (MIT). This page describes how its Windows installer is built and signed.

**Status:** code signing is being set up through the [SignPath Foundation](https://signpath.org) open source program. Until the application is approved, released installers are **not signed**; once it is, this page and the README are updated and releases are signed automatically.

## How releases are built and signed

- Installers are built only by the GitHub Actions workflow [`release.yml`](.github/workflows/release.yml), from the tagged source in this repository. Nothing is built or signed on a developer machine.
- The workflow uploads the unsigned installer and submits it to SignPath for signing. A signing request is **approved manually** by an approver before it is signed.
- The signed installer is then attached to the matching [GitHub release](https://github.com/SaylakCreative/DeskSweep-/releases). Product name and version in the installer metadata come from `package.json`.

## Team roles

DeskSweep currently has a single maintainer, who holds all roles. This list is updated when the team grows.

| Role | Responsibility | Members |
|---|---|---|
| **Authors** | Trusted to change the source code without additional review | [SaylakCreative](https://github.com/SaylakCreative) |
| **Reviewers** | Review every change from non-committers (pull requests) | [SaylakCreative](https://github.com/SaylakCreative) |
| **Approvers** | Approve each signing request, i.e. decide whether a release may be signed | [SaylakCreative](https://github.com/SaylakCreative) |

All team members use multi-factor authentication on GitHub and SignPath.

## Privacy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

DeskSweep contains no telemetry, analytics, crash reporting or automatic update checks. Its settings and undo journal stay in `%APPDATA%\desksweep` on your computer. Full details: [Privacy policy](PRIVACY.md).

## Reporting problems

If you believe a signed DeskSweep build is malicious or violates this policy, please [open an issue](https://github.com/SaylakCreative/DeskSweep-/issues).
