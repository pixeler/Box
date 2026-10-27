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
    <section className="mb-5 w-full select-none" aria-labelledby="pinned-today-heading">
      <div className="flex h-7 items-center">
        <h2 id="pinned-today-heading" className="text-[11px] font-medium text-subtle">
          سنجاق‌شده
        </h2>
      </div>
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
    </section>
  );
});
