# Contributing

1. `npm install`
2. `npm run typecheck && npm test` must pass.
3. Try your change with `npm run dev:dry` before a real sweep.

## Adding a robot skin

Skins live in `src/shared/skins.ts`. A skin is one `Skin` object (body drawing, optional overlay such as a hat, optional scene effects such as snow, how a swept item flies into the robot). To add one:

1. Write the object and register it in the `skins` map.
2. Add its id to `SkinId`/`SkinPreference` (`src/core/types.ts`, `src/core/skins.ts`) and the picker in `src/settings/settings.ts`.
3. Add its name to both languages in `src/core/i18n.ts`.
4. Check it with `npm run capture` (writes screenshots and GIFs to `docs/images`).

Seasonal skins can hook into `resolveSkin` in `src/core/skins.ts`.

## Rules of the road

- **Never delete user data.** Files are moved, never removed (the only removal is the original after a verified cross-drive copy).
- Put logic in `src/core` (pure, unit-tested); keep Electron code in `src/main` thin.
- New user-visible text goes in `src/core/i18n.ts` for both `en` and `tr`.
- Don't write to the real desktop in tests; use temp folders (or `DESKSWEEP_DESKTOP` / `DESKSWEEP_USERDATA` for app-level runs).
