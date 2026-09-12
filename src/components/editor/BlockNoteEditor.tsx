import React, { useState, useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { faDictionary } from '@/lib/editor/faDictionary';

// Import required BlockNote styles
import '@blocknote/mantine/style.css';

interface BlockNoteEditorProps {
  initialContent?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  editable?: boolean;
  autoFocus?: boolean;
}

export const BlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  initialContent,
  onChange,
  placeholder,
  minHeight = '140px',
  className = '',
  editable = true,
  autoFocus = false,
}) => {
  const isLoadedRef = useRef(false);
  const lastMarkdownRef = useRef<string>(initialContent || '');

  // Create BlockNote editor with Persian dictionary
  const editor = useCreateBlockNote(
    {
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

  // Load initial content (markdown or plain text) once editor is ready
  useEffect(() => {
    if (!editor) return;

    const hasNoContentYet = !lastMarkdownRef.current;
    const shouldLoad = !isLoadedRef.current || (
      initialContent !== undefined &&
      initialContent !== lastMarkdownRef.current &&
      hasNoContentYet
    );

    if (shouldLoad && initialContent && initialContent.trim()) {
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
  }, [editor, initialContent, autoFocus]);

  // Track editor changes and export to Markdown
  useEffect(() => {
    if (!editor || !onChange) return;

    const unsubscribe = editor.onChange((ed) => {
      // Once user interacts, mark as loaded so external empty props don't overwrite
      isLoadedRef.current = true;
      try {
        const markdown = ed.blocksToMarkdownLossy(ed.document);
        // Only trigger onChange if actual content changed
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
  }, [editor, onChange]);

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

  return (
    <div
      dir="rtl"
      className={`blocknote-editor-wrapper text-right ${className}`}
      style={{ minHeight }}
    >
      <BlockNoteView
        editor={editor}
        theme={isDark ? 'dark' : 'light'}
        className="w-full text-right"
      />
    </div>
  );
};
