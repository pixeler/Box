# مغز دوم — سند محصول و معماری فنی (v1)

> این سند برای اجرای گام‌به‌گام توسط یک AI Coding Assistant (مثل Claude Code) نوشته شده.
> هر فاز باید کامل و تست‌شده باشه قبل از رفتن به فاز بعدی. اگه تصمیمی نامشخصه، به‌جای حدس زدن، سوال بپرس.

---

## ۱. چشم‌انداز و فلسفه‌ی محصول

یک ابزار «مغز دوم» دیجیتال، الهام‌گرفته از بولت جورنال کاغذی، برای افرادی که ADHD دارن یا در مدیریت تسک/توجه مشکل دارن.

**اصول طراحی که هرگز نباید نقض بشن:**

1. **Capture-first** — نقطه‌ی ورود همیشه یه باکس خالیه، نه یه فرم ساخت‌یافته. کاربر اول می‌ریزه بیرون، بعد سیستم structure می‌ده.
2. **هیچ‌چیز گم نمی‌شه** — هیچ حذف واقعی‌ای در سطح UI وجود نداره؛ فقط تغییر state (باز → انجام‌شده/رهاشده/منتقل‌شده). موارد قدیمی به‌صورت خودکار (نه با یادآوریِ مزاحم) دوباره جلوی چشم میان.
3. **AI/پارسر همیشه قابل رد کردنه** — هیچ تبدیل خودکاری قطعی نیست؛ کاربر همیشه یه تپ فاصله داره از رد کردن یا اصلاح یه پیشنهاد.
4. **حداقل بار شناختی** — هیچ صفحه‌ای نباید هم‌زمان بیش از چیزی که لازمه نشون بده. جمع‌شدگی (collapse) پیش‌فرضه، نه باز بودن.
5. **Local-first مثل Obsidian** — اپ باید کاملاً آفلاین کار کنه. سینک/بک‌آپ همیشه اختیاریه، نه پیش‌فرض.

---

## ۲. مدل داده

### موجودیت‌های اصلی

| موجودیت | توضیح |
|---|---|
| `Entry` | ورودی خام (متن/صدا/عکس) — لایه‌ی پایه، هیچ‌وقت حذف نمی‌شه |
| `Task` | کار قابل انجام، از یک Entry استخراج می‌شه |
| `Event` | چیز زمان‌دار (تقویمی) |
| `Note` | یادداشت/ایده (یک نوع واحد، با فیلد `type: note \| idea`) |
| `Habit` | عادت تکرارشونده (از طراحی اولیه‌ی خودت) |
| `Tag` | برچسب، manual یا AI-suggested |
| `Relation` | ارتباط بین دو Entry (برای گراف آینده) |

### Schema (TypeScript interfaces)

```ts
interface Entry {
  id: string;
  raw_text?: string;
  raw_audio_url?: string;
  raw_image_url?: string;
  source: "text" | "voice" | "image";
  created_at: string; // ISO
  processed: boolean; // آیا پارس/طبقه‌بندی شده؟
}

type ItemStatus = "open" | "done" | "dropped" | "migrated";

interface Task {
  id: string;
  entry_id: string | null; // null یعنی مستقیم ساخته شده، نه از dump
  title: string;
  description?: string;
  status: ItemStatus;
  due_date?: string; // تاریخ شمسی ISO
  priority?: 1 | 2 | 3; // ! / !! / !!!
  tag_ids: string[];
  recurrence_rule?: string; // RRULE-like string
  migrated_from_id?: string; // زنجیره‌ی تاریخچه‌ی migrate
  created_at: string;
  updated_at: string;
}

interface EventItem {
  id: string;
  entry_id: string | null;
  title: string;
  start_at: string;
  end_at?: string;
  tag_ids: string[];
  created_at: string;
  updated_at: string;
}

interface Note {
  id: string;
  entry_id: string | null;
  type: "note" | "idea";
  title: string;
  body: string;
  tag_ids: string[];
  created_at: string;
  updated_at: string;
}

interface Habit {
  id: string;
  title: string;
  recurrence_rule: string;
  log: { date: string; done: boolean }[];
  created_at: string;
}

interface Tag {
  id: string;
  name: string;
  source: "manual" | "ai";
}

interface Relation {
  id: string;
  entry_id_1: string;
  entry_id_2: string;
  relation_type: "shared_tag" | "manual_link" | "ai_suggested";
  created_at: string;
}
```

### قانون‌های مهم روی state

- `dropped` یعنی soft-delete — همیشه در جستجو و آرشیو قابل بازیابیه.
- `migrated` یعنی یه نسخه‌ی جدید با تاریخ جدید ساخته شده و رکورد قدیمی به‌عنوان تاریخچه می‌مونه (`migrated_from_id`).
- هیچ عملیات DELETE واقعی در دیتابیس برای Task/Event/Note وجود نداره در فاز ۱.

---

## ۳. Quick-add syntax (پارسر مبتنی بر regex)

موقع تایپ در باکس کپچر، این الگوها inline تشخیص داده و به‌صورت chip قابل تایید/رد نشون داده می‌شن:

| الگو | تشخیص | مثال |
|---|---|---|
| کلمات زمانی: امروز، فردا، پس‌فردا، نام روز هفته، `ساعت N` | تاریخ/ساعت → Event یا due_date | «فردا ساعت ۳ دکتر» |
| `!` `!!` `!!!` | اولویت ۱/۲/۳ | «تماس با علی !!» |
| `#کلمه` | تگ | «خرید نون #خانه» |
| `@نام` | شخص/کانتکست (به‌عنوان تگ خاص) | «ایمیل به @سارا» |
| «هر روز»، «هر هفته»، «هر [نام روز]» | recurrence_rule | «هر روز ورزش» |
| فعل امری/مصدر کاری در ابتدای جمله (بخر، تماس بگیر، باید...) | سیگنال Task | |
| نبود فعل کاری، لحن توصیفی | سیگنال Note/Idea (پیش‌فرض) | |

**رفتار پیش‌فرض:** اگه هیچ الگویی تشخیص داده نشه → Note. تبدیل به Task/Event فقط با تایید صریح کاربر (تپ روی chip) یا دستور صریح در متن.

---

## ۴. فیلتر، سورت و جستجو (مشخصات دقیق)

### نوار فیلتر (بالای صفحه‌ی روز/لیست)

- **فیلتر بر اساس نوع:** چندانتخابی بین Task / Event / Note / Idea / Reminder (chip toggle، shadcn `ToggleGroup` یا `Badge` قابل‌کلیک)
- **فیلتر بر اساس بازه‌ی زمانی:** پریست‌های «امروز، این هفته، این ماه، امسال» + امکان انتخاب بازه‌ی دلخواه با `Calendar` (shadcn)
- **حرکت بین روزها:** فلش راست/چپ برای روز قبل/بعد + تپ روی تاریخ برای باز کردن ماه‌نمای کامل و پرش به هر روز

### سورت

گزینه‌ها: تاریخ سررسید، تاریخ ایجاد، اولویت، الفبایی — انتخاب کاربر در `localStorage`/دیتابیس محلی ذخیره و به‌عنوان پیش‌فرض بعدی استفاده بشه.

### جستجو

- جستجوی آنی سمت کلاینت (کاملاً آفلاین) — کتابخونه‌ی پیشنهادی: `MiniSearch` یا `FlexSearch` (سبک، بدون نیاز به سرور)
- ایندکس روی: `raw_text` ی Entry + `title`/`body` هر آیتم مشتق‌شده
- UI: کامپوننت `Command` از shadcn (شبیه Cmd+K)، نتایج گروه‌بندی‌شده بر اساس نوع

---

## ۵. معماری فنی

### Stack

| لایه | تکنولوژی |
|---|---|
| Frontend | React + TypeScript + Vite |
| استایل/کامپوننت | Tailwind CSS + shadcn/ui |
| PWA | `vite-plugin-pwa` (service worker + manifest) |
| ذخیره‌سازی محلی (وب) | IndexedDB از طریق Dexie.js |
| ذخیره‌سازی محلی (دسکتاپ، فاز بعد) | SQLite از طریق `tauri-plugin-sql` |
| جستجو | MiniSearch (client-side, in-memory index ساخته‌شده از دیتای محلی) |
| تاریخ شمسی | `jalaali-js` یا `dayjs` + پلاگین jalali |
| فونت | Vazirmatn (یا فونت فارسی مشابه با پشتیبانی خوب RTL) |

### چرا بدون بک‌اند سرور؟

چون معماری local-first می‌خوایم (مثل Obsidian): همه‌چیز روی دستگاه کاربره، بدون نیاز به سرور یا حساب کاربری برای کارکردن. این هم حریم خصوصی رو تضمین می‌کنه، هم هزینه‌ی زیرساخت رو صفر می‌کنه، هم دقیقاً همون حسی رو می‌ده که خواستی.

### لایه‌ی انتزاعی ذخیره‌سازی (Repository Pattern) — حیاتی‌ترین تصمیم معماری

باید از **روز اول** یه اینترفیس واحد برای دسترسی به داده تعریف بشه، نه استفاده‌ی مستقیم از Dexie در کامپوننت‌ها. دلیلش دقیقاً همون نیازیه که خودت گفتی: بعداً می‌خوای همین PWA رو به اپ ویندوز (احتمالاً با Tauri) تبدیل کنی، و اونجا باید از SQLite بومی استفاده کنی نه IndexedDB.

```ts
interface TaskRepository {
  create(task: Omit<Task, "id" | "created_at" | "updated_at">): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task>;
  getById(id: string): Promise<Task | null>;
  list(filter: TaskFilter): Promise<Task[]>;
  // هیچ‌وقت delete واقعی — فقط status رو به dropped تغییر بده
}
```

- فاز ۱ (PWA): پیاده‌سازی این اینترفیس با Dexie/IndexedDB
- فاز بعد (دسکتاپ با Tauri): همون اینترفیس، پیاده‌سازی جدید با `tauri-plugin-sql` (SQLite) — کامپوننت‌های UI و منطق بیزنس هیچ تغییری نمی‌کنن

### سینک و بک‌آپ

**اصل کلی:** سینک همیشه اختیاری و opt-in هست؛ اپ همیشه باید ۱۰۰٪ بدون سینک هم کار کنه.

1. **بک‌آپ دستی (همیشه در دسترس، فاز ۱):** دکمه‌ی «برون‌بری» که کل دیتابیس رو به یه فایل JSON (یا SQLite) دانلود می‌کنه؛ دکمه‌ی «درون‌بری» برای بازگردانی. دقیقاً مثل export/import ولت Obsidian.
2. **سینک با S3-compatible storage (فاز پیشرفته، اختیاری):**
   - کاربر خودش bucket/credentials رو وارد می‌کنه (هیچ سروری بین کاربر و S3 نیست)
   - استراتژی conflict resolution: **last-write-wins بر اساس `updated_at`** برای هر رکورد به‌صورت جدا (نه کل فایل) — ساده‌ترین و قابل‌اعتمادترین روش برای MVP؛ CRDT یا merge پیچیده‌تر رو فعلاً نیازی نیست پیاده کنیم
   - اگه تضاد واقعی رخ بده (هر دو طرف هم‌زمان ویرایش شدن)، به کاربر نشون داده بشه، نه silent overwrite

---

## ۶. رودمپ اجرا (فاز به فاز)

> هر فاز باید مستقل قابل تست باشه. به فاز بعد نرو تا فاز فعلی کامل کار کنه.

### فاز ۰ — پایه‌ریزی
- [ ] راه‌اندازی Vite + React + TS + Tailwind + shadcn/ui
- [ ] تعریف schema و interfaceهای TypeScript (بخش ۲)
- [ ] پیاده‌سازی Repository pattern با Dexie (IndexedDB)
- [ ] تنظیم RTL + فونت فارسی + jalaali-js

### فاز ۱ — کپچر و صفحه‌ی امروز (MVP هسته‌ای)
- [ ] باکس کپچر بالای صفحه (فقط متن)
- [ ] پارسر regex (جدول بخش ۳) + نمایش chip پیشنهادی قابل تایید/رد
- [ ] صفحه‌ی «امروز»: استریم واحد Task/Event/Note با نشانگر رنگی نوع
- [ ] منطق resurfacing: تسک باز قدیمی‌تر از N روز → ردیف جمع‌شده‌ی «باقی‌مانده‌ها»
- [ ] حرکت بین روزها (فلش + تپ روی تاریخ)

### فاز ۲ — فیلتر، سورت، جستجو
- [ ] نوار فیلتر (نوع + بازه‌ی زمانی)
- [ ] ماه‌نمای کامل برای پرش به هر روز (shadcn Calendar)
- [ ] گزینه‌های سورت
- [ ] جستجوی آنی با MiniSearch

### فاز ۳ — تگ و ارتباطات (سبک)
- [ ] تگ‌گذاری دستی (`#تگ` در متن یا ورودی جدا)
- [ ] جدول `Relation` پر بشه از تگ‌های مشترک
- [ ] پنل «مرتبط با...» در صفحه‌ی جزئیات هر آیتم (بدون UI گراف بصری)

### فاز ۴ — ریویو (اختیاری، off by default)
- [ ] خلاصه‌ی هفتگی: تعداد انجام‌شده، باز مونده، ایده‌هایی که هیچ‌وقت تبدیل نشدن

### فاز ۵ — لایه‌ی AI (اختیاری، بعد از اعتبارسنجی MVP)
- [ ] ورودی صدا و عکس
- [ ] لایه‌ی دوم طبقه‌بندی با مدل قوی‌تر (async، بعد از ثبت entry)
- [ ] جستجوی معنایی (embedding-based)

### فاز ۶ — بک‌آپ و سینک
- [ ] Export/Import دستی (JSON کامل)
- [ ] سینک اختیاری با S3-compatible storage

### فاز ۷ — بسته‌بندی دسکتاپ (Windows با Tauri)
- [ ] پیاده‌سازی Repository interface با `tauri-plugin-sql` (SQLite)
- [ ] بیلد Tauri برای ویندوز — بدون تغییر در UI/منطق بیزنس

---

## ۷. چیزهایی که عمداً از MVP بیرون گذاشته شده (Non-goals برای v1)

- نمای گراف بصری کامل (فقط جدول relations در دیتابیس، بدون UI)
- طبقه‌بندی خودکار با AI (فاز ۵)
- آنالیتیکس/نمودار streak برای عادت‌ها
- چند-کاربره بودن یا collaboration
- هرگونه بک‌اند سروری اجباری

## ۸. معیار تکمیل فاز ۱ (Definition of Done)

- تبدیل از dump به Task با حداکثر ۲ تپ ممکنه
- اپ کاملاً بدون اینترنت کار می‌کنه (zero network calls)
- بستن/رفرش مرورگر هیچ‌وقت باعث از دست رفتن یه entry نمی‌شه
- هیچ عملیات DELETE واقعی روی Task/Event/Note وجود نداره
