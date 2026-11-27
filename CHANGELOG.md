# Changelog

All notable changes to DeskSweep. Versions below 1.0 are betas.

## [0.2.0] — 2026-11-27

### Added
- **Updates inside the app.** About 20 seconds after start and once a day DeskSweep checks GitHub for a new release. If there is one it asks first; on **Install** it downloads it, verifies its SHA-512 checksum and installs it silently, then restarts. Switch it off or check by hand in Settings → General → Updates, or from the tray. If Windows refuses to start the installer (Smart App Control), DeskSweep keeps running and offers the download page instead.
- **Skin system.** The robot's look is now a swappable "skin" (`src/shared/skins.ts`), shared by the desktop overlay and the settings preview. Adding a skin is one object, no engine changes.
- **Winter / New Year skin.** Santa hat, falling snow, sweeps turn files into little gift boxes with a burst of confetti, and the robot says "ho ho ho!".
- **Look setting** (Settings → Robot): *Seasonal*, *Classic* or *Winter*, with a live animated preview. *Seasonal* (the default) switches to Winter from 15 December to 5 January.
- **Charging dock.** The robot now fades in sitting on a small dock, "wakes up" for a moment and rolls out of it, and returns to it when it is done. The dock goes in the corner (above the taskbar) that is farthest from your icons, so it never hides them.
- **Installer language chooser.** The setup wizard now asks for its language (English / Türkçe), pre-selecting your system language.
- "Starting the robot…" message in Settings while the robot gets ready.
- Unit tests for the season window, skin resolution, dock placement, config BOM handling and English/Turkish string parity.

### Changed
- **The robot appears much sooner after Preview / Sweep now** (about 0.4 s instead of 1.5 s or more): loading the page, reading icon positions and sending the window behind other apps now run at the same time, and the helper scripts cache their compiled code.
- Long trips (to and from the dock) cruise up to twice as fast; short hops between icons keep your speed setting.

### Fixed
- **A sweep could freeze when an app covered the whole desktop.** Chromium paused the animation of a fully covered window, so nothing was swept. The overlay now keeps running while covered, and the sweep logic no longer depends on animation frames.
- **The privacy policy no longer claims DeskSweep never connects to the network**: the update check (GitHub only, can be switched off) is now described in detail.
- **A `config.json` saved with a UTF-8 BOM** (older Notepad, some scripts) was treated as invalid and all settings were silently reset. BOMs are now accepted.

## [0.1.0] — 2026-11-19

First public beta: robot overlay on the real desktop icons, rule-based sweeping into a backup folder you choose, undo, dry-run, English/Turkish UI, dark/light themes, tray app, automation, Windows installer.
