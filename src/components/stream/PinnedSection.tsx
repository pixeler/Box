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

export const PinnedSection: React.FC<PinnedSectionProps> = React.memo(({
  pinnedTasks,
  pinnedNotes,
  tagsMap,
  currentDateKey,
  onStatusChanged,
}) => {
  const pinnedItems = [
    ...pinnedTasks.map((t) => ({ type: 'task' as const, data: t })),
    ...pinnedNotes.map((n) => ({ type: 'note' as const, data: n })),
  ];

  if (pinnedItems.length === 0) return null;

  return (
    <div className="w-full mt-2 mb-2 select-none">
      <div className="w-full">
        {pinnedItems.map((item, idx) => {
          const isLast = idx === pinnedItems.length - 1;
          if (item.type === 'task') {
            return (
              <TaskItemRow
                key={item.data.id}
                task={item.data}
                tagsMap={tagsMap}
                currentDateKey={currentDateKey}
                onStatusChanged={onStatusChanged}
                draggable={false}
                isLast={isLast}
              />
            );
          }
          return (
            <NoteItemRow
              key={item.data.id}
              note={item.data}
              tagsMap={tagsMap}
              onStatusChanged={onStatusChanged}
              draggable={false}
              isLast={isLast}
            />
          );
        })}
      </div>
    </div>
  );
});
