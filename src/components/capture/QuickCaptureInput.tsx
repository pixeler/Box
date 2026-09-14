import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Tag, Box } from '@/types/models';
import { entryRepo, taskRepo, noteRepo, tagRepo, boxRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey } from '@/lib/jalali';
import { extractQuickTokens } from '@/lib/quick-parser';
import { JalaliDatePicker } from '../calendar/JalaliDatePicker';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import { BlockNoteEditor } from '@/components/editor/BlockNoteEditor';
import { PriorityPickerSheet } from '../pickers/PriorityPickerSheet';
import { BoxPickerSheet } from '../pickers/BoxPickerSheet';
import { QuickTagSuggest } from './QuickTagSuggest';
import { QuickCommandPalette } from './QuickCommandPalette';
import {
  RiCloseLine,
  RiCheckboxLine,
  RiCalendarScheduleLine,
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiInboxArchiveLine,
  RiPushpinLine,
  RiPushpinFill,
  RiLink,
  RiImageLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
  RiSparklingLine,
} from '@remixicon/react';

import { toast } from '@/lib/toast';

interface QuickCaptureInputProps {
  currentSelectedDateKey: string;
  onItemCreated: () => void | Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  defaultBoxId?: string | null;
}

type CaptureTab = 'task' | 'note';

export const QuickCaptureInput: React.FC<QuickCaptureInputProps> = ({
  currentSelectedDateKey,
  onItemCreated,
  isOpen,
  onClose,
  onOpen,
  defaultBoxId,
}) => {
  const [activeTab, setActiveTab] = useState<CaptureTab>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(currentSelectedDateKey);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(undefined);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<string>(defaultBoxId || '');
  const [isPinned, setIsPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Pickers modal states
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);

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

  const todayKey = getTodayJalaliKey();

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
  }, [isOpen]);

  // When opening or switching tab, focus title input immediately and sync due date
  useEffect(() => {
    if (isOpen) {
      if (defaultBoxId) {
        setSelectedBox(defaultBoxId);
      }
      setDueDate(currentSelectedDateKey);
      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.style.height = 'auto';
          titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
          titleInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, currentSelectedDateKey, defaultBoxId]);

  // Auto-resize title textarea as user types or changes content
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
    }
  }, [title, isOpen, activeTab]);

  // Keep due date updated with selected date if not overridden
  useEffect(() => {
    if (!hadDateTokenRef.current) {
      setDueDate(currentSelectedDateKey);
    }
  }, [currentSelectedDateKey]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

      if (!isOpen) {
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
      } else {
        if (e.key === 'Escape' || e.code === 'Escape') {
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
          if (tagPickerOpen) {
            setTagPickerOpen(false);
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
          e.preventDefault();
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    datePickerOpen,
    tagPickerOpen,
    boxPickerOpen,
    priorityPickerOpen,
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

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
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

    // Replace `#query` in title with `#tagName `
    const textarea = titleInputRef.current;
    const cursorPos = textarea ? textarea.selectionStart : title.length;
    const beforeCursor = title.substring(0, cursorPos);
    const afterCursor = title.substring(cursorPos);

    const updatedBefore = beforeCursor.replace(/(?:^|\s)#([^\s]*)$/, (match) => {
      const hasLeadingSpace = match.startsWith(' ');
      return `${hasLeadingSpace ? ' ' : ''}#${tagName} `;
    });

    const newTitle = updatedBefore + afterCursor;
    setTitle(newTitle);
    setTagSuggestQuery(null);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = updatedBefore.length;
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

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      resetForm();
    }, 240);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority(undefined);
    setTagIds([]);
    setSelectedBox(defaultBoxId || '');
    setIsPinned(false);
    setIsFullscreen(false);
    setDatePickerOpen(false);
    setTagPickerOpen(false);
    setBoxPickerOpen(false);
    setDueDate(currentSelectedDateKey);
    setTagSuggestQuery(null);
    setCommandPaletteQuery(null);
    hadDateTokenRef.current = false;
    hadPriorityTokenRef.current = false;
    onClose?.();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

      if (activeTab === 'task') {
        await taskRepo.create({
          entry_id: entry.id,
          box_id: selectedBox || null,
          title: finalCleanTitle,
          description: description.trim(),
          status: 'open',
          due_date: effectiveDueDate,
          priority: effectivePriority,
          tag_ids: finalTagIds,
        });
        toast.show(
          effectiveDueDate === currentSelectedDateKey
            ? 'تسک به کارهای امروز اضافه شد'
            : 'تسک جدید با موفقیت ایجاد شد'
        );
      } else {
        const bodyContent = description.trim();
        await noteRepo.create({
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
        toast.show('یادداشت جدید با موفقیت ثبت شد');
      }

      await onItemCreated();
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        resetForm();
      }, 240);
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
    if (dueDate === todayKey) return 'امروز';
    return formatJalaliDisplay(parseJalaliKey(dueDate));
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card text-card-foreground font-sans text-right flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen && activeTab === 'note'
            ? 'absolute inset-0 z-50 w-full h-full pb-5 px-6 pt-6'
            : `relative w-full rounded-t-[28px] shadow-2xl pb-4 px-5 pt-5 min-h-[440px] max-h-[92%] border-t border-border/80 dark:border-white/10 ${
                isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
              }`
        }`}
        dir="rtl"
      >
        {/* Top Left Action Buttons: Fullscreen & Close */}
        <div className="absolute left-6 top-6 flex items-center gap-1 z-30 pointer-events-auto">
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
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleClose();
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer relative z-30 pointer-events-auto"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
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
                  className="absolute inset-0 pointer-events-none overflow-hidden select-none whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-bold text-xl leading-snug pl-28 pr-0 pt-0"
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
                className={`relative z-10 w-full font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500 placeholder:font-normal transition-all resize-none overflow-y-auto max-h-[140px] leading-snug break-words [overflow-wrap:anywhere] ${
                  isFullscreen && activeTab === 'note'
                    ? 'text-2xl md:text-3xl pl-28'
                    : 'text-xl pl-28'
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
                    setTagPickerOpen(true);
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
                    <RiPushpinFill className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
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
                  isFullscreen ? 'min-h-[300px]' : 'min-h-[160px] max-h-[46vh]'
                }`}
              >
                <BlockNoteEditor
                  initialContent={description}
                  onChange={(md) => setDescription(md)}
                  placeholder="متن یادداشت یا خاطره خود را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                  minHeight={isFullscreen ? '350px' : '160px'}
                />
              </div>
            ) : (
              <textarea
                ref={noteBodyRef}
                value={description}
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
                placeholder="توضیحات (Enter برای ایجاد تسک، Shift+Enter برای خط بعد)"
                rows={7}
                className="w-full resize-none text-sm text-foreground/90 bg-transparent outline-none placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500 placeholder:font-normal leading-relaxed mt-4 flex-1"
                dir="rtl"
              />
            )}
          </div>

          {/* Middle Toolbars */}
          <div className="w-full">
            {/* Task Tool Bar */}
            {activeTab === 'task' && (
              <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar py-0.5">
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

            {/* Common Bottom Bar: Submit button and mode toggle pills */}
            <div className="flex items-center justify-between pt-3 border-t border-border/70 dark:border-white/10">
              {/* Right side in RTL: اضافه کردن */}
              <button
                type="submit"
                disabled={!title.trim()}
                className="flex items-center gap-1.5 rounded-full bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 disabled:opacity-40 px-5 py-2.5 text-sm font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <span>اضافه کردن</span>
                <kbd className="inline-flex items-center justify-center text-[10px] font-mono text-white/80 bg-white/20 dark:text-zinc-700 dark:bg-black/15 px-1.5 py-0.5 rounded mr-0.5 select-none font-bold">
                  ↵
                </kbd>
              </button>

              {/* Left side in RTL: Mode toggle pills */}
              <div className="flex items-center gap-2">
                {/* کار */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('task');
                    setIsFullscreen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    activeTab === 'task'
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 font-bold shadow-xs'
                      : 'border-border/70 dark:border-white/10 text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  <RiCheckboxLine className="w-4 h-4" />
                  <span>کار</span>
                </button>

                {/* یادداشت */}
                <button
                  type="button"
                  onClick={() => setActiveTab('note')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    activeTab === 'note'
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 font-bold shadow-xs'
                      : 'border-border/70 dark:border-white/10 text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  <RiCalendarScheduleLine className="w-4 h-4" />
                  <span>یادداشت</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Date Picker Modal */}
        {datePickerOpen && (
          <div
            className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs"
            onClick={() => setDatePickerOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="animate-sheet-up">
              <JalaliDatePicker
                value={dueDate}
                onChange={(d) => {
                  setDueDate(d);
                  hadDateTokenRef.current = true;
                  setDatePickerOpen(false);
                }}
                onClose={() => setDatePickerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Tag Picker Modal */}
        {tagPickerOpen && (
          <div
            className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs"
            onClick={() => setTagPickerOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="animate-sheet-up">
              <TagPickerPopover
                selectedTagIds={tagIds}
                onToggleTag={handleToggleTag}
                onClose={() => setTagPickerOpen(false)}
              />
            </div>
          </div>
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

        {/* Box Picker Sheet */}
        <BoxPickerSheet
          isOpen={boxPickerOpen}
          onClose={() => setBoxPickerOpen(false)}
          boxes={boxes}
          selectedBoxId={selectedBox}
          onSelectBox={(bId) => setSelectedBox(bId || '')}
        />
      </div>
    </div>
  );
};
