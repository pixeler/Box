import React, { useState } from 'react';
import type { EventItem } from '@/types/models';
import { RiCloseLine, RiTimeLine, RiRepeatLine, RiDeleteBinLine, RiCheckLine } from '@remixicon/react';
import { toPersianDigits } from '@/lib/jalali';
import { eventRepo } from '@/repositories';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !event) return null;

  const [title, setTitle] = useState(event.title);
  const [startAt, setStartAt] = useState(event.start_at || '');
  const [endAt, setEndAt] = useState(event.end_at || '');

  const handleSave = async () => {
    try {
      await eventRepo.update(event.id, {
        title,
        start_at: startAt,
        end_at: endAt || undefined,
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Failed updating event:', err);
    }
  };

  const handleDelete = async () => {
    try {
      // In dexie, delete if needed or clear
      await eventRepo.update(event.id, { title: `${event.title} (لغو شده)` });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Failed deleting event:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card text-card-foreground rounded-t-[28px] sm:rounded-2xl border-t sm:border border-border/80 dark:border-white/10 shadow-2xl p-5 pb-6 text-right animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60 dark:border-white/10">
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
          <h3 className="font-bold text-base text-foreground">مشخصات رویداد</h3>
        </div>

        {/* Form Body */}
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">
              عنوان رویداد
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border/70 text-foreground text-sm font-medium outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                <RiTimeLine className="w-3.5 h-3.5" />
                <span>زمان شروع</span>
              </label>
              <input
                type="text"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                placeholder="10:00"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border/70 text-foreground text-sm font-medium text-center outline-none focus:border-primary transition-colors dir-ltr"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                <RiTimeLine className="w-3.5 h-3.5" />
                <span>زمان پایان</span>
              </label>
              <input
                type="text"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                placeholder="11:30"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border/70 text-foreground text-sm font-medium text-center outline-none focus:border-primary transition-colors dir-ltr"
              />
            </div>
          </div>

          {event.recurrence_rule && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 text-muted-foreground text-xs">
              <RiRepeatLine className="w-4 h-4 text-primary" />
              <span>تکرار: {toPersianDigits(event.recurrence_rule)}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-6 pt-3 border-t border-border/60">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <RiDeleteBinLine className="w-4 h-4" />
            <span>حذف رویداد</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            <RiCheckLine className="w-4 h-4" />
            <span>ذخیره تغییرات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
