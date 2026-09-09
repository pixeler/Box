import React from 'react';

export const CardDropPreview: React.FC = () => {
  return (
    <div className="w-full drop-preview-smooth select-none pointer-events-none py-0.5">
      <div className="w-full h-[46px] rounded-xl bg-gray-200/60 dark:bg-zinc-800/50 border-2 border-dashed border-gray-300 dark:border-zinc-700" />
    </div>
  );
};
