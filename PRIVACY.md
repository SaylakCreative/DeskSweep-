# Privacy policy

*Last updated: 2026-11-20. Türkçe özet aşağıda.*

DeskSweep is a free, open-source desktop app (MIT license). **It does not collect, store off your computer, or transmit any personal data.**

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

## What stays on your computer

| Data | Where | Purpose |
|---|---|---|
| Your settings (`config.json`) | `%APPDATA%\desksweep` | Remember language, theme, rules, backup folder, schedule |
| Undo journal (`journal.json`) | `%APPDATA%\desksweep` | Remember which files were moved where, so a sweep can be undone |
| Swept files | The backup folder you choose (default: `Desktop\DeskSweep`) | The files DeskSweep moved for you |

DeskSweep reads the **names, extensions and modification dates** of items on your desktop to decide what to sweep, and asks Windows Explorer (through a small local PowerShell script, read-only) where each desktop icon is drawn so the robot can drive to it. None of this information leaves your computer.

## No network activity

DeskSweep has **no** telemetry, analytics, crash reporting, advertising, accounts, or automatic update checks. The app displays only its own bundled pages and loads no remote content. You can read every line of the source code in this repository to verify this.

## Third-party components

- **Electron** (Chromium and Node.js) is used only to show DeskSweep's own local windows. DeskSweep does not use any Chromium online services.
- The **installer** (NSIS) makes no network connections.

## Downloading DeskSweep

Releases are hosted on GitHub. When you visit GitHub or download a release, [GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) applies; DeskSweep itself receives nothing from that.

## Changes and contact

Changes to this policy are tracked in this repository's history. Questions or concerns: [open an issue](https://github.com/SaylakCreative/DeskSweep-/issues).

---

## Türkçe özet

DeskSweep hiçbir kişisel veri **toplamaz ve internete göndermez**. Ayarların ve geri alma günlüğün yalnızca bilgisayarında (`%APPDATA%\desksweep`) durur; süpürülen dosyalar seçtiğin yedek klasöründe kalır. Uygulamada telemetri, analiz, reklam, hesap ya da otomatik güncelleme denetimi yoktur ve yalnızca kendi içindeki sayfaları gösterir. Masaüstündeki öğelerin adı, uzantısı ve değiştirilme tarihi ile simge konumları yalnızca ne süpüreceğine karar vermek için yerelde okunur.
