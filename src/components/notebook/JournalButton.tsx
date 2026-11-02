import React, { useState } from 'react';
import type { Task } from '@/types/models';
import { RiSunLine } from '@remixicon/react';
import { useNotebook } from './NotebookContext';
import { createJournalNote } from '@/lib/journal';
import { toast } from '@/lib/toast';

interface JournalButtonProps {
  dateKey: string;
  tasks: Task[];
  overdueTasks: Task[];
}

/**
 * Creates the day's journal entry from the journal template, files it under
 * روزنوشت > سال > ماه and opens it for writing.
 */
export const JournalButton: React.FC<JournalButtonProps> = ({
  dateKey,
  tasks,
  overdueTasks,
}) => {
  const { setEditingNote, setNoteEditModalOpen, setNoteViewModeOverride, loadData } = useNotebook();
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const note = await createJournalNote({ dateKey, tasks, overdueTasks });
      await loadData();
      setEditingNote(note);
      setNoteViewModeOverride('fullscreen');
      setNoteEditModalOpen(true);
    } catch (err) {
      console.error('Failed to create journal note:', err);
      toast.show('ساخت روزنوشت انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={busy}
      title="افزودن روزنوشت این روز از تمپلیت"
      className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2 text-[11.5px] font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
    >
      <RiSunLine className="size-3.5 shrink-0" />
      <span>{busy ? 'در حال ساخت…' : 'افزودن روزنوشت'}</span>
    </button>
  );
};