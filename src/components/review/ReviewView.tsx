import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  RiArrowDownSLine,
  RiArrowRightDownLine,
  RiArrowRightUpLine,
  RiBarChart2Line,
  RiCalendarCheckLine,
  RiCalendarLine,
  RiFireLine,
  RiFocus3Line,
  RiInboxLine,
  RiLightbulbLine,
  RiLineChartLine,
  RiMoonLine,
  RiSeedlingLine,
  RiSubtractLine,
  RiTimeLine,
  RiTimerLine,
} from '@remixicon/react';
import { focusSessionRepo, taskRepo } from '@/repositories';
import type { FocusSession, Task } from '@/types/models';
import {
  buildInsights,
  buildReviewReport,
  loadWeeklyAnswers,
  saveWeeklyAnswers,
  WEEKLY_QUESTIONS,
  type InsightIcon,
  type InsightTone,
  type ReviewDay,
  type ReviewReport,
  type WeeklyAnswers,
} from '@/lib/review';
import { formatJalaliDisplay, parseJalaliKey, toPersianDigits } from '@/lib/jalali';

interface ReviewViewProps {
  open: boolean;
  onClose: () => void;
  /** Saturday's automatic visit lands straight on the weekly reflection. */
  startTab?: 'report' | 'week';
}

const HEAT_STEPS = [
  'bg-muted/60',
  'bg-primary/25',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary/90',
];

/**
 * Fixed thresholds instead of scaling to the best day ever, so two months stay
 * comparable and a quiet month never looks as bright as a busy one.
 */
const heatClass = (done: number): string => {
  if (done <= 0) return HEAT_STEPS[0];
  if (done <= 2) return HEAT_STEPS[1];
  if (done <= 4) return HEAT_STEPS[2];
  if (done <= 7) return HEAT_STEPS[3];
  return HEAT_STEPS[4];
};

const WEEKDAY_ROWS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const INSIGHT_ICONS: Record<InsightIcon, typeof RiCalendarLine> = {
  seed: RiSeedlingLine,
  spark: RiLightbulbLine,
  calendar: RiCalendarLine,
  clock: RiTimeLine,
  target: RiCalendarCheckLine,
  inbox: RiInboxLine,
  flame: RiFireLine,
  trend: RiBarChart2Line,
  timer: RiTimerLine,
  moon: RiMoonLine,
  chart: RiLineChartLine,
};

const TONE_CHIP: Record<InsightTone, string> = {
  bright: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
  quiet: 'border-border/60 bg-secondary/60 text-muted-foreground',
  care: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
};

const TONE_CARD: Record<InsightTone, string> = {
  bright: 'border-emerald-500/15 bg-emerald-500/[0.04]',
  quiet: 'border-border/60 bg-card/60',
  care: 'border-amber-500/20 bg-amber-500/[0.04]',
};

const QUESTION_ICONS: Record<keyof WeeklyAnswers, typeof RiCalendarLine> = {
  wentWell: RiLightbulbLine,
  drained: RiMoonLine,
  drop: RiSubtractLine,
  next: RiCalendarCheckLine,
};

const dayTitle = (day: ReviewDay): string => {
  const parts = [formatJalaliDisplay(parseJalaliKey(day.key))];
  if (day.done > 0) parts.push(`${toPersianDigits(day.done)} کار`);
  if (day.focus > 0) parts.push(`${toPersianDigits(day.focus)} دقیقه تمرکز`);
  if (day.done === 0 && day.focus === 0) parts.push('بدون فعالیت');
  return parts.join(' • ');
};

const SectionTitle = ({
  icon: Icon,
  title,
  hint,
  aside,
}: {
  icon: typeof RiCalendarLine;
  title: string;
  hint?: string;
  aside?: ReactNode;
}) => (
  <div className="mb-2.5 flex items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/70">
        <Icon className="size-3.5 text-foreground/80" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-foreground">{title}</p>
        {hint ? <p className="truncate text-[9.5px] text-subtle">{hint}</p> : null}
      </div>
    </div>
    {aside}
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  delta,
}: {
  icon: typeof RiCalendarLine;
  label: string;
  value: string;
  hint: string;
  delta?: number;
}) => (
  <div className="rounded-2xl border border-border/60 bg-secondary/25 p-3.5">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/70">
          <Icon className="size-3.5 text-foreground/80" />
        </span>
        {label}
      </div>
      {typeof delta === 'number' && delta !== 0 ? (
        <span
          className={`flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9.5px] ${
            delta > 0
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
              : 'border-border/60 bg-secondary/60 text-muted-foreground'
          }`}
          title="مقایسه با هفتهٔ قبل"
        >
          {delta > 0 ? (
            <RiArrowRightUpLine className="size-3" />
          ) : (
            <RiArrowRightDownLine className="size-3" />
          )}
          {toPersianDigits(Math.abs(delta))}
        </span>
      ) : null}
    </div>
    <p className="mt-2 font-darvish text-[22px] font-semibold leading-8 text-foreground">{value}</p>
    <p className="mt-0.5 text-[10.5px] leading-4 text-subtle">{hint}</p>
  </div>
);

/**
 * The review screen: what moved this week, the long-range rhythm, and a short
 * weekly reflection. Numbers describe a pattern; they never grade the week.
 */
export default function ReviewView({ open, onClose, startTab = 'report' }: ReviewViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'report' | 'week'>(startTab);
  const [answers, setAnswers] = useState<WeeklyAnswers>(() => loadWeeklyAnswers(''));
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const [taskList, focusList] = await Promise.all([
          taskRepo.list(),
          focusSessionRepo.list(600),
        ]);
        if (!alive) return;
        setTasks(taskList);
        setSessions(focusList);
      } catch (error) {
        console.error('Failed to load review data:', error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const report: ReviewReport = useMemo(
    () => buildReviewReport(tasks, sessions),
    [tasks, sessions]
  );
  const insights = useMemo(() => buildInsights(report), [report]);

  useEffect(() => {
    if (!open) return;
    setTab(startTab);
    setAnswers(loadWeeklyAnswers(report.weekStartKey));
  }, [open, startTab, report.weekStartKey]);

  const updateAnswer = (key: keyof WeeklyAnswers, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    saveWeeklyAnswers(report.weekStartKey, next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  if (!open) return null;

  const weekLabel = report.weekDays.length
    ? `${formatJalaliDisplay(parseJalaliKey(report.weekDays[0].key))} تا ${formatJalaliDisplay(
        parseJalaliKey(report.weekDays[report.weekDays.length - 1].key)
      )}`
    : '';

  const maxWeekday = Math.max(1, ...report.byWeekday);
  const maxHour = Math.max(1, ...report.byHour);
  const trend = report.weeklyDone.slice(-10);
  const trendMax = Math.max(1, ...trend);
  const trendWeeks = report.weeks.slice(-10);
  const answeredCount = Object.values(answers).filter((value) => value.trim()).length;
  const weekDoneDelta = report.weekDone - report.prevWeekDone;
  const weekFocusDelta = report.weekFocus - report.prevWeekFocus;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[190] overflow-y-auto bg-black/45 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="mx-auto my-2 w-full max-w-[1020px] rounded-[24px] border border-border/80 bg-card p-4 font-sans text-right shadow-2xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-secondary/50">
              <RiLineChartLine className="size-4.5 text-primary" />
            </span>
            <div className="min-w-0">
              <h2 className="font-darvish text-[21px] font-semibold leading-7 text-foreground">
                مرور
              </h2>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                نگاهی به ریتم کار و تمرکزت — {weekLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 items-center gap-0.5 rounded-lg border border-border/60 p-0.5">
              {[
                { key: 'report' as const, label: 'گزارش', Icon: RiBarChart2Line },
                { key: 'week' as const, label: 'مرور هفته', Icon: RiCalendarCheckLine },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-pressed={tab === item.key}
                  className={`flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors ${
                    tab === item.key
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.Icon className="size-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-[12px] text-muted-foreground">در حال خواندن داده‌ها…</p>
        ) : tab === 'report' ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={RiFocus3Line}
                label="کارهای این هفته"
                value={`${toPersianDigits(report.weekDone)} کار`}
                hint={`در ${toPersianDigits(
                  report.weekActiveDays
                )} روز از ۷ روز • کل: ${toPersianDigits(report.doneTasks)} کار بسته‌شده`}
                delta={weekDoneDelta}
              />
              <StatCard
                icon={RiTimeLine}
                label="تمرکز این هفته"
                value={`${toPersianDigits(report.weekFocus)} دقیقه`}
                hint={`مجموع کل: ${toPersianDigits(
                  report.totalFocus
                )} دقیقه در ${toPersianDigits(report.focusDayCount)} روز`}
                delta={weekFocusDelta}
              />
              <StatCard
                icon={RiFireLine}
                label="روزهای پیاپی با فعالیت"
                value={`${toPersianDigits(report.streakDays)} روز`}
                hint={
                  report.parkedCount > 0
                    ? `${toPersianDigits(report.parkedCount)} کار از روزهای قبل باز مانده`
                    : 'چیزی از روزهای قبل جا نمانده'
                }
              />
              <StatCard
                icon={RiCalendarCheckLine}
                label="این ماه"
                value={`${toPersianDigits(report.doneThisMonth)} کار`}
                hint={
                  report.focusThisMonth > 0
                    ? `${toPersianDigits(report.focusThisMonth)} دقیقه تمرکز در همین ماه`
                    : 'شروع ماه تازه است؛ هر تیک حساب است'
                }
              />
            </div>

            {/* Long-range rhythm: 26 weeks, newest week on the right. */}
            <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5">
              <SectionTitle
                icon={RiCalendarLine}
                title="شش ماه گذشته"
                hint="هر ستون یک هفته، از شنبه تا جمعه"
                aside={
                  <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-subtle">
                    <span>کمتر</span>
                    {HEAT_STEPS.map((step) => (
                      <span
                        key={step}
                        className={`size-2.5 rounded-[3px] ${step}`}
                        aria-hidden="true"
                      />
                    ))}
                    <span>بیشتر</span>
                  </div>
                }
              />

              <div className="flex items-start justify-start gap-2">
                <div className="flex flex-col gap-[3px] text-[9px] leading-[11px] text-subtle">
                  {WEEKDAY_ROWS.map((name) => (
                    <span key={name} className="flex h-[11px] items-center">
                      {name}
                    </span>
                  ))}
                </div>
                <div className="no-scrollbar flex gap-[3px] overflow-x-auto pb-1">
                  {[...report.weeks].reverse().map((week) => (
                    <div key={week[0]?.key} className="flex flex-col gap-[3px]">
                      {week.map((day) => (
                        <div
                          key={day.key}
                          title={dayTitle(day)}
                          className={`size-[11px] rounded-[3px] ${
                            day.isFuture ? 'border border-dashed border-border/50' : heatClass(day.done)
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] leading-4 text-subtle">
                <RiArrowDownSLine className="size-3 shrink-0" />
                هر مربع یک روز است؛ هرچه پررنگ‌تر، کار بیشتری آن روز بسته شده.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5">
                <SectionTitle
                  icon={RiBarChart2Line}
                  title="ریتم ۱۰ هفتهٔ اخیر"
                  hint={
                    report.weeklyDone.slice(-10).filter((value) => value > 0).length > 0
                      ? 'هفتهٔ جاری روشن‌تر نشان داده شده'
                      : 'هنوز هفتهٔ پرکاری ثبت نشده'
                  }
                />
                <div className="flex h-24 items-end gap-1.5">
                  {trend.map((done, index) => {
                    const isCurrent = index === trend.length - 1;
                    const startKey = trendWeeks[index]?.[0]?.key;
                    return (
                      <div key={`${index}-${done}`} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          title={
                            startKey
                              ? `هفتهٔ ${formatJalaliDisplay(parseJalaliKey(startKey))} — ${toPersianDigits(done)} کار`
                              : `${toPersianDigits(done)} کار`
                          }
                          className={`w-full rounded-t-[3px] ${
                            isCurrent ? 'bg-primary' : 'bg-primary/35'
                          }`}
                          style={{
                            height: `${Math.max(4, Math.round((done / trendMax) * 92))}%`,
                          }}
                        />
                        <span
                          className={`text-[9px] ${
                            isCurrent ? 'font-medium text-foreground' : 'text-subtle'
                          }`}
                        >
                          {toPersianDigits(done)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5">
                <SectionTitle
                  icon={RiCalendarLine}
                  title="کدام روزها بهتر بودی؟"
                  hint={
                    report.bestWeekday !== null
                      ? `پرثمرترین روز: ${WEEKDAY_ROWS[report.bestWeekday]}`
                      : 'داده‌ای برای مقایسه نیست'
                  }
                />
                <div className="space-y-1.5">
                  {report.byWeekday.map((count, index) => (
                    <div key={WEEKDAY_ROWS[index] + index} className="flex items-center gap-2">
                      <span
                        className={`w-4 shrink-0 text-[10px] ${
                          report.bestWeekday === index
                            ? 'font-semibold text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {WEEKDAY_ROWS[index]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={`h-full rounded-full ${
                            report.bestWeekday === index ? 'bg-primary' : 'bg-primary/40'
                          }`}
                          style={{ width: `${Math.round((count / maxWeekday) * 100)}%` }}
                        />
                      </div>
                      <span className="w-5 shrink-0 text-left font-mono text-[10px] tabular-nums text-subtle">
                        {toPersianDigits(count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5">
              <SectionTitle
                icon={RiTimeLine}
                title="تمرکز در طول شبانه‌روز"
                hint="مجموع دقایق هر ساعت از نیمه‌شب"
                aside={
                  report.bestWindow ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-secondary/50 px-2 py-0.5 text-[9.5px] text-muted-foreground">
                      <RiTimerLine className="size-3" />
                      بیشترین تمرکز: {toPersianDigits(report.bestWindow.start)} تا{' '}
                      {toPersianDigits(report.bestWindow.end)}
                    </span>
                  ) : null
                }
              />
              <div className="flex h-24 items-end gap-[3px]">
                {report.byHour.map((minutes, hour) => (
                  <div
                    key={hour}
                    title={`${toPersianDigits(hour)}:۰۰ — ${toPersianDigits(minutes)} دقیقه`}
                    className={`flex-1 rounded-t-[2px] ${
                      report.peakHour === hour ? 'bg-primary' : 'bg-primary/45'
                    }`}
                    style={{ height: `${Math.max(3, Math.round((minutes / maxHour) * 100))}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-subtle">
                <span>۰</span>
                <span>۶</span>
                <span>۱۲</span>
                <span>۱۸</span>
                <span>۲۳</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3.5">
              <SectionTitle
                icon={RiLightbulbLine}
                title="چند نکته از داده‌های خودت"
                hint="بدون نمره، فقط برای دیدن الگو"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {insights.map((insight) => {
                  const Icon = INSIGHT_ICONS[insight.icon];
                  return (
                    <div
                      key={insight.title}
                      className={`rounded-xl border px-3 py-2.5 ${TONE_CARD[insight.tone]}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${TONE_CHIP[insight.tone]}`}
                        >
                          <Icon className="size-3" />
                        </span>
                        <p className="min-w-0 flex-1 text-[11.5px] font-semibold text-foreground">
                          {insight.title}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {insight.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/70">
                    <RiCalendarCheckLine className="size-3.5 text-foreground/80" />
                  </span>
                  <p className="truncate text-[12px] font-medium text-foreground">
                    مرور هفتهٔ {weekLabel}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[9.5px] text-muted-foreground">
                  {toPersianDigits(answeredCount)} از {toPersianDigits(WEEKLY_QUESTIONS.length)} جواب
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                چهار سؤال کوتاه، بدون حسابرسی. اگر وقت نداری، فقط سؤال آخر را جواب بده؛ همین کافی
                است.
              </p>
            </div>

            {WEEKLY_QUESTIONS.map((question) => {
              const Icon = QUESTION_ICONS[question.key];
              const filled = Boolean(answers[question.key].trim());
              return (
                <div
                  key={question.key}
                  className="rounded-2xl border border-border/60 bg-card/60 p-3.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-lg border ${
                        filled
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
                          : 'border-border/60 bg-secondary/60 text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <label
                      className="block text-[12px] font-medium text-foreground"
                      htmlFor={`review-${question.key}`}
                    >
                      {question.title}
                    </label>
                  </div>
                  <p className="mt-1 text-[10.5px] text-subtle">{question.hint}</p>
                  <textarea
                    id={`review-${question.key}`}
                    value={answers[question.key]}
                    onChange={(event) => updateAnswer(question.key, event.target.value)}
                    rows={2}
                    placeholder="…"
                    className="mt-2 w-full resize-y rounded-xl border border-border/70 bg-background/60 px-2.5 py-2 text-[12px] leading-5 text-foreground outline-none transition-colors placeholder:text-subtle/60 focus:border-primary/50"
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-between px-1">
              <p className="text-[10.5px] text-subtle">
                {savedFlash ? 'ذخیره شد' : 'جواب‌ها خودکار برای همین هفته ذخیره می‌شوند'}
              </p>
              <button
                type="button"
                onClick={() => setTab('report')}
                className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RiLineChartLine className="size-3" />
                دیدن گزارش
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <p className="flex items-center gap-1 text-[10px] text-subtle">
            <RiArrowDownSLine className="size-3" />
            از منوی حساب هر وقت خواستی این صفحه را باز کن.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-3 py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
