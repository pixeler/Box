import React, { useEffect, useState } from 'react';
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiCloseLine,
  RiMoonLine,
  RiSunLine,
  RiAddLine,
  RiDeleteBinLine,
} from '@remixicon/react';
import { toPersianDigits, getTodayJalaliKey } from '@/lib/jalali';
import { THEMES, type ThemeId } from '@/lib/theme';
import { taskRepo } from '@/repositories';

export const ONBOARDING_DONE_KEY = 'box:onboarding-done';

interface OnboardingDialogProps {
  open: boolean;
  dailyGoal: number;
  onDailyGoalChange: (goal: number) => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  /** true = the day is split into morning/noon/evening, false = one flat list. */
  daySections: boolean;
  onDaySectionsChange: (enabled: boolean) => void;
  onClose: () => void;
}

const STEP_COUNT = 5;
const GOAL_CHOICES = [3, 5, 7, 10];
/** A handful of palettes, one per mood, enough to pick without a theme gallery. */
const THEME_CHOICES: ThemeId[] = [
  'claude-dark',
  'claude-light',
  'nord-dark',
  'rose-pine-dawn',
  'tokyo-night',
  'github-light',
];

const FEATURES: Array<{ title: string; body: string }> = [
  { title: 'امروز', body: 'کارهای همین روز، دسته‌بندی‌شده از صبح تا شب.' },
  { title: 'همه کارها', body: 'همه‌ی کارهای باز در یک لیست یا روی برد کانبان.' },
  { title: 'یادداشت', body: 'یادداشت‌هایی که می‌توانند کارهای واقعی را داخل خودشان نشان دهند.' },
  { title: 'تمرکز', body: 'تایمر تمرکز روی یک کار، با ثبت سابقه‌ی روزانه.' },
];

const SHORTCUTS: Array<{ key: string; body: string }> = [
  { key: 'T', body: 'کار تازه' },
  { key: 'N', body: 'یادداشت تازه' },
  { key: 'Ctrl + K', body: 'جست‌وجو' },
  { key: '/', body: 'منوی افزودن' },
];

/**
 * Five short screens over the app for a first-time visitor: what Box does, how
 * many tasks a good day holds, how it should look, a couple of real tasks to
 * start with, and the shortcuts worth memorizing.
 */
export const OnboardingDialog: React.FC<OnboardingDialogProps> = ({
  open,
  dailyGoal,
  onDailyGoalChange,
  theme,
  onThemeChange,
  daySections,
  onDaySectionsChange,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState('');
  const [drafts, setDrafts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDraft('');
      setDrafts([]);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const isLast = step === STEP_COUNT - 1;
  const MAX_STARTERS = 3;

  const addDraft = () => {
    const title = draft.trim();
    if (!title || drafts.length >= MAX_STARTERS) return;
    if (drafts.some((item) => item.toLowerCase() === title.toLowerCase())) {
      setDraft('');
      return;
    }
    setDrafts((current) => [...current, title]);
    setDraft('');
  };

  /** The starters become real tasks for today, so the app is never empty. */
  const createStarters = async () => {
    const titles = drafts.filter((title) => title.trim().length > 0);
    if (!titles.length) return;
    const dueDate = getTodayJalaliKey();
    for (let index = 0; index < titles.length; index += 1) {
      try {
        await taskRepo.create({
          entry_id: null,
          title: titles[index],
          status: 'open',
          time_of_day: daySections ? 'morning' : 'anytime',
          due_date: dueDate,
          tag_ids: [],
          subtasks: [],
          order: index,
        });
      } catch (err) {
        console.error('Could not create a starter task:', err);
      }
    }
    try {
      window.dispatchEvent(new Event('task-updated'));
    } catch {}
  };

  const handleFinish = async () => {
    if (saving) return;
    if (drafts.length) {
      setSaving(true);
      try {
        await createStarters();
      } finally {
        setSaving(false);
      }
    }
    onClose();
  };

  const goNext = () => {
    // The last visible step may still hold a typed-but-not-added title.
    if (step === 3 && draft.trim()) {
      const title = draft.trim();
      setDraft('');
      if (drafts.length < MAX_STARTERS) setDrafts((current) => [...current, title]);
    }
    if (isLast) void handleFinish();
    else setStep((current) => Math.min(STEP_COUNT - 1, current + 1));
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="آشنایی با جعبه"
      className="fixed inset-0 z-[190] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center"
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, index) => (
              <span
                key={index}
                className={`h-1 rounded-full transition-all duration-200 ${
                  index === step ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/20'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RiCloseLine className="size-4" />
          </button>
        </div>

        <div className="px-5 pb-1 pt-4">
          {step === 0 && (
            <>
              <img
                src="/Boxs/Box 2.png"
                alt=""
                className="size-12 rounded-2xl object-contain"
              />
              <h2 className="mt-3 font-darvish text-[22px] font-semibold leading-8 text-foreground">
                به جعبه خوش آمدی
              </h2>
              <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                جعبه یک ذهن دوم کوچک است: کارها، یادداشت‌ها و تمرکز، همه در یک جا
                و روی همین دستگاه.
              </p>

              <ul className="mt-4 flex flex-col gap-2.5">
                {FEATURES.map((feature) => (
                  <li key={feature.title} className="flex items-start gap-2">
                    <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                      <RiCheckLine className="size-2.5 text-foreground/70" />
                    </span>
                    <p className="text-[11.5px] leading-6 text-muted-foreground">
                      <span className="font-medium text-foreground">{feature.title}</span>
                      {' — '}
                      {feature.body}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-darvish text-[22px] font-semibold leading-8 text-foreground">
                یک روز خوب چه شکلی است؟
              </h2>
              <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                یک هدف کوچک و واقعی انتخاب کن. جعبه وقتی به آن رسیدی جشن می‌گیرد.
              </p>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {GOAL_CHOICES.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => onDailyGoalChange(goal)}
                    className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] transition-colors ${
                      dailyGoal === goal
                        ? 'border-foreground/30 bg-foreground/[0.07] text-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span className="font-darvish text-[20px] font-semibold leading-6">
                      {toPersianDigits(goal)}
                    </span>
                    <span>کار</span>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-6 text-subtle">
                می‌توانی این عدد را بعداً از تنظیمات عوض کنی.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-darvish text-[22px] font-semibold leading-8 text-foreground">
                جعبه‌ات چه رنگی باشد؟
              </h2>
              <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                یکی از پالت‌ها را بزن؛ همان لحظه روی اپ اعمال می‌شود.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {THEME_CHOICES.map((id) => {
                  const config = THEMES.find((item) => item.id === id);
                  if (!config) return null;
                  const selected = theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onThemeChange(id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-2 rounded-xl border py-1.5 pe-3 ps-1.5 text-[11.5px] transition-colors ${
                        selected
                          ? 'border-foreground/30 bg-foreground/[0.07] text-foreground'
                          : 'border-border/60 text-muted-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <span
                        className="flex size-6 items-center justify-center rounded-full border"
                        style={{
                          backgroundColor: config.previewColors.bg,
                          borderColor: config.previewColors.border,
                        }}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: config.previewColors.accent }}
                        />
                      </span>
                      <span className="flex items-center gap-1">
                        {config.mode === 'dark' ? (
                          <RiMoonLine className="size-3 opacity-60" />
                        ) : (
                          <RiSunLine className="size-3 opacity-60" />
                        )}
                        {config.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-5 text-[12.5px] font-semibold text-foreground">
                روزت چطور تقسیم شود؟
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDaySectionsChange(true)}
                  aria-pressed={daySections}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-right transition-colors ${
                    daySections
                      ? 'border-foreground/30 bg-foreground/[0.07]'
                      : 'border-border/60 hover:bg-secondary/50'
                  }`}
                >
                  <span className="text-[11.5px] font-medium text-foreground">
                    صبح، ظهر، عصر
                  </span>
                  <span className="text-[10.5px] leading-5 text-muted-foreground">
                    هر بخش جدا، برای وقتی که روزت ریتم دارد.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDaySectionsChange(false)}
                  aria-pressed={!daySections}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-right transition-colors ${
                    !daySections
                      ? 'border-foreground/30 bg-foreground/[0.07]'
                      : 'border-border/60 hover:bg-secondary/50'
                  }`}
                >
                  <span className="text-[11.5px] font-medium text-foreground">
                    یک لیست یکدست
                  </span>
                  <span className="text-[10.5px] leading-5 text-muted-foreground">
                    همه‌ی کارهای امروز پشت سر هم، بدون بخش‌بندی.
                  </span>
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-darvish text-[22px] font-semibold leading-8 text-foreground">
                با چه کاری شروع می‌کنی؟
              </h2>
              <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                یکی دو کار واقعی برای امروز بنویس؛ همین‌جا ساخته می‌شوند. اگر الان
                نمی‌خواهی، رد شو.
              </p>

              <div className="mt-4 flex items-center gap-1.5">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addDraft();
                    }
                  }}
                  maxLength={120}
                  placeholder="مثلاً: ایمیل‌های امروز را جواب بدم"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-2.5 text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/30"
                />
                <button
                  type="button"
                  onClick={addDraft}
                  disabled={!draft.trim() || drafts.length >= MAX_STARTERS}
                  aria-label="افزودن کار"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity disabled:opacity-30"
                >
                  <RiAddLine className="size-4" />
                </button>
              </div>

              <ul className="mt-2.5 flex flex-col gap-1.5">
                {drafts.map((title, index) => (
                  <li
                    key={`${title}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1.5"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border/70 text-[9px] text-muted-foreground">
                      {toPersianDigits(index + 1)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">
                      {title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((current) => current.filter((_, i) => i !== index))
                      }
                      aria-label="حذف"
                      className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <RiDeleteBinLine className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-[11px] leading-6 text-subtle">
                {drafts.length >= MAX_STARTERS
                  ? 'برای شروع همین سه تا کافی است؛ بقیه را بعداً اضافه کن.'
                  : 'با «T» هر وقت خواستی کار تازه اضافه کن.'}
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-darvish text-[22px] font-semibold leading-8 text-foreground">
                آماده‌ای
              </h2>
              <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                چهار میان‌بر که بیشتر از همه به کارت می‌آیند:
              </p>

              <ul className="mt-4 flex flex-col divide-y divide-border/50">
                {SHORTCUTS.map((shortcut) => (
                  <li key={shortcut.key} className="flex items-center justify-between py-2.5">
                    <span className="text-[11.5px] text-muted-foreground">
                      {shortcut.body}
                    </span>
                    <kbd
                      dir="ltr"
                      className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 font-mono text-[10.5px] text-foreground"
                    >
                      {shortcut.key}
                    </kbd>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-[11px] leading-6 text-subtle">
                هر وقت خواستی، کارهای عقب‌افتاده را روی امروز بکش.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 pb-5 pt-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground ${
              step === 0 ? 'invisible' : ''
            }`}
          >
            <RiArrowRightLine className="size-3.5" />
            <span>قبلی</span>
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-foreground px-5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <span>{isLast ? 'شروع کنیم' : step === 3 ? 'ساختن و ادامه' : 'بعدی'}</span>
            {!isLast && <RiArrowLeftLine className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
