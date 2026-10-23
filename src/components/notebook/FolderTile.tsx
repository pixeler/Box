import React from 'react';

interface FolderTileProps {
  title: string;
  meta: string;
  thumbnail: React.ReactNode;
  onOpen: () => void;
  isDropTarget?: boolean;
  onDragOverNote?: (e: React.DragEvent) => void;
  onDragLeaveNote?: () => void;
  onDropNote?: (e: React.DragEvent) => void;
}

/**
 * One folder in the file-manager grid: the box artwork sits on top with the
 * folder name underneath, like a desktop folder. The whole tile opens it; a
 * note can be dropped anywhere on it. Folder commands live in the toolbar.
 */
export const FolderTile: React.FC<FolderTileProps> = ({
  title,
  meta,
  thumbnail,
  onOpen,
  isDropTarget = false,
  onDragOverNote,
  onDragLeaveNote,
  onDropNote,
}) => (
  <button
    type="button"
    onClick={onOpen}
    title={title}
    onDragOver={onDragOverNote}
    onDragLeave={onDragLeaveNote}
    onDrop={onDropNote}
    className={`folder-tile group/folder flex min-h-[136px] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card ${
      isDropTarget
        ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/20'
        : 'border-border/60 bg-card hover:border-border hover:bg-secondary/40'
    }`}
  >
    <span className="flex h-16 w-16 shrink-0 items-center justify-center sm:h-[72px] sm:w-[72px]">
      {thumbnail}
    </span>

    <span className="block w-full truncate text-[12.5px] font-medium leading-5 text-foreground">
      {title}
    </span>
    <span className="block w-full truncate text-[10.5px] leading-4 text-muted-foreground">
      {meta}
    </span>
  </button>
);
