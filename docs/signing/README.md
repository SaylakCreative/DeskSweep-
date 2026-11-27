# Code signing setup (maintainers)

> **Status: dormant.** The SignPath Foundation application was declined (November 2026), so releases are currently unsigned and the `sign` job in `release.yml` is skipped. This guide is kept for when a certificate becomes available. Note: a signed installer changes its SHA-512, so `latest.yml` must be regenerated after signing or the in-app updater will reject the download.

DeskSweep uses the free [SignPath Foundation](https://signpath.org) open source program. See the public [code signing policy](../../CODE_SIGNING_POLICY.md).

## One-time setup, after SignPath approves the project

1. In SignPath, add the **GitHub.com** trusted build system to the organization and link it to the DeskSweep project.
2. Add an artifact configuration from [`artifact-configuration.xml`](artifact-configuration.xml) and note its slug.
3. Create an API token for a user with *submitter* permission on the signing policy.
4. In the GitHub repository, *Settings → Secrets and variables → Actions*:
   - Secret `SIGNPATH_API_TOKEN`
   - Variables `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG`, `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`
   - Variable `SIGNPATH_ENABLED` = `true` (turns on the `sign` job in `release.yml`)
5. Add the attribution to the README and release notes, as the program requires:
   *Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).*
   Also update the status line in `CODE_SIGNING_POLICY.md`.

## Releasing

1. Bump `version` in `package.json` and commit.
2. `git tag v0.2.0 && git push origin v0.2.0`
3. The **Release** workflow builds the installer, signs it (once enabled; a signing request waits for manual approval in SignPath), and publishes the GitHub release. Versions starting with `v0.` are marked as pre-releases.

Without `SIGNPATH_ENABLED` the workflow still publishes the release, with an unsigned installer.
