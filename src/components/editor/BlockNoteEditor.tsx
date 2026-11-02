import React, { useState, useEffect, useRef } from 'react';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems } from '@blocknote/react';
import type { DefaultReactSuggestionItem } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { faDictionary } from '@/lib/editor/faDictionary';
import { TaskRefBlock } from './TaskRefBlock';
import { TaskAddBlock, TaskListBlock } from './TaskAddBlock';
import { BookmarkBlock, isBareUrl } from './BookmarkBlock';
import { BlockHoverHandles } from './BlockHoverHandles';
import { SelectionColorButton } from './EditorColorMenu';
import { TaskPickerPanel, type TaskPickerAnchor } from './TaskPickerPanel';
import type { Task } from '@/types/models';
import { RiBookmarkLine, RiTaskLine } from '@remixicon/react';

// Import required BlockNote styles
import '@blocknote/mantine/style.css';

interface BlockNoteEditorProps {
  initialContent?: string;
  /** Full block JSON from a previous session; preferred over markdown when present. */
  initialContentJson?: string;
  onChange?: (markdown: string) => void;
  onChangeJson?: (json: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  editable?: boolean;
  autoFocus?: boolean;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    taskRef: TaskRefBlock(),
    taskAdd: TaskAddBlock(),
    taskList: TaskListBlock(),
    bookmark: BookmarkBlock(),
  },
});

const TODAY_TOKEN = '{{today_tasks}}';
const OVERDUE_TOKEN = '{{overdue_tasks}}';
/** Left in a note body by older builds, which exported the card's loading text. */
const TASK_LEAK = 'در حال بارگذاری تسک...';
const TASK_TOKENS = new Set([TODAY_TOKEN, OVERDUE_TOKEN]);

/** The block's text, but only when it holds nothing but text. */
const blockPlainText = (block: { content?: unknown }): string => {
  const content = (Array.isArray(block.content) ? block.content : []) as Array<{
    type?: string;
    text?: string;
  }>;
  if (!content.length) return '';
  if (content.some((node) => node.type !== 'text')) return '';
  return content.map((node) => node.text ?? '').join('').trim();
};

/** The placeholder a block stands for, if it holds one. */
const blockToken = (block: { content?: unknown }): string | null => {
  const text = blockPlainText(block);
  if (!text) return null;
  return [...TASK_TOKENS].find((token) => text.includes(token)) ?? null;
};

interface InsertTasksOptions {
  /** Title placed above the list (grouped inserts). */
  title?: string;
  /** When set, a small inline "add task" row closes the list. */
  addDueDate?: string;
}

export const BlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  initialContent,
  initialContentJson,
  onChange,
  onChangeJson,
  placeholder,
  minHeight = '140px',
  className = '',
  editable = true,
  autoFocus = false,
}) => {
  const isLoadedRef = useRef(false);
  const lastMarkdownRef = useRef<string>(initialContent || '');
  // Position of the caret that opened the task submenu (null when closed).
  const [taskPickerAnchor, setTaskPickerAnchor] = useState<TaskPickerAnchor | null>(null);
  // The block a picked task list belongs to. The picker takes focus, so the
  // caret cannot be trusted by the time a task is chosen.
  const cursorBlockRef = useRef<string | null>(null);
  /** A template's task placeholders are expanded once, when the note opens. */
  const tokensHydratedRef = useRef(false);

  // Create BlockNote editor with Persian dictionary
  const editor = useCreateBlockNote(
    {
      schema,
      /**
       * Pasting a page keeps the page: its HTML carries the headings, colors,
       * links and lists. BlockNote otherwise prefers the plain-text flavor,
       * parsed as markdown, which is why pasted text arrived unstyled.
       */
      pasteHandler: ({ event, editor: pasted, defaultPasteHandler }) => {
        const html = event.clipboardData?.getData('text/html') ?? '';
        const text = event.clipboardData?.getData('text/plain') ?? '';

        // A link alone on an otherwise empty line becomes a bookmark card.
        if (!html.trim() && isBareUrl(text)) {
          try {
            const current = pasted.getTextCursorPosition().block;
            const content = (Array.isArray(current.content) ? current.content : []) as Array<{
              type?: string;
              text?: string;
            }>;
            const typed = content.map((node) => node.text ?? '').join('').trim();
            if (!typed) {
              pasted.replaceBlocks([current], [
                { type: 'bookmark', props: { url: text.trim() } },
              ]);
              return true;
            }
          } catch (err) {
            console.warn('Could not turn the pasted link into a card:', err);
          }
        }

        return defaultPasteHandler({ prioritizeMarkdownOverHTML: false });
      },
      dictionary: placeholder
        ? {
            ...faDictionary,
            placeholders: {
              ...faDictionary.placeholders,
              default: placeholder,
            },
          }
        : faDictionary,
    },
    []
  );

  /**
   * A journal template keeps `{{today_tasks}}` / `{{overdue_tasks}}` alone on a
   * line. On open each line becomes one live task list block, so checking or
   * editing a task here changes it everywhere and the template still works on
   * every next day.
   */
  const hydrateTaskTokens = async () => {
    if (tokensHydratedRef.current) return;
    tokensHydratedRef.current = true;

    // Notes written by an older build carry the task card's loading label in
    // their markdown; strip it so the text does not pile up on every save.
    [...editor.document].forEach((block) => {
      const text = blockPlainText(block);
      if (!text.includes(TASK_LEAK)) return;
      const cleaned = text.split(TASK_LEAK).join('').trim();
      try {
        if (cleaned) {
          editor.updateBlock(block, { content: [{ type: 'text', text: cleaned, styles: {} }] });
        } else {
          editor.removeBlocks([block]);
        }
      } catch (err) {
        console.error('Failed to clean a leaked task label:', err);
      }
    });

    const pending = editor.document.filter((block) => blockToken(block) !== null);
    if (!pending.length) return;

    pending.forEach((block) => {
      const scope = blockToken(block) === OVERDUE_TOKEN ? 'overdue' : 'today';
      try {
        editor.replaceBlocks([block], [{ type: 'taskList', props: { scope } }]);
      } catch (err) {
        console.error('Failed to expand a task placeholder:', err);
      }
    });
  };

  // Load initial content (JSON blocks first, then markdown) once editor is ready
  useEffect(() => {
    if (!editor) return;

    let loaded = false;
    if (initialContentJson) {
      try {
        const blocks = JSON.parse(initialContentJson);
        if (Array.isArray(blocks) && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
          lastMarkdownRef.current = initialContent || '';
          isLoadedRef.current = true;
          loaded = true;
        }
      } catch (err) {
        console.warn('BlockNote failed to parse stored blocks, falling back to markdown:', err);
      }
    }

    if (!loaded && initialContent && initialContent.trim()) {
      try {
        const blocks = editor.tryParseMarkdownToBlocks(initialContent);
        if (blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
          lastMarkdownRef.current = initialContent;
          isLoadedRef.current = true;
          loaded = true;
        }
      } catch (err) {
        console.warn('BlockNote failed to parse initial markdown, fallback to plain text:', err);
      }
    }

    if (!loaded && (!initialContent || !initialContent.trim()) && !initialContentJson) {
      try {
        editor.replaceBlocks(editor.document, [{ type: 'paragraph' }]);
        lastMarkdownRef.current = '';
        isLoadedRef.current = true;
      } catch (err) {
        console.warn('BlockNote failed to reset to empty paragraph:', err);
      }
    }

    if (isLoadedRef.current) void hydrateTaskTokens();

    if (autoFocus) {
      setTimeout(() => {
        editor.focus();
      }, 60);
    }
  }, [editor, initialContent, initialContentJson, autoFocus]);

  // Track editor changes and export both markdown (for previews) and block JSON
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange((ed) => {
      isLoadedRef.current = true;

      try {
        onChangeJson?.(JSON.stringify(ed.document));
      } catch (err) {
        console.error('Failed to serialize note blocks:', err);
      }

      if (!onChange) return;
      try {
        const markdown = ed.blocksToMarkdownLossy(ed.document);
        if (markdown !== lastMarkdownRef.current) {
          lastMarkdownRef.current = markdown;
          onChange(markdown);
        }
      } catch (err) {
        console.error('Failed to convert BlockNote blocks to markdown:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [editor, onChange, onChangeJson]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.isEditable = editable;
    }
  }, [editor, editable]);

  // Reactive theme detection for BlockNote (dark vs light)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const isBlockEmpty = (block: { content?: unknown }) => {
    const content = (Array.isArray(block.content) ? block.content : []) as Array<{
      type?: string;
      text?: string;
    }>;
    return content.every((node) => node.type !== 'text' || !(node.text || '').trim());
  };

  /**
   * Opens the task submenu just under the caret that opened the slash menu.
   * Runs after BlockNote removes the "/query" text, so the caret is already in place.
   */
  const openTaskPicker = () => {
    let anchor: TaskPickerAnchor | null = null;
    try {
      cursorBlockRef.current = editor.getTextCursorPosition().block.id;
      const view = editor.prosemirrorView;
      const coords = view.coordsAtPos(view.state.selection.from);
      anchor = { top: coords.top, bottom: coords.bottom, left: coords.left, right: coords.right };
    } catch (err) {
      console.warn('Could not read the caret position for the task menu:', err);
    }

    if (!anchor) {
      const rect = editor.domElement?.getBoundingClientRect();
      if (!rect) return;
      anchor = { top: rect.top + 24, bottom: rect.top + 24, left: rect.right, right: rect.right };
    }

    setTaskPickerAnchor(anchor);
  };

  /** Closes the task submenu, handing focus back to the note unless the click went elsewhere. */
  const closeTaskPicker = () => {
    const active = document.activeElement as HTMLElement | null;
    const focusWasInPicker =
      !active || active === document.body || !!active.closest?.('[data-task-picker]');
    setTaskPickerAnchor(null);
    if (focusWasInPicker) editor.focus();
  };

  /** The block a task list belongs to, found again after the picker took focus. */
  const cursorBlockForInsert = () => {
    const remembered = cursorBlockRef.current ? editor.getBlock(cursorBlockRef.current) : undefined;
    return remembered ?? editor.document[editor.document.length - 1];
  };

  /**
   * Inserts the picked tasks as live task blocks, keeping the note tidy:
   * a single task, or a whole group (today, tomorrow, overdue, later) under
   * its own title, optionally closed by an inline "add task" row.
   */
  const insertTaskBlocks = (tasks: Task[], options: InsertTasksOptions = {}) => {
    if (!tasks.length) return;
    setTaskPickerAnchor(null);

    const { title, addDueDate } = options;
    const addRow = addDueDate !== undefined;

    try {
      const currentBlock = cursorBlockForInsert();
      const emptyLine = isBlockEmpty(currentBlock);
      const taskBlocks = [
        ...(title
          ? [{ type: 'heading' as const, props: { level: 3 as const }, content: title }]
          : []),
        ...tasks.map((task) => ({ type: 'taskRef' as const, props: { taskId: task.id } })),
        ...(addRow
          ? [{ type: 'taskAdd' as const, props: { dueDate: addDueDate ?? '' } }]
          : []),
      ];
      // Task blocks hold no text, so typing continues in a paragraph: either the
      // add row or the empty line we insert before plays that role.
      const needsTrailingLine = !emptyLine && !addRow;
      const inserted = editor.insertBlocks(
        needsTrailingLine ? [...taskBlocks, { type: 'paragraph' as const }] : taskBlocks,
        currentBlock,
        emptyLine ? 'before' : 'after'
      );
      const trailing = inserted?.[inserted.length - 1];
      if (needsTrailingLine && trailing) {
        editor.setTextCursorPosition(trailing, 'end');
      }
    } catch (err) {
      console.error('Failed to insert the task blocks:', err);
    }

    editor.focus();
  };

  /** Starts a brand new task list: a title the user names, closed by an add row. */
  const insertTaskList = () => {
    setTaskPickerAnchor(null);

    try {
      const currentBlock = cursorBlockForInsert();
      const emptyLine = isBlockEmpty(currentBlock);
      const inserted = editor.insertBlocks(
        [
          { type: 'heading' as const, props: { level: 3 as const } },
          { type: 'taskAdd' as const, props: { dueDate: '' } },
        ],
        currentBlock,
        emptyLine ? 'before' : 'after'
      );
      if (inserted?.[0]) {
        editor.setTextCursorPosition(inserted[0], 'end');
      }
    } catch (err) {
      console.error('Failed to insert a new task list:', err);
    }

    editor.focus();
  };

  /** Slash menu: a live task list block, the same one the journal template uses. */
  const insertTaskListBlock = (scope: 'today' | 'overdue') => {
    setTaskPickerAnchor(null);

    try {
      const currentBlock = cursorBlockForInsert();
      const emptyLine = isBlockEmpty(currentBlock);
      editor.insertBlocks(
        [{ type: 'taskList' as const, props: { scope } }],
        currentBlock,
        emptyLine ? 'before' : 'after'
      );
    } catch (err) {
      console.error('Failed to insert the task list block:', err);
    }

    editor.focus();
  };

  /** An empty bookmark block, ready for a link to be dropped into it. */
  const insertBookmarkBlock = () => {
    try {
      const currentBlock = editor.getTextCursorPosition().block;
      const emptyLine = isBlockEmpty(currentBlock);
      editor.insertBlocks(
        [{ type: 'bookmark' as const, props: { url: '' } }],
        currentBlock,
        emptyLine ? 'before' : 'after'
      );
    } catch (err) {
      console.error('Failed to insert a bookmark block:', err);
    }
  };

  /**
   * The slash menu: every default block, plus the task list block and one "تسک"
   * row that opens the task submenu. Tasks themselves live in that submenu
   * instead of cluttering this list.
   */
  const getSlashItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const q = query.trim().toLowerCase();
    const matches = (text?: string) => !q || (text || '').toLowerCase().includes(q);

    const defaults = getDefaultReactSlashMenuItems(editor).filter(
      (item) => matches(item.title) || matches(item.subtext) || item.aliases?.some(matches)
    );

    const extras: DefaultReactSuggestionItem[] = [];

    const taskAliases = ['تسک', 'تسک‌ها', 'تسکها', 'task', 'tasks', 'todo', 'ارجاع'];
    if (taskAliases.some(matches)) {
      extras.push({
        title: 'تسک',
        subtext: 'انتخاب از لیست تسک‌ها',
        aliases: taskAliases,
        group: 'تسک',
        icon: <RiTaskLine className="size-4" />,
        onItemClick: openTaskPicker,
      });
    }

    // A whole list of today's (or overdue) tasks as one block.
    const todayListAliases = ['لیست تسک', 'لیست', 'تسک‌های امروز', 'task list', 'today'];
    const overdueListAliases = ['تسک عقب‌افتاده', 'عقب‌افتاده', 'overdue'];

    if (todayListAliases.some(matches)) {
      extras.push({
        title: 'لیست تسک امروز',
        subtext: 'کارهای امروز، با افزودن تسک',
        aliases: todayListAliases,
        group: 'تسک',
        icon: <RiTaskLine className="size-4" />,
        onItemClick: () => insertTaskListBlock('today'),
      });
    }
    if (overdueListAliases.some(matches)) {
      extras.push({
        title: 'لیست تسک‌های عقب‌افتاده',
        subtext: 'کارهایی که موعدشان گذشته',
        aliases: overdueListAliases,
        group: 'تسک',
        icon: <RiTaskLine className="size-4" />,
        onItemClick: () => insertTaskListBlock('overdue'),
      });
    }

    const bookmarkAliases = ['بوکمارک', 'بوک‌مارک', 'bookmark', 'لینک', 'link', 'url', 'سایت'];
    if (bookmarkAliases.some(matches)) {
      extras.push({
        title: 'بوکمارک',
        subtext: 'کارت لینک سایت',
        aliases: bookmarkAliases,
        group: 'لینک',
        icon: <RiBookmarkLine className="size-4" />,
        onItemClick: insertBookmarkBlock,
      });
    }

    // Guard against duplicated titles (e.g. an alias matching several defaults),
    // so the menu never lists the same row twice.
    const seen = new Set<string>();
    return [...defaults, ...extras].filter((item) => {
      const key = item.title.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return (
    <div
      dir="rtl"
      className={`blocknote-editor-wrapper text-right ${className}`}
      style={{ minHeight }}
    >
      <BlockNoteView
        editor={editor}
        theme={isDark ? 'dark' : 'light'}
        slashMenu={false}
        formattingToolbar={false}
        className="w-full text-right"
      >
        <SuggestionMenuController triggerCharacter="/" getItems={getSlashItems} />
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              {getFormattingToolbarItems().filter((item) => item.key !== 'colorStyleButton')}
              <SelectionColorButton />
            </FormattingToolbar>
          )}
        />
        <BlockHoverHandles />
      </BlockNoteView>

      {taskPickerAnchor && (
        <TaskPickerPanel
          anchor={taskPickerAnchor}
          onSelectTasks={insertTaskBlocks}
          onCreateList={insertTaskList}
          onClose={closeTaskPicker}
        />
      )}
    </div>
  );
};
