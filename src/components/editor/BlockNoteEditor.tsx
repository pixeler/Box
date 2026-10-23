import React, { useState, useEffect, useRef } from 'react';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems } from '@blocknote/react';
import type { DefaultReactSuggestionItem } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { faDictionary } from '@/lib/editor/faDictionary';
import { TaskRefBlock } from './TaskRefBlock';
import { TaskAddBlock } from './TaskAddBlock';
import { BlockHoverHandles } from './BlockHoverHandles';
import { SelectionColorButton } from './EditorColorMenu';
import { TaskPickerPanel, type TaskPickerAnchor } from './TaskPickerPanel';
import type { Task } from '@/types/models';
import { RiTaskLine } from '@remixicon/react';

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
  },
});

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

  // Create BlockNote editor with Persian dictionary
  const editor = useCreateBlockNote(
    {
      schema,
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

  // Load initial content (JSON blocks first, then markdown) once editor is ready
  useEffect(() => {
    if (!editor) return;

    if (!isLoadedRef.current && initialContentJson) {
      try {
        const blocks = JSON.parse(initialContentJson);
        if (Array.isArray(blocks) && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
          lastMarkdownRef.current = initialContent || '';
          isLoadedRef.current = true;
        }
      } catch (err) {
        console.warn('BlockNote failed to parse stored blocks, falling back to markdown:', err);
      }
    }

    if (!isLoadedRef.current && initialContent && initialContent.trim()) {
      try {
        const blocks = editor.tryParseMarkdownToBlocks(initialContent);
        if (blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
          lastMarkdownRef.current = initialContent;
          isLoadedRef.current = true;
        }
      } catch (err) {
        console.warn('BlockNote failed to parse initial markdown, fallback to plain text:', err);
      }
    }

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
      const currentBlock = editor.getTextCursorPosition().block;
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
      const currentBlock = editor.getTextCursorPosition().block;
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

  /**
   * The slash menu: every default block, plus one "تسک" row that opens the task
   * submenu. Tasks themselves live in that submenu instead of cluttering this list.
   */
  const getSlashItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const q = query.trim().toLowerCase();
    const matches = (text?: string) => !q || (text || '').toLowerCase().includes(q);

    const defaults = getDefaultReactSlashMenuItems(editor).filter(
      (item) => matches(item.title) || matches(item.subtext) || item.aliases?.some(matches)
    );

    const taskAliases = ['تسک', 'تسک‌ها', 'تسکها', 'task', 'tasks', 'todo', 'ارجاع'];
    const taskMenuMatches = !q || taskAliases.some(matches);

    if (!taskMenuMatches) return defaults;

    const taskMenu: DefaultReactSuggestionItem = {
      title: 'تسک',
      subtext: 'انتخاب از لیست تسک‌ها',
      aliases: taskAliases,
      group: 'تسک',
      icon: <RiTaskLine className="size-4" />,
      onItemClick: openTaskPicker,
    };

    // Guard against duplicated titles (e.g. an alias matching several defaults),
    // so the menu never lists the same row twice.
    const seen = new Set<string>();
    return [...defaults, taskMenu].filter((item) => {
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
