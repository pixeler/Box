import React, { useState } from 'react';
import type { EventItem } from '@/types/models';
import { toPersianDigits } from '@/lib/jalali';
import { RiCheckLine } from '@remixicon/react';

interface EventItemRowProps {
  event: EventItem;
  onStatusChanged?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isLast?: boolean;
}

export const EventItemRow: React.FC<EventItemRowProps> = ({
  event,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isLast = false,
}) => {
  const [checked, setChecked] = useState(false);

  // Format time to Persian with day period (e.g., ۱۲:۰۰ شب)
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = match[2];
      let period = 'شب';
      if (h > 4 && h < 12) period = 'صبح';
      else if (h >= 12 && h < 17) period = 'عصر';
      else period = 'شب';
      return `${toPersianDigits(match[1])}:${toPersianDigits(m)} ${period}`;
    }
    return toPersianDigits(timeStr);
  };

  const timeDisplay = formatTime(event.start_at);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`group relative w-full ${
        !isLast ? 'task-dashed-border' : ''
      } py-3.5 px-6 select-none transition-all duration-150 stream-row-hover cursor-pointer`}
    >
      <div className="flex items-center justify-between w-full">
        {/* 1. RIGHT SIDE in RTL: Dashed rounded square + Title */}
        <div className="flex items-center gap-3">
          {/* Dashed Square Checkbox on the far right */}
          <button
            type="button"
            onClick={() => setChecked(!checked)}
            className={`w-5 h-5 rounded-[5px] border border-dashed flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              checked
                ? 'border-primary bg-secondary text-primary'
                : 'border-muted-foreground/50 hover:border-foreground bg-card'
            }`}
          >
            {checked && <RiCheckLine className="w-3.5 h-3.5 stroke-[2.5]" />}
          </button>

          {/* Title */}
          <span
            className={`text-[13.5px] font-medium transition-all ${
              checked ? 'line-through text-muted-foreground font-normal' : 'text-foreground'
            }`}
          >
            {event.title}
          </span>
        </div>

        {/* 2. LEFT SIDE in RTL: Time (۱۲:۰۰ شب) */}
        <span className="text-[12px] text-muted-foreground font-normal">
          {timeDisplay}
        </span>
      </div>
    </div>
  );
};
