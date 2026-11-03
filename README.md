<p align="center">
  <img src="assets/logo.png" width="112" alt="Box" />
</p>

<h1 align="center">Box</h1>

<p align="center">
  <strong>A calm, offline-first second brain for notes, tasks, calendar and deep work.</strong><br />
  Persian-first (RTL) · local database · optional cloud sync · web, Windows, macOS and Android.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3b82f6.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.2.0-6b7280.svg" />
  <img alt="Platforms" src="https://img.shields.io/badge/platform-web%20%7C%20windows%20%7C%20macos%20%7C%20android-6b7280.svg" />
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" />
</p>

---

Box is a personal knowledge and focus workspace that treats your notes as
files, not as rows. Everything is stored locally first, so the app opens and
works with no connection; a single Supabase document per account carries your
data between devices when you ask it to.

It is not a SaaS. There is no account requirement, no telemetry and no server
in the middle of a note you are writing.

## Features

### Notes
- **Block editor** built on [BlockNote](https://www.blocknotejs.org/) — headings,
  checklists, tables, code, quotes, and a custom **bookmark block** that turns a
  pasted URL into a Notion-style link card with a favicon and page metadata.
- **Smart paste**: pasted HTML keeps its formatting instead of collapsing to
  plain text, and a naked URL on an empty line becomes a bookmark.
- **Templates** with their own icon, cover and colour, so a meeting note and a
  daily journal do not have to look alike.
- **Notebooks, folders and tags** with explorer-style grouping and sorting.
- **Note history**: every save keeps a version you can restore.
- **Export** to Markdown and PDF.

### Tasks
- Inbox plus project-style lists, priorities, due dates and repeats.
- **Kanban** and list views, with inline task blocks that live inside notes.
- Quick capture from anywhere with a global shortcut-friendly input.

### Calendar
- Jalali (Persian) calendar with month, week and day views.
- A **day stream** that merges notes, tasks and events into one timeline.

### Focus
- Pomodoro-style sessions with ambient soundscapes, a taskbar badge on Windows
  and a focus history you can actually learn from.

### Everywhere
- **PWA** for the browser, a **Windows/macOS desktop shell** (Electron) that
  ships frameless and fast, and an **Android** build via Capacitor.
- Themes (Claude dark/light first-class, plus Retro, Nord, Solarized and more).
- Full RTL layout with Persian typography (Dana + Darvish).

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 18, TypeScript (strict), Tailwind CSS 3, Radix UI, Mantine |
| Editor | BlockNote (ProseMirror) with custom blocks |
| Data | Dexie (IndexedDB) repositories, optional Supabase sync |
| Search | MiniSearch |
| Dates | `jalaali-js` for the Persian calendar |
| Build | Vite 6 |
| Shells | Electron 45 (desktop), Capacitor 8 (Android) |

## Getting started

Requirements: **Node 20+** and **pnpm 10+**.

```bash
git clone https://github.com/pixeler/Box.git
cd Box
pnpm install
cp .env.example .env      # then fill in the two Supabase values
pnpm dev                  # http://localhost:5173
```

Cloud sync is optional. Leave the Supabase values empty and the app runs fully
local; sign-in and multi-device sync stay disabled.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | no | Supabase project URL used for optional sync |
| `VITE_SUPABASE_ANON_KEY` | no | Public anon key (never a service-role key) |

Run the SQL in [`supabase_schema.sql`](supabase_schema.sql) in your own Supabase
project to create the `user_sync` table and its row-level-security policies.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck (`tsc`) + production web build |
| `pnpm preview` | Serve the production build |
| `pnpm desktop:dev` | Run the Electron shell against the local build |
| `pnpm desktop:dist` | Build the Windows portable executable |
| `pnpm android:build` | Sync Capacitor and assemble a release APK |

## Project layout

```
electron/        Desktop shell: window, IPC bridge, PDF export
android/         Capacitor Android project
src/
  components/    UI: editor, calendar, notebook, tasks, focus, shell
  repositories/  Data access (Dexie-backed, swappable)
  lib/           Sync, search, export, Jalali helpers, desktop bridge
  types/         Shared domain models
build/           App icons used by electron-builder
assets/          Repository artwork (not shipped in the app)
supabase_schema.sql
```

## Releases

Tags of the form `v*` build the desktop apps on GitHub Actions (Windows portable
`exe` and macOS `dmg`/`zip`) and attach them to the GitHub release. Android APKs
are built locally with `pnpm android:build`.

## Contributing

Bug reports, ideas and pull requests are welcome — start with
[CONTRIBUTING.md](CONTRIBUTING.md) and the issue templates. For anything
security related, please read [SECURITY.md](SECURITY.md) first.

## License

[MIT](LICENSE) © Mahdi Khodadadi

---

## فارسی

**Box** یک فضای کار شخصی و آفلاین‌محور است: یادداشت، کار، تقویم شمسی و
تمرکز، همه در یک برنامه با رابط راست‌به‌چپ. داده‌ها اول روی دستگاه خودت ذخیره
می‌شوند و همگام‌سازی ابری اختیاری است. برای اجرا:

```bash
pnpm install && cp .env.example .env && pnpm dev
```

بدون مقدارهای Supabase هم برنامه کامل و آفلاین کار می‌کند؛ فقط ورود و همگام‌سازی
غیرفعال می‌ماند. مشارکت و گزارش باگ خوش‌آمد است.
