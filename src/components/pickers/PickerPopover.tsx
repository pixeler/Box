import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface PickerAnchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface PickerPopoverProps {
  anchorRect: PickerAnchor | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  /** Date picker wants all the available vertical space; the others size to content. */
  fillHeight?: boolean;
}

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 6;

/** Places a panel next to its row, flipping above when there is no room below. */
export function getPickerPopoverStyle(
  anchorRect: PickerAnchor | null,
  width = 360,
  fillHeight = false
): React.CSSProperties | null {
  if (!anchorRect || typeof window === 'undefined') return null;

  const resolvedWidth = Math.min(width, window.innerWidth - VIEWPORT_MARGIN * 2);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, anchorRect.left),
    window.innerWidth - resolvedWidth - VIEWPORT_MARGIN
  );
  const spaceBelow = window.innerHeight - anchorRect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
  const spaceAbove = anchorRect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
  const placeBelow = spaceBelow >= 280 || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(200, Math.min(600, placeBelow ? spaceBelow : spaceAbove));

  return {
    left,
    width: resolvedWidth,
    maxHeight,
    ...(fillHeight ? { height: maxHeight } : {}),
    ...(placeBelow
      ? { top: anchorRect.bottom + ANCHOR_GAP }
      : { bottom: window.innerHeight - anchorRect.top + ANCHOR_GAP }),
  };
}

/**
 * A property menu anchored to its row on desktop, matching the way Todoist
 * opens date/priority/project controls. Mobile keeps using the bottom sheets.
 */
export const PickerPopover: React.FC<PickerPopoverProps> = ({
  anchorRect,
  onClose,
  children,
  width = 360,
  fillHeight = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.code === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const style = useMemo(
    () => getPickerPopoverStyle(anchorRect, width, fillHeight),
    [anchorRect, width, fillHeight]
  );

  if (!anchorRect || !style) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220]" onPointerDown={onClose}>
      <div
        onPointerDown={(event) => event.stopPropagation()}
        style={style}
        className="fixed flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground font-sans shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/10"
        dir="rtl"
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
