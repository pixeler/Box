import React, { useState, useEffect, useRef } from 'react';
import {
  RiArrowUpLine,
  RiCloseLine,
  RiCalendarLine,
  RiTimeLine,
} from '@remixicon/react';
import { taskRepo } from '@/repositories';
import { getTodayJalaliKey, addJalaliDays } from '@/lib/jalali';
import { getTaskEmoji } from './todoUtils';

interface TodoQuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialPriority?: 1 | 2 | 3 | undefined;
  onTaskCreated: (createdId: string) => void;
}

const DURATION_OPTIONS = [
  { label: '۱۵ دقیقه', value: 15, short: '15M' },
  { label: '۳۰ دقیقه', value: 30, short: '30M' },
  { label: '۴۵ دقیقه', value: 45, short: '45M' },
  { label: '۱ ساعت', value: 60, short: '1H' },
  { label: '۱:۳۰ ساعت', value: 90, short: '1H30M' },
];

const EMOJI_PRESETS = ['📚', '🏠', '🍽️', '🧺', '🏋️', '💻', '🛒', '📞', '💊', '🚗', '💳', '✨', '🎯', '📝'];

export const TodoQuickAddSheet: React.FC<TodoQuickAddSheetProps> = ({
  isOpen,
  onClose,
  initialPriority,
  onTaskCreated,
}) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(initialPriority);
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(undefined);
  const [dateChoice, setDateChoice] = useState<'today' | 'tomorrow' | 'none'>('today');
  const [customEmoji, setCustomEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPriority(initialPriority);
      setDurationMinutes(undefined);
      setDateChoice('today');
      setCustomEmoji(null);
      setShowEmojiPicker(false);
      setShowPriorityMenu(false);
      setShowDurationMenu(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, initialPriority]);

  if (!isOpen) return null;

  const detectedEmoji = customEmoji ? { emoji: customEmoji, bgClass: 'bg-zinc-100 dark:bg-zinc-800' } : getTaskEmoji(title);

  const handleCreate = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const today = getTodayJalaliKey();
      let due_date: string | undefined = undefined;
      if (dateChoice === 'today') due_date = today;
      else if (dateChoice === 'tomorrow') due_date = addJalaliDays(today, 1);

      // Prefix custom emoji if set
      let finalTitle = title.trim();
      if (customEmoji && !finalTitle.startsWith(customEmoji)) {
        finalTitle = `${customEmoji} ${finalTitle}`;
      }

      const created = await taskRepo.create({
        entry_id: null,
        title: finalTitle,
        status: 'open',
        priority,
        duration_minutes: durationMinutes,
        due_date,
        tag_ids: [],
      });

      onTaskCreated(created.id);
      onClose();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = () => {
    switch (priority) {
      case 3:
        return { label: 'HIGH', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
      case 2:
        return { label: 'MEDIUM', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 1:
        return { label: 'LOW', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      default:
        return { label: 'TO-DO', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700' };
    }
  };

  const pBadge = getPriorityBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Sheet Modal */}
      <div
        dir="rtl"
        className="relative w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 p-5 z-10 animate-in slide-in-from-bottom-6 duration-200 select-none"
      >
        {/* Top Handle / Close */}
        <div className="flex items-center justify-between pb-3">
          <span className="text-xs font-semibold text-muted-foreground">افزودن به To-do</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Input Row with Emoji preview */}
        <div className="flex items-center gap-3 py-2 border-b border-border/50">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="تایپ کنید تا شروع شود..."
            className="flex-1 text-base sm:text-lg font-medium bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
          />

          {/* Emoji Badge Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 cursor-pointer shadow-2xs transition-transform active:scale-95 ${detectedEmoji.bgClass}`}
            title="انتخاب آیکون"
          >
            {detectedEmoji.emoji}
          </button>
        </div>

        {/* Quick Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-border/40">
            {EMOJI_PRESETS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  setCustomEmoji(em);
                  setShowEmojiPicker(false);
                }}
                className="w-8 h-8 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-lg shrink-0 transition-transform active:scale-90"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Options & Submit Row */}
        <div className="flex items-center justify-between gap-2 pt-4">
          {/* Action Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority Selector Chip */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPriorityMenu((prev) => !prev);
                  setShowDurationMenu(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${pBadge.color}`}
              >
                <span>{pBadge.label}</span>
                <span className="text-[9px] opacity-70">▾</span>
              </button>

              {showPriorityMenu && (
                <div className="absolute top-full mt-1.5 right-0 bg-popover text-popover-foreground rounded-2xl shadow-xl border border-border p-1.5 z-30 min-w-[130px] flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPriority(3);
                      setShowPriorityMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-right"
                  >
                    <span>▲ HIGH</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriority(2);
                      setShowPriorityMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-right"
                  >
                    <span>● MEDIUM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriority(1);
                      setShowPriorityMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors text-right"
                  >
                    <span>▼ LOW</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriority(undefined);
                      setShowPriorityMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/10 transition-colors text-right"
                  >
                    <span>TO-DO</span>
                  </button>
                </div>
              )}
            </div>

            {/* Duration Selector Chip */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowDurationMenu((prev) => !prev);
                  setShowPriorityMenu(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1 active:scale-95 ${
                  durationMinutes
                    ? 'bg-secondary border-border text-foreground font-semibold'
                    : 'bg-muted/40 dark:bg-white/5 border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <RiTimeLine className="w-3.5 h-3.5" />
                <span>{durationMinutes ? `${durationMinutes} دقیقه` : 'مدت'}</span>
              </button>

              {showDurationMenu && (
                <div className="absolute top-full mt-1.5 right-0 bg-popover text-popover-foreground rounded-2xl shadow-xl border border-border p-1.5 z-30 min-w-[120px] flex flex-col gap-1">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDurationMinutes(durationMinutes === opt.value ? undefined : opt.value);
                        setShowDurationMenu(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors text-right ${
                        durationMinutes === opt.value
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] opacity-70">{opt.short}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Choice Chip (Today / Tomorrow / None) */}
            <button
              type="button"
              onClick={() => {
                setDateChoice((prev) => (prev === 'today' ? 'tomorrow' : prev === 'tomorrow' ? 'none' : 'today'));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1 active:scale-95 ${
                dateChoice !== 'none'
                  ? 'bg-secondary border-border text-foreground font-semibold'
                  : 'bg-muted/40 dark:bg-white/5 border-border/60 text-muted-foreground'
              }`}
            >
              <RiCalendarLine className="w-3.5 h-3.5" />
              <span>{dateChoice === 'today' ? 'امروز' : dateChoice === 'tomorrow' ? 'فردا' : 'بدون تاریخ'}</span>
            </button>
          </div>

          {/* Submit Arrow Button (Black/White circle matching Tiimo) */}
          <button
            type="button"
            disabled={!title.trim() || isSubmitting}
            onClick={handleCreate}
            className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition cursor-pointer shrink-0"
            title="ثبت تسک"
          >
            <RiArrowUpLine className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  );
};
