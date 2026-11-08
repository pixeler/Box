<p align="center">
  <img src="assets/logo.png" width="112" alt="Box" />
</p>

<h1 align="center">Box</h1>

<p align="center">
  <strong>A calm, offline-first second brain for notes, tasks, calendar and deep work.</strong><br />
  Persian-first (RTL) · local database · optional cloud sync · web, Windows, macOS, Linux and Android.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3b82f6.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.3.0-6b7280.svg" />
  <img alt="Platforms" src="https://img.shields.io/badge/platform-web%20%7C%20windows%20%7C%20macos%20%7C%20linux%20%7C%20android-6b7280.svg" />
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
- **Table of contents** generated from the note's own headings, so long notes stay
  navigable, plus **note zoom** with a one-click reset.
- **Templates** with their own icon, cover and colour, so a meeting note and a
  daily journal do not have to look alike.
- **Notebooks, folders and tags** with explorer-style grouping and sorting.
- **Note history**: every save keeps a version you can restore.
- **Export** to Markdown and PDF.

### Tasks
- Inbox plus project-style lists, priorities, due dates and repeats.
- **One tasks surface**: today, week, month, year and *all tasks* behind a single
  header — the period title in the middle, the day/week/month/year/all pills on
  the right, and the list ↔ calendar/board switch on the left next to `+`.
  Week, month and year open as a calendar; *all tasks* opens as a kanban board.
- Inline task blocks that live inside notes, and quick capture from anywhere.

### Calendar
- Jalali (Persian) calendar with month, week and day views.
- A **day stream** that merges notes, tasks and events into one timeline.

### Focus
- Pomodoro-style sessions with ambient soundscapes, a taskbar badge on Windows
  and a focus history you can actually learn from.

### Everywhere
- **PWA** for the browser, a **Windows/macOS/Linux desktop shell** (Electron) that
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

Tags of the form `v*` run the **Release** workflow: the Windows portable `exe`,
the Linux `deb` and `AppImage`, and the macOS `dmg`/`zip` for x64 and arm64 are
built on GitHub Actions and attached to the GitHub release.

The Android APK is built locally with `pnpm android:build` and attached to the
release by hand. The workflow's Android job is currently broken on GitHub's
runner image, which refuses Gradle's own outbound connections, so the APK never
starts building there.

## Contributing

Bug reports, ideas and pull requests are welcome — start with
[CONTRIBUTING.md](CONTRIBUTING.md) and the issue templates. For anything
security related, please read [SECURITY.md](SECURITY.md) first.

## License

[MIT](LICENSE) © Mahdi Khodadadi

---

<div dir="rtl">

## فارسی

**جعبه (Box)** یک فضای کار شخصی و آفلاین‌محور است که با یادداشت‌ها مثل فایل
برخورد می‌کند، نه مثل ردیف‌های یک پایگاه‌داده. همه‌چیز اول روی دستگاه خودت ذخیره
می‌شود، پس برنامه بدون اینترنت باز می‌شود و کار می‌کند؛ یک سند Supabase برای هر
حساب، وقتی خودت بخواهی، داده را بین دستگاه‌ها جابه‌جا می‌کند.

این یک سرویس اشتراکی نیست: نه حساب اجباری، نه تحلیل رفتار، نه سروری وسط یادداشتی
که در حال نوشتنش هستی.

### قابلیت‌ها

#### یادداشت‌ها
- **ویرایشگر بلوک‌محور** روی [BlockNote](https://www.blocknotejs.org/): سرفصل،
  چک‌لیست، جدول، کد، نقل‌قول و یک **بلوک بوکمارک** اختصاصی که آدرس چسبانده‌شده را
  به کارت لینک شبیه نوشن، همراه فاوآیکون و متادیتای صفحه، تبدیل می‌کند.
- **چسباندن هوشمند**: HTML چسبانده‌شده قالب‌بندی‌اش را حفظ می‌کند و آدرس تنها روی
  یک خط خالی به بوکمارک تبدیل می‌شود.
- **فهرست مطالب** که از سرفصل‌های خود یادداشت ساخته می‌شود، و **زوم یادداشت** با
  بازنشانی یک‌کلیکی.
- **قالب‌ها** با آیکون، کاور و رنگ مستقل، تا یادداشت جلسه و دفتر روزانه یک‌شکل
  نباشند.
- **دفترچه‌ها، پوشه‌ها و برچسب‌ها** با گروه‌بندی و مرتب‌سازی به سبک فایل‌اکسپلورر.
- **تاریخچهٔ یادداشت**: هر ذخیره یک نسخه نگه می‌دارد که می‌توانی بازگردانی کنی.
- **خروجی** به Markdown و PDF.

#### کارها
- صندوق ورودی و فهرست‌های پروژه‌ای، با اولویت، سررسید و تکرار.
- **یک بخش واحد برای کارها**: امروز، هفته، ماه، سال و «همه کارها» پشت یک هدر —
  تیتر دوره در مرکز، پیل‌های روز/هفته/ماه/سال/همه سمت راست و سوییچ
  فهرست ↔ تقویم/تخته سمت چپ، کنار دکمهٔ `+`. هفته، ماه و سال با **تقویم** باز
  می‌شوند و «همه کارها» با **تخته (کانبان)**.
- بلوک کار درون یادداشت‌ها و ثبت سریع از هر جای برنامه.

#### تقویم
- تقویم **شمسی** با نمای ماه، هفته و روز.
- **جریان روز** که یادداشت‌ها، کارها و رویدادها را در یک تایم‌لاین ادغام می‌کند.

#### تمرکز
- جلسه‌های پومودورو با صداهای محیطی، نشان روی تسک‌بار ویندوز و تاریخچهٔ تمرکزی که
  واقعاً می‌شود از آن یاد گرفت.

#### همه‌جا
- **PWA** برای مرورگر، **پوستهٔ دسکتاپ** ویندوز/مک/لینوکس (Electron) که بدون قاب و
  سریع اجرا می‌شود، و نسخهٔ **اندروید** با Capacitor.
- تم‌های متعدد (Claude تیره/روشن به‌عنوان حالت اصلی، به‌همراه Retro، Nord،
  Solarized و بیشتر).
- چیدمان کامل راست‌به‌چپ با تایپوگرافی فارسی (دانا و درویش).

### پشتهٔ فناوری

| لایه | انتخاب |
| --- | --- |
| رابط کاربری | React 18، TypeScript (strict)، Tailwind CSS 3، Radix UI، Mantine |
| ویرایشگر | BlockNote (ProseMirror) با بلوک‌های اختصاصی |
| داده | مخزن‌های Dexie (IndexedDB)، همگام‌سازی اختیاری Supabase |
| جست‌وجو | MiniSearch |
| تاریخ | `jalaali-js` برای تقویم شمسی |
| بیلد | Vite 6 |
| پوسته‌ها | Electron 45 (دسکتاپ)، Capacitor 8 (اندروید) |

### شروع کار

نیازمندی: **Node 20+** و **pnpm 10+**.

```bash
git clone https://github.com/pixeler/Box.git
cd Box
pnpm install
cp .env.example .env      # مقدارهای Supabase را پر کن
pnpm dev                  # http://localhost:5173
```

همگام‌سازی ابری اختیاری است. اگر مقدارهای Supabase را خالی بگذاری، برنامه کاملاً
محلی کار می‌کند و فقط ورود و همگام‌سازی چنددستگاهی غیرفعال می‌ماند.

#### متغیرهای محیطی

| متغیر | اجباری | کاربرد |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | نه | آدرس پروژهٔ Supabase برای همگام‌سازی اختیاری |
| `VITE_SUPABASE_ANON_KEY` | نه | کلید عمومی anon (هرگز کلید service-role) |

SQL موجود در [`supabase_schema.sql`](supabase_schema.sql) را در پروژهٔ Supabase خودت
اجرا کن تا جدول `user_sync` و سیاست‌های امنیتی سطح‌ردیف ساخته شوند.

#### دستورها

| دستور | کار |
| --- | --- |
| `pnpm dev` | سرور توسعهٔ Vite |
| `pnpm build` | بررسی تایپ (`tsc`) + بیلد تولیدی وب |
| `pnpm preview` | سرو بیلد تولیدی |
| `pnpm desktop:dev` | اجرای پوستهٔ Electron روی بیلد محلی |
| `pnpm desktop:dist` | ساخت فایل اجرایی قابل‌حمل ویندوز |
| `pnpm android:build` | همگام‌سازی Capacitor و ساخت APK |

### ساختار پروژه

```
electron/        پوستهٔ دسکتاپ: پنجره، پل IPC، خروجی PDF
android/         پروژهٔ اندروید Capacitor
src/
  components/    رابط کاربری: ویرایشگر، تقویم، یادداشت، کارها، تمرکز، پوسته
  repositories/  دسترسی به داده (روی Dexie، قابل تعویض)
  lib/           همگام‌سازی، جست‌وجو، خروجی، توابع شمسی، پل دسکتاپ
  types/         مدل‌های دامنه
build/           آیکون‌های برنامه برای electron-builder
assets/          تصاویر مخزن (در برنامه ارسال نمی‌شوند)
supabase_schema.sql
```

### انتشار نسخه‌ها

تگ‌های `v*` ورک‌فلوی **Release** را اجرا می‌کنند: نسخهٔ قابل‌حمل ویندوز (`exe`)،
بسته‌های لینوکس (`deb` و `AppImage`) و مک (`dmg`/`zip` برای x64 و arm64) روی
GitHub Actions ساخته و به ریلیز گیت‌هاب ضمیمه می‌شوند.

APK اندروید به‌صورت محلی با `pnpm android:build` ساخته و دستی به ریلیز اضافه می‌شود؛
قدم اندروید در ورک‌فلو فعلاً روی ایمیج رانر گیت‌هاب به مشکل شبکهٔ JVM می‌خورد و
پیش از شروع بیلد شکست می‌خورد.

### مشارکت

گزارش باگ، ایده و پول‌ریکوئست خوش‌آمد است — با [CONTRIBUTING.md](CONTRIBUTING.md)
و قالب‌های ایشو شروع کن. برای موضوع‌های امنیتی اول
[SECURITY.md](SECURITY.md) را بخوان.

### مجوز

[MIT](LICENSE) © مهدی خدادادی

</div>
