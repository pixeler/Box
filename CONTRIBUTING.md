# Contributing to Box

Thanks for wanting to improve Box. This guide covers the workflow so your
change lands quickly.

## Before you start

- For a bug, open an issue with the **Bug report** template (or comment on an
  existing one) before writing code, unless the fix is a one-liner.
- For a feature, open a **Feature request** first. Box is deliberately
  small and local-first, so not every good idea fits the product.
- Security problems go to [SECURITY.md](SECURITY.md), never the issue tracker.

## Development setup

```bash
pnpm install
cp .env.example .env   # optional: add Supabase values for cloud sync
pnpm dev
```

Node 20+ and pnpm 10+ are expected. The web app runs at
`http://localhost:5173`.

Useful entry points:

| Path | What lives there |
| --- | --- |
| `src/components/editor/` | BlockNote schema, custom blocks, slash menu |
| `src/components/notebook/` | Notes list, note modal, templates |
| `src/repositories/` | Data access; Dexie implementations |
| `src/lib/` | Sync, search, export, Jalali helpers, desktop bridge |
| `electron/` | Desktop shell and IPC bridge |

## Code conventions

- **TypeScript is strict** and unused locals/params fail the build. No `any`
  unless it is at a real system boundary, and no lint suppressions to silence a
  real bug.
- **Conventional commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`),
  one logical change per commit.
- **Persian first**: UI copy is Persian and the layout is RTL. New UI must be
  checked in both `dir="rtl"` and LTR-neutral contexts (numbers, dates, code).
- **Local first**: a core flow must work with the network off. Cloud calls are
  an enhancement, never a requirement.
- Keep the boot path small. Heavy views are lazy-loaded on purpose; do not
  import them from the shell.
- Do not add a dependency for something a few lines of code can do. If a
  dependency is truly needed, say why in the pull request.

## Pull request checklist

1. `pnpm build` passes (it runs `tsc` and the Vite build).
2. The change was exercised in the app — web is fine for most UI work; say
   which target you tested.
3. No unrelated formatting churn in files you touched.
4. `CHANGELOG.md` has an entry under **Unreleased** for user-visible changes.

## Maintainer release process

1. Update `version` in `package.json` and move the `CHANGELOG.md` entries into a
   dated section.
2. `git commit -am "chore(release): vX.Y.Z"`.
3. `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin master --tags`.
4. The **Release** workflow builds the Windows portable exe and the macOS
   `dmg`/`zip`, then attaches them to the GitHub release. Android APKs are built
   locally with `pnpm android:build`.
