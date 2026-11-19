# Contributing

1. `npm install`
2. `npm run typecheck && npm test` must pass.
3. Try your change with `npm run dev:dry` before a real sweep.

Rules of the road:

- **Never delete user data.** Files are moved, never removed (the only removal is the original after a verified cross-drive copy).
- Put logic in `src/core` (pure, unit-tested); keep Electron code in `src/main` thin.
- New user-visible text goes in `src/core/i18n.ts` for both `en` and `tr`.
- Don't write to the real desktop in tests; use temp folders (or `DESKSWEEP_DESKTOP` / `DESKSWEEP_USERDATA` for app-level runs).
