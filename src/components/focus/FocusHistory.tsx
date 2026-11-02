import React, { useMemo } from 'react';
import type { FocusSession } from '@/types/models';
import {
  PERSIAN_WEEKDAY_SHORT_NAMES,
  addJalaliDays,
  formatJalaliDisplay,
  getIranianDayOfWeek,
  getTodayJalaliKey,
  jalaliToDate,
  parseJalaliKey,
  toPersianDigits,
} from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { RiCheckLine } from '@remixicon/react';
import { formatFocusDuration } from './format';

interface FocusHistoryProps {
  sessions: FocusSession[];
}

interface DayBucket {
  key: string;
  label: string;
  isToday: boolean;
  minutes: number;
  sessions: FocusSession[];
}

/** Sessions grouped by day, newest day first, ignored when empty. */
function groupByDay(sessions: FocusSession[], todayKey: string): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const yesterdayKey = addJalaliDays(todayKey, -1);

  for (const session of sessions) {
    const key = session.date_key;
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label:
          key === todayKey
            ? 'امروز'
            : key === yesterdayKey
            ? 'دیروز'
            : formatJalaliDisplay(parseJalaliKey(key)),
        isToday: key === todayKey,
        minutes: 0,
        sessions: [],
      };
      buckets.set(key, bucket);
    }
    bucket.minutes += session.duration_minutes || 0;
    bucket.sessions.push(session);
  }

  return Array.from(buckets.values());
}

/**
 * The time-tracking half of the focus section: how much was focused each day of
 * this week, and what the individual sessions were.
 */
export const FocusHistory: React.FC<FocusHistoryProps> = ({ sessions }) => {
  const todayKey = getTodayJalaliKey();

  const week = useMemo(() => {
    const minutesByKey = new Map<string, number>();
    for (const session of sessions) {
      const key = session.date_key;
      if (!key) continue;
      minutesByKey.set(key, (minutesByKey.get(key) || 0) + (session.duration_minutes || 0));
    }

    const days = Array.from({ length: 7 }, (_, index) => {
      const key = addJalaliDays(todayKey, index - 6);
      const date = jalaliToDate(
        parseJalaliKey(key).jy,
        parseJalaliKey(key).jm,
        parseJalaliKey(key).jd
      );
      return {
        key,
        weekday: PERSIAN_WEEKDAY_SHORT_NAMES[getIranianDayOfWeek(date)] || '',
        minutes: minutesByKey.get(key) || 0,
        isToday: key === todayKey,
      };
    });

    const max = Math.max(1, ...days.map((day) => day.minutes));
    const total = days.reduce((sum, day) => sum + day.minutes, 0);

    return { days, max, total };
  }, [sessions, todayKey]);

  const days = useMemo(() => groupByDay(sessions, todayKey), [sessions, todayKey]);

  return (
    <section className="rounded-[26px] border border-border/70 bg-card p-4 sm:p-5" dir="rtl">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13.5px] font-semibold text-foreground">تاریخچه تمرکز</h2>
        <span className="text-[11px] text-muted-foreground">
          این هفته · {formatFocusDuration(week.total)}
        </span>
      </div>

      {/* Week bars */}
      <div className="mt-4 flex h-[104px] items-end justify-between gap-1.5">
        {week.days.map((day) => {
          const height = day.minutes === 0 ? 0 : Math.max(6, (day.minutes / week.max) * 100);
          return (
            <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span
                className={cn(
                  'text-[10px] tabular-nums leading-none transition-colors',
                  day.minutes > 0 ? 'text-muted-foreground' : 'text-transparent'
                )}
              >
                {toPersianDigits(day.minutes)}
              </span>
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className={cn(
                    'w-full max-w-[24px] rounded-full transition-all duration-300',
                    day.minutes === 0
                      ? 'h-[3px] bg-foreground/[0.08]'
                      : day.isToday
                      ? 'bg-primary'
                      : 'bg-foreground/[0.18]'
                  )}
                  style={day.minutes > 0 ? { height: `${height}%` } : undefined}
                  title={`${day.key} · ${formatFocusDuration(day.minutes)}`}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] leading-none',
                  day.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground/70'
                )}
              >
                {day.weekday}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border/60 pt-3">
        {days.length === 0 ? (
          <p className="py-6 text-center text-[11.5px] leading-6 text-muted-foreground">
            هنوز جلسه‌ای ثبت نشده است.
            <br />
            یک تایمر شروع کن تا روزت اینجا ثبت شود.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {days.slice(0, 14).map((day) => (
              <li key={day.key}>
                <div className="flex items-baseline justify-between gap-2 pb-1">
                  <span
                    className={cn(
                      'text-[11.5px] font-medium',
                      day.isToday ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {day.label}
                  </span>
                  <span className="text-[10.5px] tabular-nums text-muted-foreground">
                    {formatFocusDuration(day.minutes)}
                  </span>
                </div>
                <ul className="flex flex-col">
                  {day.sessions.slice(0, 8).map((session) => (
                    <li
                      key={session.id}
                      className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[11.5px] transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          session.completed ? 'bg-emerald-500/80' : 'bg-foreground/20'
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground/90">
                        {session.task_title || 'تمرکز آزاد'}
                      </span>
                      <span className="shrink-0 tabular-nums text-[10.5px] text-muted-foreground">
                        {session.start_at}–{session.end_at}
                      </span>
                      <span className="w-12 shrink-0 text-left tabular-nums text-[10.5px] text-muted-foreground">
                        {toPersianDigits(session.duration_minutes)}′
                      </span>
                      {session.completed && (
                        <RiCheckLine className="size-3 shrink-0 text-emerald-500/80" />
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
