# Privacy policy

*Last updated: 2026-11-24. Türkçe özet aşağıda.*

DeskSweep is a free, open-source desktop app (MIT license). **It does not collect your data, and it contains no telemetry, analytics, crash reporting, advertising or accounts.** Your files, file names and settings never leave your computer.

The **only** network access DeskSweep has is an optional **update check** (see below).

## What stays on your computer

| Data | Where | Purpose |
|---|---|---|
| Your settings (`config.json`) | `%APPDATA%\DeskSweep` | Remember language, theme, rules, backup folder, schedule, update preference |
| Undo journal (`journal.json`) | `%APPDATA%\DeskSweep` | Remember which files were moved where, so a sweep can be undone |
| Update state (`updater.json` and a random local ID) | `%APPDATA%\DeskSweep` | Remember which version you postponed. The random ID is used only on your computer (for staged roll-outs) and is never sent anywhere |
| A downloaded update (only after you click Install) | `%LOCALAPPDATA%\desksweep-updater` | The installer, kept until it has been run |
| Swept files | The backup folder you choose (default: `Desktop\DeskSweep`) | The files DeskSweep moved for you |

DeskSweep reads the **names, extensions and modification dates** of items on your desktop to decide what to sweep, and asks Windows Explorer (through a small local PowerShell script, read-only) where each desktop icon is drawn so the robot can drive to it. None of this information leaves your computer.

## The update check (on by default, can be switched off)

About 20 seconds after it starts and then once a day, DeskSweep asks **github.com** for the latest DeskSweep release information (the same data you see on the project's Releases page). You can also press **Check now**, or switch the check off in **Settings → General → Updates**.

- **What GitHub receives:** the usual details of any web request, including your IP address. GitHub's [privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) applies to that.
- **What DeskSweep sends:** nothing else. No identifiers, no usage data, no file names or settings.
- **If a newer version exists,** DeskSweep asks you first. Nothing is downloaded or installed unless you click **Install**. The download comes from the project's GitHub release and is verified against the SHA-512 checksum published with it before it is run.
- **If you switch the check off,** DeskSweep makes no network connections at all.

## Third-party components

- **Electron** (Chromium and Node.js) is used only to show DeskSweep's own local windows. DeskSweep does not use any Chromium online services and loads no remote content.
- **electron-updater** (open source) performs the update check and download described above.
- The **installer** (NSIS) makes no network connections.

## Downloading DeskSweep

Releases are hosted on GitHub. When you visit GitHub or download a release by hand, GitHub's privacy statement applies; DeskSweep itself receives nothing from that.

## Changes and contact

Changes to this policy are tracked in this repository's history. Questions or concerns: [open an issue](https://github.com/SaylakCreative/DeskSweep-/issues).

---

## Türkçe özet

DeskSweep verilerini **toplamaz**; telemetri, analiz, çökme raporu, reklam ya da hesap yoktur. Dosyaların, dosya adların ve ayarların bilgisayarından çıkmaz. Ayarların ve geri alma günlüğün yalnızca bilgisayarında (`%APPDATA%\DeskSweep`) durur; süpürülen dosyalar seçtiğin yedek klasöründe kalır.

DeskSweep'in tek ağ erişimi isteğe bağlı **güncelleme denetimidir**: açılışından kısa süre sonra ve günde bir kez github.com'a bağlanıp yeni sürüm bilgisini ister, GitHub IP adresini görür, DeskSweep başka hiçbir şey göndermez. Yeni sürüm varsa önce sana sorar; **Kur**'a basmadıkça hiçbir şey indirilmez ya da kurulmaz, indirilen dosyanın SHA-512 özeti doğrulanır. **Ayarlar → Genel → Güncellemeler** bölümünden kapatabilirsin; kapatırsan DeskSweep hiç ağ bağlantısı kurmaz.
