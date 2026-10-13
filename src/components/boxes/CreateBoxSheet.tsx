import React, { useState, useEffect, useRef } from 'react';
import type { Box } from '@/types/models';
import { boxRepo } from '@/repositories';
import { BoxThumbnail } from './BoxThumbnail';
import { BOX_ICONS_LIST } from './BoxIconRenderer';
import { toast } from '@/lib/toast';
import {
  RiCloseLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiSparklingFill,
} from '@remixicon/react';

export const BOX_TEMPLATES = [
  { id: 'Box 1.png', name: 'سفید مینیمال', allowsCustomIcon: true },
  { id: 'Box 2.png', name: 'مقوایی کرافت', allowsCustomIcon: true },
  { id: 'Box 5.png', name: 'چرم قهوه‌ای', allowsCustomIcon: false },
  { id: 'Box6.png', name: 'شکلاتی اوریو', allowsCustomIcon: false },
  { id: 'Box 3.png', name: 'چرم مشکی', allowsCustomIcon: false },
  { id: 'Box 4.png', name: 'صورتی ستاره', allowsCustomIcon: false },
  { id: 'Box 7.png', name: 'پارچه‌ای زیتونی', allowsCustomIcon: false },
  { id: 'Box 8.png', name: 'چرم زرشکی', allowsCustomIcon: false },
  { id: 'Box 9.png', name: 'سرمه‌ای متالیک', allowsCustomIcon: true },
  { id: 'Box 10.png', name: 'زیتونی و طومار', allowsCustomIcon: false },
];

interface CreateBoxSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (box: Box) => void;
  editBox?: Box | null;
  parentId?: string | null;
}

export const CreateBoxSheet: React.FC<CreateBoxSheetProps> = ({
  isOpen,
  onClose,
  onSaved,
  editBox,
  parentId,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [title, setTitle] = useState(editBox?.title || '');
  const [selectedImage, setSelectedImage] = useState<string>(editBox?.image || 'Box 1.png');
  const [selectedIcon, setSelectedIcon] = useState<string>(editBox?.icon || '');
  const [selectedBadge, setSelectedBadge] = useState<string>(editBox?.badge_icon || '');
  const [description, setDescription] = useState(editBox?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(editBox?.title || '');
      setSelectedImage(editBox?.image || 'Box 1.png');
      setSelectedIcon(editBox?.icon || '');
      setSelectedBadge(editBox?.badge_icon || '');
      setDescription(editBox?.description || '');
      setIsClosing(false);
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, editBox]);

  // Handle ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.show('لطفاً نام باکس را وارد کنید');
      titleInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      if (editBox) {
        const updated = await boxRepo.update(editBox.id, {
          title: cleanTitle,
          image: selectedImage,
          icon: selectedIcon || undefined,
          badge_icon: undefined,
          description: description.trim() || undefined,
        });
        toast.show('باکس با موفقیت ویرایش شد');
        onSaved(updated);
      } else {
        const created = await boxRepo.create({
          title: cleanTitle,
          image: selectedImage,
          icon: selectedIcon || undefined,
          badge_icon: undefined,
          parent_id: parentId || null,
          description: description.trim() || undefined,
        });
        toast.show('باکس جدید با موفقیت ساخته شد');
        onSaved(created);
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save box:', err);
      toast.show('خطا در ذخیره باکس');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editBox) return;
    if (window.confirm(`آیا از حذف باکس «${editBox.title}» مطمئن هستید؟ (تسک‌ها و یادداشت‌های آن حذف نمی‌شوند)`)) {
      try {
        await boxRepo.delete(editBox.id);
        toast.show('باکس حذف شد');
        onSaved(editBox);
        handleClose();
      } catch (err) {
        console.error('Failed to delete box:', err);
      }
    }
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
      dir="rtl"
    >

      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card text-card-foreground font-sans text-right flex flex-col relative w-full rounded-t-[28px] shadow-2xl pb-6 px-5 pt-4 max-h-[92%] border-t border-border/80 dark:border-white/10 overflow-hidden ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3 shrink-0" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <RiSparklingFill className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {editBox ? 'ویرایش باکس' : 'ایجاد باکس جدید'}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            {editBox && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 text-rose-500/80 hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer mr-1"
                title="حذف باکس"
              >
                <RiDeleteBinLine className="w-4.5 h-4.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 transition-colors cursor-pointer"
              title="بستن"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-4 space-y-5 no-scrollbar">
          {/* Live Preview & Name Input */}
          <div className="flex items-center gap-4 bg-muted/40 dark:bg-white/5 p-4 rounded-2xl border border-border/60 dark:border-white/10">
            <BoxThumbnail
              box={{
                title: title || 'پیش‌نمایش',
                image: selectedImage,
                icon: selectedIcon,
                badge_icon: selectedBadge,
              }}
              size="lg"
            />

            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                نام باکس
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً روزنوشت‌ها، کار، یوتیوب..."
                className="w-full text-base font-bold text-foreground bg-card dark:bg-zinc-800/80 border border-border/80 dark:border-white/15 rounded-xl px-3.5 py-2.5 outline-none focus:border-primary placeholder:text-muted-foreground/50 dark:placeholder:text-zinc-500 transition-all"
                dir="rtl"
              />
            </div>
          </div>

          {/* 1. Box Style Gallery */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground">
              طرح جعبه سه‌بعدی
            </span>
            <div className="grid grid-cols-5 gap-2.5 pt-1">
              {BOX_TEMPLATES.map((tmpl) => {
                const isSelected = selectedImage === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedImage(tmpl.id)}
                    className={`relative p-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs'
                        : 'border-border/70 dark:border-white/10 hover:bg-muted/40 dark:hover:bg-white/5'
                    }`}
                  >
                    <BoxThumbnail
                      box={{
                        title: tmpl.name,
                        image: tmpl.id,
                      }}
                      size="sm"
                    />
                    <span className="text-[10px] text-muted-foreground font-medium mt-1 truncate w-full text-center">
                      {tmpl.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                        <RiCheckLine className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Custom Lid Icon */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                آیکون روی جعبه (طرح حکاکی شده)
              </span>
              {selectedIcon && (
                <button
                  type="button"
                  onClick={() => setSelectedIcon('')}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  حذف آیکون
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setSelectedIcon('')}
                className={`px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer border ${
                  !selectedIcon
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border/70 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                بدون آیکون
              </button>

              {BOX_ICONS_LIST.map(({ id, label, Icon }) => {
                const isSelected = selectedIcon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    title={label}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs shrink-0 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border/70 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{label.split('/')[0].trim()}</span>
                  </button>
                );
              })}
            </div>
          </div>


          {/* 4. Description (Optional) */}
          <div className="space-y-1.5 pb-2">
            <label className="block text-xs font-semibold text-foreground">
              توضیحات باکس (اختیاری)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیح کوتاه درباره موضوع این باکس..."
              className="w-full text-xs text-foreground bg-card dark:bg-zinc-800/60 border border-border/80 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-primary placeholder:text-muted-foreground/50 dark:placeholder:text-zinc-500 transition-all"
            />
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/70 dark:border-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 disabled:opacity-40 px-6 py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <RiCheckLine className="w-4 h-4" />
              <span>{editBox ? 'ذخیره تغییرات' : 'ایجاد باکس'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

