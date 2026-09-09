import React, { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { RiCheckLine } from '@remixicon/react';

export const ToastContainer: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let hideTimer: NodeJS.Timeout;
    const unsubscribe = toast.subscribe((msg) => {
      setMessage(msg);
      setVisible(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setVisible(false);
      }, 2200);
    });

    return () => {
      unsubscribe();
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4 select-none">
      <div className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1c1d22]/95 text-white text-[12px] font-medium shadow-xl border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <RiCheckLine className="w-2.5 h-2.5 stroke-[2.5]" />
        </span>
        <span className="text-gray-100">{message}</span>
      </div>
    </div>
  );
};
