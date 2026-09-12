import React from 'react';
import type { Task, Note, Tag } from '@/types/models';
import { TaskItemRow } from './TaskItemRow';
import { NoteItemRow } from './NoteItemRow';

interface PinnedSectionProps {
  pinnedTasks: Task[];
  pinnedNotes: Note[];
  tagsMap: Record<string, Tag>;
  currentDateKey: string;
  onStatusChanged: () => void;
}

export const PinnedSection: React.FC<PinnedSectionProps> = ({
  pinnedTasks,
  pinnedNotes,
  tagsMap,
  currentDateKey,
  onStatusChanged,
}) => {
  const totalCount = pinnedTasks.length + pinnedNotes.length;
  if (totalCount === 0) return null;

  return (
    <div className="w-full mt-5 mb-2 select-none">
      <h3 className="text-[12px] font-semibold text-foreground px-6 text-right mb-1.5">
        سنجاق شده
      </h3>
      <div className="w-full">
        {pinnedTasks.map((task) => (
          <TaskItemRow
            key={task.id}
            task={task}
            tagsMap={tagsMap}
            currentDateKey={currentDateKey}
            onStatusChanged={onStatusChanged}
            draggable={false}
          />
        ))}
        {pinnedNotes.map((note) => (
          <NoteItemRow
            key={note.id}
            note={note}
            tagsMap={tagsMap}
            onStatusChanged={onStatusChanged}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
};
