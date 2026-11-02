import React, { useEffect, useState } from 'react';
import type { DocumentVersion } from '@/types/models';
import { documentVersionRepo } from '@/repositories';
import { formatJalaliDisplay, getJalaliDate, toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { RiCloseLine, RiHistoryLine, RiRefreshLine, RiSaveLine } from '@remixicon/react';

const CAUSE_LABEL: Record<DocumentVersion['cause'], string> = {
  autosave: 'ذخیره خودکار',
  manual: 'نسخه دستی',
  restore: 'بازگردانی',
};

const formatStamp = (iso: string): string => {
  const date = new Date(iso);
  const day = formatJalaliDisplay(getJalaliDate(date));
  const time = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
};

interface NoteHistoryPanelProps {
  noteId: string;
  /** Bumped after every save, so the list stays current while open. */
  refreshKey: number;
  onRestore: (version: DocumentVersion) => void;
  /** Registers the current state as a named-version snapshot. */
  onSnapshot: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * A window of its own: every version action lives here, so the note menu only
 * has to open it. Restore and snapshot both re-read the list afterwards.
 */
export const NoteHistoryPanel: React.FC<NoteHistoryPanelProps> = ({
  noteId,
  refreshKey,
  onRestore,
  onSnapshot,
  onClose,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    documentVersionRepo
      .list('note', noteId, 100)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId, refreshKey]);

  const handleSnapshot = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSnapshot();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[195] flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="تاریخچه نسخه‌ها"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[min(86vh,700px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <RiHistoryLine className="size-4 text-muted-foreground" />
            تاریخچه نسخه‌ها
            {versions.length > 0 && (
              <span className="text-[11px] font-normal text-subtle">
                {toPersianDigits(versions.length)} نسخه
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleSnapshot()}
              disabled={saving}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RiSaveLine className="size-3.5" />
              {saving ? 'در حال ثبت…' : 'ثبت نسخه'}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="بستن تاریخچه"
              aria-label="بستن تاریخچه"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RiCloseLine className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="px-1 py-2 text-[12px] text-subtle">در حال خواندن نسخه‌ها…</p>
          ) : versions.length === 0 ? (
            <p className="px-1 py-2 text-[12px] leading-6 text-subtle">
              هنوز نسخه‌ای ثبت نشده. اولین تغییر در یادداشت، اولین نسخه را می‌سازد یا با دکمهٔ «ثبت نسخه» یکی بساز.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {versions.map((version) => {
                const preview =
                  (version.body || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim() ||
                  'بدون متن';
                return (
                  <li
                    key={version.id}
                    className="rounded-lg border border-border/50 bg-background/60 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-foreground">
                          {version.title?.trim() || 'بدون عنوان'}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-subtle">
                          <span className="tabular-nums">{formatStamp(version.created_at)}</span>
                          <span
                            className={cn(
                              'rounded px-1 py-px',
                              version.cause === 'restore'
                                ? 'bg-warning/15 text-warning'
                                : version.cause === 'manual'
                                ? 'bg-foreground/[0.08] text-foreground'
                                : 'bg-foreground/[0.05] text-muted-foreground'
                            )}
                          >
                            {CAUSE_LABEL[version.cause]}
                          </span>
                          {version.actor_name && <span>{version.actor_name}</span>}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRestore(version)}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-secondary"
                      >
                        <RiRefreshLine className="size-3.5" />
                        بازگردانی
                      </button>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-5 text-muted-foreground">
                      {preview}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
