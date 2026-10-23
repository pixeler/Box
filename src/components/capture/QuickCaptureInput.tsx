import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import type { Tag, Box, TimeOfDay } from '@/types/models';
import { entryRepo, taskRepo, noteRepo, tagRepo, boxRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey, toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { extractQuickTokens } from '@/lib/quick-parser';
import { JalaliDatePicker } from '../calendar/JalaliDatePicker';
import { PriorityPickerSheet } from '../pickers/PriorityPickerSheet';
import { BoxPickerSheet } from '../pickers/BoxPickerSheet';
import { TimeOfDayPickerSheet } from '../pickers/TimeOfDayPickerSheet';
import { TagPickerSheet } from '../pickers/TagPickerSheet';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  EggFriedIcon,
  Sun01Icon,
  MoonStarIcon,
} from '@hugeicons/core-free-icons';

const BlockNoteEditor = React.lazy(() =>
  import('@/components/editor/BlockNoteEditor').then((m) => ({ default: m.BlockNoteEditor }))
);
import { QuickTagSuggest } from './QuickTagSuggest';
import { QuickCommandPalette } from './QuickCommandPalette';
import {
  RiCheckLine,
  RiCheckboxLine,
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiPushpinLine,
  RiPushpinFill,
  RiLink,
  RiImageLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
  RiInboxArchiveLine,
  RiSparklingLine,
  RiAlarmLine,
  RiCloseLine,
} from '@remixicon/react';
import { ReminderPickerSheet } from '../pickers/ReminderPickerSheet';

import { toast } from '@/lib/toast';
import { playPencilWriteSound } from '@/lib/sound';

interface QuickCaptureInputProps {
  currentSelectedDateKey: string;
  onItemCreated: (createdItemId?: string) => void | Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  defaultBoxId?: string | null;
  initialTimeOfDay?: TimeOfDay | null;
  /**
   * `modal` is the global bottom sheet / centered popup. `inline` renders the
   * exact same composer in place, stays open after a submit, and closes through
   * its own "بستن" action.
   */
  variant?: 'modal' | 'inline';
  className?: string;
}

type CaptureTab = 'task' | 'note';

export const QuickCaptureInput: React.FC<QuickCaptureInputProps> = ({
  currentSelectedDateKey,
  onItemCreated,
  isOpen,
  onClose,
  onOpen,
  defaultBoxId,
  initialTimeOfDay,
  variant = 'modal',
  className,
}) => {
  const isInline = variant === 'inline';
  const isActive = Boolean(isOpen) || isInline;
  const [activeTab, _setActiveTab] = useState<CaptureTab>('task');
  void _setActiveTab;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(currentSelectedDateKey);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string | null>(null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(undefined);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(initialTimeOfDay || 'anytime');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<string>(defaultBoxId || '');
  const [isPinned, setIsPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timeOfDayPickerOpen, setTimeOfDayPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);
  const [reminder, setReminder] = useState<string | null>(null);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  // Slash commands and # tag autocomplete states
  const [tagSuggestQuery, setTagSuggestQuery] = useState<string | null>(null);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const noteBodyRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);

  // Track if priority/date were set via title regex tokens
  const hadDateTokenRef = useRef(false);
  const hadPriorityTokenRef = useRef(false);

  const isAndroid = typeof navigator !== 'undefined' && (
    /android/i.test(navigator.userAgent) ||
    Boolean((window as any)?.Capacitor?.getPlatform?.() === 'android')
  );

  const todayKey = getTodayJalaliKey();

  useEffect(() => {
    if (isActive) {
      setTimeOfDay(initialTimeOfDay || 'anytime');
    }
  }, [isActive, initialTimeOfDay]);

  // Parse title tokens in real time (for task mode)
  const parsedResult = useMemo(() => {
    if (activeTab !== 'task') {
      return { rawText: title, cleanTitle: title, tokens: [], tags: [] };
    }
    return extractQuickTokens(title, currentSelectedDateKey);
  }, [title, activeTab, currentSelectedDateKey]);

  // Load tags and boxes
  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
    boxRepo.list().then(setBoxes);
  }, [isActive, tagPickerOpen]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isOpen || isInline) {
      setKeyboardHeight(0);
      return;
    }

    let cleanup: (() => void) | undefined;
    import('@capacitor/keyboard')
      .then(({ Keyboard }) => {
        const showSub = Keyboard.addListener('keyboardWillShow', (info) => {
          if (info.keyboardHeight > 0) {
            setKeyboardHeight(info.keyboardHeight);
          }
        });
        const hideSub = Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
        });
        cleanup = () => {
          showSub.then((h) => h.remove());
          hideSub.then((h) => h.remove());
        };
      })
      .catch(() => {});

    const handleVisualViewport = () => {
      if (window.visualViewport) {
        const diff = window.innerHeight - window.visualViewport.height;
        if (diff > 120) {
          setKeyboardHeight(diff);
        } else {
          setKeyboardHeight(0);
        }
      }
    };
    window.visualViewport?.addEventListener('resize', handleVisualViewport);

    return () => {
      cleanup?.();
      window.visualViewport?.removeEventListener('resize', handleVisualViewport);
    };
  }, [isOpen, isInline]);

  // When opening or switching tab, focus title input immediately and sync due date
  useEffect(() => {
    if (isActive) {
      if (defaultBoxId) {
        setSelectedBox(defaultBoxId);
      }
      setDueDate(currentSelectedDateKey);
      // Trigger focus smoothly with tiny delay so keyboard and sheet emerge together without bounce
      const delay = 60;
      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.style.height = 'auto';
          titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
          titleInputRef.current.focus({ preventScroll: true });
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isActive, activeTab, currentSelectedDateKey, defaultBoxId]);

  // Auto-resize title textarea as user types or changes content
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
    }
  }, [title, isActive, activeTab]);

  // Keep due date updated with selected date if not overridden
  useEffect(() => {
    if (!hadDateTokenRef.current) {
      setDueDate(currentSelectedDateKey);
    }
  }, [currentSelectedDateKey]);

  // Real-time synchronization of parsed properties with chips/state
  useEffect(() => {
    if (activeTab !== 'task') return;

    // 1. Date synchronization
    const hasDateToken = parsedResult.tokens.some((t) => t.type === 'date');
    if (hasDateToken && parsedResult.dueDate) {
      setDueDate(parsedResult.dueDate);
      hadDateTokenRef.current = true;
    } else if (hadDateTokenRef.current && !hasDateToken) {
      setDueDate(currentSelectedDateKey);
      hadDateTokenRef.current = false;
    }

    // 2. Priority synchronization
    const hasPriorityToken = parsedResult.tokens.some((t) => t.type === 'priority');
    if (hasPriorityToken && parsedResult.priority !== undefined) {
      setPriority(parsedResult.priority);
      hadPriorityTokenRef.current = true;
    } else if (hadPriorityTokenRef.current && !hasPriorityToken) {
      setPriority(undefined);
      hadPriorityTokenRef.current = false;
    }

    // 3. Tag synchronization (auto-associate detected existing tags)
    if (parsedResult.tags.length > 0) {
      parsedResult.tags.forEach((tName) => {
        const existing = Object.values(tagsMap).find(
          (t) => t.name.toLowerCase() === tName.toLowerCase()
        );
        if (existing && !tagIds.includes(existing.id)) {
          setTagIds((prev) => [...prev, existing.id]);
        }
      });
    }
  }, [parsedResult, activeTab, currentSelectedDateKey, tagsMap, tagIds]);

  // Global key bindings: 'N' to open, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')));

      if (!isActive) {
        if (
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey &&
          (e.key === 'n' || e.key === 'N' || e.key === 'د' || e.code === 'KeyN') &&
          !isInput
        ) {
          e.preventDefault();
          onOpen?.();
        }
        return;
      }

      if (e.key === 'Escape' || e.code === 'Escape') {
        // The composer can sit inside a dialog (e.g. the note editor). Escape
        // belongs to the composer while it is open, so the dialog stays put.
        e.preventDefault();
        e.stopImmediatePropagation();
        if (tagSuggestQuery !== null) {
          setTagSuggestQuery(null);
          return;
        }
        if (commandPaletteQuery !== null) {
          setCommandPaletteQuery(null);
          return;
        }
        if (datePickerOpen) {
          setDatePickerOpen(false);
          return;
        }
        if (boxPickerOpen) {
          setBoxPickerOpen(false);
          return;
        }
        if (priorityPickerOpen) {
          setPriorityPickerOpen(false);
          return;
        }
        if (timeOfDayPickerOpen) {
          setTimeOfDayPickerOpen(false);
          return;
        }
        if (reminderPickerOpen) {
          setReminderPickerOpen(false);
          return;
        }
        if (tagPickerOpen) {
          setTagPickerOpen(false);
          return;
        }
        handleClose();
      }
    };
    // Capture phase, so an enclosing dialog never sees the Escape first.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isActive,
    datePickerOpen,
    boxPickerOpen,
    priorityPickerOpen,
    timeOfDayPickerOpen,
    reminderPickerOpen,
    tagPickerOpen,
    tagSuggestQuery,
    commandPaletteQuery,
    onOpen,
  ]);

  // Check cursor position for `#` and `/` triggers
  const checkTriggers = (val: string, cursorIndex: number) => {
    if (activeTab !== 'task') {
      setTagSuggestQuery(null);
      setCommandPaletteQuery(null);
      return;
    }

    const beforeCursor = val.substring(0, cursorIndex);

    // Slash command trigger: `/...`
    const slashMatch = beforeCursor.match(/(?:^|\s)\/([^\s]*)$/);
    if (slashMatch) {
      setCommandPaletteQuery(slashMatch[1]);
      setTagSuggestQuery(null);
      return;
    } else {
      setCommandPaletteQuery(null);
    }

    // Tag suggest trigger: `#...`
    const tagMatch = beforeCursor.match(/(?:^|\s)#([^\s]*)$/);
    if (tagMatch) {
      setTagSuggestQuery(tagMatch[1]);
      setCommandPaletteQuery(null);
      return;
    } else {
      setTagSuggestQuery(null);
    }
  };

  const handleSelectTagFromSuggest = async (tagName: string) => {
    let tag = Object.values(tagsMap).find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase()
    );
    if (!tag) {
      const newTag = await tagRepo.getOrCreate(tagName, 'manual');
      tag = newTag;
      setTagsMap((prev) => ({ ...prev, [newTag.id]: newTag }));
    }
    if (tag && !tagIds.includes(tag.id)) {
      setTagIds((prev) => [...prev, tag.id]);
    }

    // Replace `#query` in title with `#tagName ` or append if triggered via button
    const textarea = titleInputRef.current;
    const cursorPos = textarea ? textarea.selectionStart : title.length;
    const beforeCursor = title.substring(0, cursorPos);
    const afterCursor = title.substring(cursorPos);

    let newTitle: string;
    let newPos: number;

    const hasHashMatch = /(?:^|\s)#([^\s]*)$/.test(beforeCursor);
    if (hasHashMatch) {
      const updatedBefore = beforeCursor.replace(/(?:^|\s)#([^\s]*)$/, (match) => {
        const hasLeadingSpace = match.startsWith(' ');
        return `${hasLeadingSpace ? ' ' : ''}#${tagName} `;
      });
      newTitle = updatedBefore + afterCursor;
      newPos = updatedBefore.length;
    } else {
      const trimmed = title.trim();
      newTitle = trimmed ? `${trimmed} #${tagName} ` : `#${tagName} `;
      newPos = newTitle.length;
    }

    setTitle(newTitle);
    setTagSuggestQuery(null);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const removeSlashFromTitle = () => {
    const textarea = titleInputRef.current;
    const cursorPos = textarea ? textarea.selectionStart : title.length;
    const beforeCursor = title.substring(0, cursorPos);
    const afterCursor = title.substring(cursorPos);

    const updatedBefore = beforeCursor.replace(/(?:^|\s)\/([^\s]*)$/, '');
    const newTitle = (updatedBefore + afterCursor).replace(/\s+/g, ' ');
    setTitle(newTitle);
    setCommandPaletteQuery(null);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = updatedBefore.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleTitleScroll = () => {
    if (backdropRef.current && titleInputRef.current) {
      backdropRef.current.scrollTop = titleInputRef.current.scrollTop;
    }
  };

  const resetDraft = () => {
    setTitle('');
    setDescription('');
    setPriority(undefined);
    setTagIds([]);
    setSelectedBox(defaultBoxId || '');
    setIsPinned(false);
    setIsFullscreen(false);
    setDatePickerOpen(false);
    setBoxPickerOpen(false);
    setReminder(null);
    setReminderPickerOpen(false);
    setDueDate(currentSelectedDateKey);
    setDueTime(null);
    setDurationMinutes(null);
    setRecurrenceRule(null);
    setRecurrenceStartDate(null);
    setRecurrenceEndDate(null);
    setTimeOfDay(initialTimeOfDay || 'anytime');
    setTimeOfDayPickerOpen(false);
    setTagSuggestQuery(null);
    setCommandPaletteQuery(null);
    hadDateTokenRef.current = false;
    hadPriorityTokenRef.current = false;
  };

  const handleClose = () => {
    if (isClosing) return;
    if (isInline) {
      resetDraft();
      onClose?.();
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      resetDraft();
      onClose?.();
    }, 350);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      // The note editor hosts this composer inside its own form, where a
      // bubbling submit would close the note.
      e.stopPropagation();
    }
    if (isSubmittingRef.current) return;

    const rawInputVal = (titleInputRef.current?.value || title).trim();
    if (!rawInputVal) return;

    // Compute clean title (stripping regex tokens) and parsed properties
    const tokensResult = extractQuickTokens(rawInputVal, currentSelectedDateKey);
    const finalCleanTitle = tokensResult.cleanTitle || rawInputVal;

    isSubmittingRef.current = true;
    try {
      const entry = await entryRepo.create({
        raw_text: rawInputVal,
        source: 'text',
        processed: true,
      });

      const effectiveDueDate = dueDate || tokensResult.dueDate || currentSelectedDateKey;
      const effectivePriority = priority !== undefined ? priority : tokensResult.priority;

      // Ensure any detected tags are created and added to tagIds
      const finalTagIds = [...tagIds];
      for (const tName of tokensResult.tags) {
        let existing = Object.values(tagsMap).find(
          (t) => t.name.toLowerCase() === tName.toLowerCase()
        );
        if (!existing) {
          const newTag = await tagRepo.getOrCreate(tName, 'manual');
          existing = newTag;
          setTagsMap((prev) => ({ ...prev, [newTag.id]: newTag }));
        }
        if (existing && !finalTagIds.includes(existing.id)) {
          finalTagIds.push(existing.id);
        }
      }

      let createdId: string | undefined;
      if (activeTab === 'task') {
        playPencilWriteSound();
        const createdTask = await taskRepo.create({
          entry_id: entry.id,
          box_id: selectedBox || null,
          title: finalCleanTitle,
          description: description.trim(),
          status: 'open',
          due_date: effectiveDueDate,
          due_time: dueTime || undefined,
          duration_minutes: durationMinutes || undefined,
          recurrence_rule: recurrenceRule || undefined,
          recurrence_start_date: recurrenceStartDate || effectiveDueDate || undefined,
          recurrence_end_date: recurrenceEndDate || undefined,
          priority: effectivePriority,
          tag_ids: finalTagIds,
          pinned: isPinned,
          reminder: reminder || undefined,
          time_of_day: timeOfDay !== 'anytime' ? timeOfDay : (tokensResult.timeOfDay || 'anytime'),
        });
        createdId = createdTask?.id;
        toast.show(
          effectiveDueDate === todayKey
            ? 'تسک به کارهای امروز اضافه شد'
            : 'تسک جدید با موفقیت ایجاد شد'
        );
      } else {
        const bodyContent = description.trim();
        const createdNote = await noteRepo.create({
          entry_id: entry.id,
          box_id: selectedBox || null,
          type: 'note',
          title: rawInputVal,
          body: bodyContent ? `${rawInputVal}\n${bodyContent}` : rawInputVal,
          description: bodyContent || undefined,
          date_key: effectiveDueDate,
          tag_ids: finalTagIds,
          pinned: isPinned,
        });
        createdId = createdNote?.id;
        toast.show('یادداشت جدید با موفقیت ثبت شد');
      }

      await onItemCreated(createdId);
      if (isInline) {
        resetDraft();
        window.setTimeout(() => {
          titleInputRef.current?.focus({ preventScroll: true });
        }, 0);
      } else {
        setIsClosing(true);
        setTimeout(() => {
          setIsClosing(false);
          resetDraft();
          onClose?.();
        }, 350);
      }
    } catch (err) {
      console.error('Failed to create item:', err);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const applyFormat = (format: 'h1' | 'italic' | 'bold' | 'todo' | 'link' | 'image') => {
    const textarea = noteBodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = description;
    const selectedText = val.substring(start, end);

    let replacement = '';
    switch (format) {
      case 'h1':
        replacement = `\n# ${selectedText || 'عنوان'}\n`;
        break;
      case 'italic':
        replacement = `*${selectedText || 'متن کج'}*`;
        break;
      case 'bold':
        replacement = `**${selectedText || 'متن برجسته'}**`;
        break;
      case 'todo':
        replacement = `\n- [ ] ${selectedText || 'مورد جدید'}\n`;
        break;
      case 'link':
        replacement = `[${selectedText || 'عنوان پیوند'}](url)`;
        break;
      case 'image':
        replacement = `![${selectedText || 'توضیح تصویر'}](url)`;
        break;
    }

    const newVal = val.substring(0, start) + replacement + val.substring(end);
    setDescription(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  };

  // Render tokens in the mirrored backdrop
  const renderHighlightedTitle = () => {
    if (activeTab !== 'task' || !parsedResult.tokens.length) {
      return null;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    parsedResult.tokens.forEach((token, idx) => {
      if (token.start > lastIndex) {
        elements.push(
          <span key={`plain-${lastIndex}`} className="invisible">
            {title.substring(lastIndex, token.start)}
          </span>
        );
      }

      // Sleek, minimal neutral highlight using theme variables
      const highlightClasses =
        'bg-muted/80 dark:bg-white/10 text-transparent border-b border-foreground/30 rounded-xs';

      elements.push(
        <span
          key={`token-${idx}`}
          className={`inline py-0 transition-colors ${highlightClasses}`}
        >
          {token.text}
        </span>
      );
      lastIndex = token.end;
    });

    if (lastIndex < title.length) {
      elements.push(
        <span key={`plain-${lastIndex}`} className="invisible">
          {title.substring(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);
  const selectedBoxObj = boxes.find((b) => b.id === selectedBox);

  const renderDateText = () => {
    if (!dueDate) return 'تاریخ';
    let base = dueDate === todayKey ? 'امروز' : formatJalaliDisplay(parseJalaliKey(dueDate));
    if (dueTime) {
      base += ` (${toPersianDigits(dueTime)})`;
    }
    if (recurrenceRule && recurrenceRule !== 'none') {
      base += ` ↻`;
    }
    return base;
  };

  if (!isInline && !isOpen && !isClosing) return null;

  const isNoteFullscreen = !isInline && isFullscreen && activeTab === 'note';

  const panel = (
    <>
        {/* Top Left Action Buttons: Fullscreen & Close */}
        <div className={`absolute ${isNoteFullscreen ? 'left-6 md:left-14 top-6 md:top-8' : 'left-6 top-6'} flex items-center gap-1 z-30 pointer-events-auto`}>
          {activeTab === 'note' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(!isFullscreen);
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer relative z-30 pointer-events-auto"
              title={isFullscreen ? 'کوچک کردن' : 'تمام‌صفحه'}
            >
              {isFullscreen ? (
                <RiFullscreenExitLine className="w-5 h-5" />
              ) : (
                <RiFullscreenLine className="w-5 h-5" />
              )}
            </button>
          )}
          {/* Close button removed for minimal Todoist style */}
        </div>

        <form
          onSubmit={handleSubmit}
          className={`flex-1 flex flex-col justify-between ${
            isFullscreen && activeTab === 'note' ? 'max-w-4xl mx-auto w-full h-full' : ''
          }`}
        >
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-3 min-h-0">
            {/* Title Textarea Container with Mirrored Backdrop */}
            <div className="relative w-full">
              {/* Mirrored Backdrop for in-place token highlighting */}
              {activeTab === 'task' && (
                <div
                  ref={backdropRef}
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none overflow-hidden select-none whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-bold text-xl leading-snug px-0 pt-0"
                  dir="rtl"
                >
                  {renderHighlightedTitle()}
                </div>
              )}

              {/* Title Textarea: auto-expanding to multiple lines with word wrap */}
              <textarea
                ref={titleInputRef}
                rows={1}
                value={title}
                enterKeyHint="send"
                onScroll={handleTitleScroll}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitle(val);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  checkTriggers(val, e.target.selectionStart);
                }}
                onClick={(e) => {
                  checkTriggers(title, (e.target as HTMLTextAreaElement).selectionStart);
                }}
                onKeyUp={(e) => {
                  if (
                    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
                      e.key
                    )
                  ) {
                    checkTriggers(title, (e.target as HTMLTextAreaElement).selectionStart);
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent textarea cursor moving when navigating dropdowns
                  if (
                    (tagSuggestQuery !== null || commandPaletteQuery !== null) &&
                    (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab')
                  ) {
                    e.preventDefault();
                    return;
                  }
                  const isEnter =
                    e.key === 'Enter' ||
                    e.code === 'Enter' ||
                    e.code === 'NumpadEnter' ||
                    e.keyCode === 13;
                  if (isEnter && !e.shiftKey) {
                    e.preventDefault();
                    setTagSuggestQuery(null);
                    setCommandPaletteQuery(null);
                    handleSubmit();
                  }
                }}
                placeholder={
                  activeTab === 'task'
                    ? 'چی کاره‌ای؟ (فردا، #تگ، p1، یا / را تایپ کنید)'
                    : 'چی تو ذهنته؟'
                }
                className={`relative z-10 w-full font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500 placeholder:font-normal transition-all resize-none overflow-y-auto max-h-[140px] leading-snug break-words [overflow-wrap:anywhere] px-0 ${
                  isFullscreen && activeTab === 'note'
                    ? 'text-2xl md:text-3xl'
                    : 'text-xl'
                }`}
                dir="rtl"
              />

              {/* Tag Autocomplete Popover (triggered by #) */}
              {tagSuggestQuery !== null && (
                <QuickTagSuggest
                  query={tagSuggestQuery}
                  tags={Object.values(tagsMap)}
                  selectedTagIds={tagIds}
                  onSelectTag={handleSelectTagFromSuggest}
                  onClose={() => setTagSuggestQuery(null)}
                />
              )}

              {/* Slash Command Palette Popover (triggered by /) */}
              {commandPaletteQuery !== null && (
                <QuickCommandPalette
                  query={commandPaletteQuery}
                  boxes={boxes}
                  onSelectDueDate={(d) => {
                    setDueDate(d);
                    removeSlashFromTitle();
                  }}
                  onOpenDatePicker={() => {
                    removeSlashFromTitle();
                    setDatePickerOpen(true);
                  }}
                  onSelectPriority={(p) => {
                    setPriority(p);
                    removeSlashFromTitle();
                  }}
                  onOpenTagPicker={() => {
                    removeSlashFromTitle();
                    setTagSuggestQuery('');
                  }}
                  onSelectBox={(bId) => {
                    setSelectedBox(bId);
                    removeSlashFromTitle();
                  }}
                  onClose={() => setCommandPaletteQuery(null)}
                />
              )}
            </div>

            {/* Live Detected Regex Properties Indicator Bar (Minimal & Neutral) */}
            {activeTab === 'task' && parsedResult.tokens.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 px-0.5 flex-wrap text-xs animate-fadeIn">
                <span className="text-[11px] text-muted-foreground/75 flex items-center gap-1 font-medium shrink-0">
                  <RiSparklingLine className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>استخراج شده:</span>
                </span>
                {parsedResult.tokens.map((tok, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 bg-muted text-muted-foreground border border-border/70 dark:bg-white/5 dark:border-white/10 dark:text-zinc-300"
                  >
                    <span>{tok.label || tok.text}</span>
                  </span>
                ))}
                <span className="text-[10px] text-muted-foreground/50 mr-auto shrink-0">
                  (حذف از عنوان)
                </span>
              </div>
            )}

            {/* Note Property Chips Row (under title in Note view) */}
            {activeTab === 'note' && (
              <div className="flex items-center gap-2 mt-3.5 overflow-x-auto no-scrollbar py-0.5">
                {/* پین‌کردن */}
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    isPinned
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isPinned ? (
                    <RiPushpinFill className="w-3.5 h-3.5 text-foreground" />
                  ) : (
                    <RiPushpinLine className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>{isPinned ? 'پین‌شده' : 'پین‌کردن'}</span>
                </button>

                {/* تاریخ */}
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    dueDate
                      ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiCalendarLine
                    className={`w-3.5 h-3.5 ${dueDate ? 'text-foreground' : 'text-muted-foreground'}`}
                  />
                  <span>{renderDateText()}</span>
                </button>

                {/* برچسب */}
                <button
                  type="button"
                  onClick={() => setTagPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    selectedTags.length > 0
                      ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiPriceTag3Line
                    className={`w-3.5 h-3.5 ${
                      selectedTags.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  />
                  <span>
                    {selectedTags.length > 0
                      ? selectedTags.map((t) => `#${t.name}`).join(' ')
                      : 'برچسب'}
                  </span>
                </button>

                {/* جعبه */}
                <button
                  type="button"
                  onClick={() => setBoxPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    selectedBox
                      ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiInboxArchiveLine
                    className={`w-3.5 h-3.5 ${selectedBox ? 'text-foreground' : 'text-muted-foreground'}`}
                  />
                  <span>{selectedBoxObj?.title || 'جعبه'}</span>
                </button>
              </div>
            )}

            {/* Description / Note body */}
            {activeTab === 'note' ? (
              <div
                className={`flex-1 overflow-y-auto mt-3 border-t border-border/70 dark:border-white/10 pt-2 ${
                  isNoteFullscreen ? 'min-h-[60vh]' : 'min-h-[160px] max-h-[46vh]'
                }`}
              >
                <React.Suspense
                  fallback={
                    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                      در حال آماده‌سازی ویرایشگر...
                    </div>
                  }
                >
                  <BlockNoteEditor
                    initialContent={description}
                    onChange={(md: string) => setDescription(md)}
                    placeholder="متن یادداشت یا خاطره خود را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                    minHeight={isNoteFullscreen ? '60vh' : '160px'}
                  />
                </React.Suspense>
              </div>
            ) : (
              <textarea
                ref={noteBodyRef}
                value={description}
                enterKeyHint="send"
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  const isEnter =
                    e.key === 'Enter' ||
                    e.code === 'Enter' ||
                    e.code === 'NumpadEnter' ||
                    e.keyCode === 13;
                  if (isEnter && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="توضیحات"
                rows={2}
                className="w-full resize-none text-sm text-foreground/85 bg-transparent outline-none placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500 placeholder:font-normal leading-relaxed mt-2.5 min-h-[46px] max-h-[92px]"
                dir="rtl"
              />
            )}
          </div>

          {/* Middle Toolbars */}
          <div className="w-full">
            {/* Task Tool Bar */}
            {activeTab === 'task' && (
              <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar py-0.5">
                {/* پین کردن - گزینه اول، بدون حاشیه و بدون زاویه */}
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  className="p-1.5 flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0"
                  title={isPinned ? 'پین‌شده (حذف پین)' : 'پین کردن'}
                >
                  {isPinned ? (
                    <RiPushpinFill className="w-4 h-4 text-foreground" />
                  ) : (
                    <RiPushpinLine className="w-4 h-4 text-muted-foreground/75 hover:text-foreground transition-colors" />
                  )}
                </button>

                {/* امروز */}
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    dueDate
                      ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiCalendarLine
                    className={`w-3.5 h-3.5 ${dueDate ? 'text-foreground' : 'text-muted-foreground'}`}
                  />
                  <span>{renderDateText()}</span>
                </button>

                {/* اولویت */}
                <button
                  type="button"
                  onClick={() => setPriorityPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    priority === 3
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
                      : priority === 2
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                      : priority === 1
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {priority === 3 ? (
                    <RiFlagFill className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  ) : priority === 2 ? (
                    <RiFlagFill className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  ) : priority === 1 ? (
                    <RiFlagFill className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  ) : (
                    <RiFlagLine className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>
                    {priority === 3
                      ? 'فوری'
                      : priority === 2
                      ? 'متوسط'
                      : priority === 1
                      ? 'کم'
                      : 'اولویت'}
                  </span>
                </button>

                {/* بخش زمانی روز (صبح / ظهر / عصر و شب / هر زمان) */}
                <button
                  type="button"
                  onClick={() => setTimeOfDayPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    timeOfDay && timeOfDay !== 'anytime'
                      ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <HugeiconsIcon
                    icon={
                      timeOfDay === 'morning'
                        ? EggFriedIcon
                        : timeOfDay === 'day'
                        ? Sun01Icon
                        : timeOfDay === 'evening'
                        ? MoonStarIcon
                        : Clock01Icon
                    }
                    size={14}
                    className={timeOfDay !== 'anytime' ? 'text-foreground' : 'text-muted-foreground'}
                  />
                  <span>
                    {timeOfDay === 'morning'
                      ? 'صبح'
                      : timeOfDay === 'day'
                      ? 'ظهر'
                      : timeOfDay === 'evening'
                      ? 'عصر و شب'
                      : 'هر زمان'}
                  </span>
                </button>

                {/* برچسب */}
                <button
                  type="button"
                  onClick={() => setTagPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    selectedTags.length > 0
                      ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiPriceTag3Line
                    className={`w-3.5 h-3.5 ${
                      selectedTags.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  />
                  <span>
                    {selectedTags.length > 0
                      ? selectedTags.map((t) => `#${t.name}`).join(' ')
                      : 'برچسب'}
                  </span>
                </button>

                {/* یادآور */}
                <button
                  type="button"
                  onClick={() => setReminderPickerOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                    reminder
                      ? 'bg-primary/15 border-primary/40 text-primary font-bold shadow-2xs'
                      : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                  title="تنظیم یادآور"
                >
                  <RiAlarmLine
                    className={`w-3.5 h-3.5 ${reminder ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span>{reminder || 'یادآور'}</span>
                </button>
              </div>
            )}

            {/* Note Formatting Bar */}
            {activeTab === 'note' && (
              <div className="flex items-center gap-5 pb-3 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => applyFormat('h1')}
                  className="hover:text-foreground text-sm font-bold font-sans transition-colors cursor-pointer"
                  title="سرتیتر H1"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('italic')}
                  className="hover:text-foreground italic font-serif text-sm transition-colors cursor-pointer"
                  title="کج (Italic)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('bold')}
                  className="hover:text-foreground font-bold text-sm transition-colors cursor-pointer"
                  title="برجسته (Bold)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('todo')}
                  className="hover:text-foreground transition-colors cursor-pointer"
                  title="لیست کارها"
                >
                  <RiCheckboxLine className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('link')}
                  className="hover:text-foreground transition-colors cursor-pointer"
                  title="افزودن پیوند"
                >
                  <RiLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('image')}
                  className="hover:text-foreground transition-colors cursor-pointer"
                  title="افزودن تصویر"
                >
                  <RiImageLine className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Bottom bar: the modal keeps the compact check, inline exposes both actions */}
            {isInline ? (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!title.trim()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-30 active:scale-95 cursor-pointer"
                    title="افزودن تسک"
                  >
                    <RiCheckLine className="size-3.5 stroke-[2.5]" />
                    افزودن
                  </button>
                  <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
                    Enter برای افزودن
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 cursor-pointer"
                >
                  <RiCloseLine className="size-3.5" />
                  بستن
                </button>
              </div>
            ) : (
              (!isAndroid || activeTab !== 'task') && (
                <div className="flex items-center justify-start pt-2.5 border-t border-border">
                  <button
                    type="submit"
                    disabled={!title.trim()}
                    className="size-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-xs transition-colors cursor-pointer active:scale-95"
                    title="ایجاد تسک"
                  >
                    <RiCheckLine className="size-4 stroke-[2.5]" />
                  </button>
                </div>
              )
            )}
          </div>
        </form>

        {/* Date Picker Modal (Full-width bottom sheet) */}
        {datePickerOpen && (
          <JalaliDatePicker
            value={dueDate}
            timeValue={dueTime}
            durationMinutes={durationMinutes}
            repeatValue={recurrenceRule}
            recurrenceStartDate={recurrenceStartDate || dueDate}
            recurrenceEndDate={recurrenceEndDate}
            onChange={(d) => {
              setDueDate(d);
              hadDateTokenRef.current = true;
              setDatePickerOpen(false);
            }}
            onDateTimeChange={(res) => {
              setDueDate(res.dateKey);
              setDueTime(res.time || null);
              setDurationMinutes(res.durationMinutes || null);
              setRecurrenceRule(res.repeat || null);
              setRecurrenceStartDate(res.recurrenceStartDate || null);
              setRecurrenceEndDate(res.recurrenceEndDate || null);
              hadDateTokenRef.current = true;
              setDatePickerOpen(false);
            }}
            onClose={() => setDatePickerOpen(false)}
          />
        )}



        {/* Priority Picker Sheet */}
        <PriorityPickerSheet
          isOpen={priorityPickerOpen}
          onClose={() => setPriorityPickerOpen(false)}
          value={priority}
          onChange={(p) => {
            setPriority(p);
            hadPriorityTokenRef.current = true;
          }}
        />

        {/* Time of Day Picker Sheet */}
        <TimeOfDayPickerSheet
          isOpen={timeOfDayPickerOpen}
          onClose={() => setTimeOfDayPickerOpen(false)}
          value={timeOfDay}
          onChange={(tod) => setTimeOfDay(tod)}
        />

        {/* Box Picker Sheet */}
        <BoxPickerSheet
          isOpen={boxPickerOpen}
          onClose={() => setBoxPickerOpen(false)}
          boxes={boxes}
          selectedBoxId={selectedBox}
          onSelectBox={(bId) => setSelectedBox(bId || '')}
        />

        {/* Reminder Picker Sheet */}
        <ReminderPickerSheet
          isOpen={reminderPickerOpen}
          onClose={() => setReminderPickerOpen(false)}
          value={reminder}
          onChange={(r) => setReminder(r)}
        />

        {/* Tag Picker Sheet */}
        <TagPickerSheet
          isOpen={tagPickerOpen}
          onClose={() => setTagPickerOpen(false)}
          selectedTagIds={tagIds}
          onToggleTag={(tId) => {
            setTagIds((prev) =>
              prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId]
            );
          }}
        />
      </>
  );

  if (isInline) {
    return (
      <div
        dir="rtl"
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          'w-full overflow-visible rounded-2xl border border-border/70 bg-card px-4 pb-2 pt-3 font-sans text-right text-card-foreground shadow-sm',
          className
        )}
      >
        {panel}
      </div>
    );
  }

  const portalTarget =
    typeof document !== 'undefined'
      ? isNoteFullscreen
        ? document.body
        : getOverlayPortalTarget()
      : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={
        isNoteFullscreen
          ? 'fixed inset-0 z-[100] w-screen h-screen flex flex-col bg-black/65 sm:backdrop-blur-xs select-none'
          : `absolute inset-0 z-50 flex flex-col justify-end bg-black/60 select-none sm:items-center sm:justify-center sm:p-6 sm:backdrop-blur-xs ${
              isClosing ? 'animate-panel-backdrop-out' : 'animate-panel-backdrop-in'
            }`
      }
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-open={isClosing ? 'false' : 'true'}
        style={{
          transform: keyboardHeight > 0 ? `translate3d(0, -${keyboardHeight}px, 0)` : undefined,
          transition: keyboardHeight > 0 ? 'transform 0.16s cubic-bezier(0.2, 0, 0, 1)' : undefined,
        }}
        className={`bg-card text-card-foreground font-sans text-right flex flex-col overflow-hidden will-change-transform ${
          isNoteFullscreen
            ? 'fixed inset-0 z-[101] w-screen h-screen pb-6 px-6 md:px-14 md:py-8 flex flex-col bg-card'
            : `t-panel-slide relative w-full rounded-t-[28px] shadow-2xl pb-4 px-5 pt-4 max-h-[92%] border-t border-border/80 dark:border-white/10 sm:max-w-[640px] sm:max-h-[85vh] sm:rounded-[28px] sm:border sm:px-6 sm:pb-5 ${
                isClosing ? 'animate-panel-out' : 'animate-panel-in'
              }`
        }`}
        dir="rtl"
      >
        {panel}
      </div>
    </div>,
    portalTarget
  );
};
