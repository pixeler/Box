import React, { useState, useEffect, useRef } from 'react';
import type { Box } from '@/types/models';
import { boxRepo } from '@/repositories';
import { BoxThumbnail } from './BoxThumbnail';
import { BoxIconRenderer, BOX_ICONS_LIST } from './BoxIconRenderer';
import { toast } from '@/lib/toast';
import { useIsDesktop } from '@/lib/device';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  RiCloseLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiAddLine,
} from '@remixicon/react';

export const BOX_TEMPLATES = [
  { id: 'Box 2.png', name: 'مقوایی کرافت', allowsCustomIcon: true },
  { id: 'Box 1.png', name: 'سفید مینیمال', allowsCustomIcon: true },
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
  /** Lets the caller show its own delete confirmation instead of window.confirm. */
  onRequestDelete?: (box: Box) => void;
}

/**
 * Creates and edits a folder with the smallest possible form: a strip of box
 * styles, a name, and one confirm button. A phone gets a sheet, desktop a small
 * centered pop-up; both are one flat surface, no nested cards.
 */
export const CreateBoxSheet: React.FC<CreateBoxSheetProps> = ({
  isOpen,
  onClose,
  onSaved,
  editBox,
  parentId,
  onRequestDelete,
}) => {
  const isDesktop = useIsDesktop();
  const [isClosing, setIsClosing] = useState(false);
  const [title, setTitle] = useState(editBox?.title || '');
  const [selectedImage, setSelectedImage] = useState<string>(editBox?.image || 'Box 2.png');
  const [selectedIcon, setSelectedIcon] = useState<string>(editBox?.icon || '');
  const [iconOpen, setIconOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(editBox?.title || '');
      setSelectedImage(editBox?.image || 'Box 2.png');
      setSelectedIcon(editBox?.icon || '');
      setIsClosing(false);
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, editBox]);

  // A vertical wheel scrolls the style strip sideways; no scrollbar on screen.
  useEffect(() => {
    if (!isOpen) return;
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen]);

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
      toast.show('لطفاً نام پوشه را وارد کنید');
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
        });
        toast.show('پوشه با موفقیت ویرایش شد');
        onSaved(updated);
      } else {
        const created = await boxRepo.create({
          title: cleanTitle,
          image: selectedImage,
          icon: selectedIcon || undefined,
          badge_icon: undefined,
          parent_id: parentId || null,
        });
        toast.show('پوشه جدید با موفقیت ساخته شد');
        onSaved(created);
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save box:', err);
      toast.show('خطا در ذخیره پوشه');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editBox) return;

    if (onRequestDelete) {
      onRequestDelete(editBox);
      return;
    }

    if (window.confirm(`آیا از حذف پوشه «${editBox.title}» مطمئن هستید؟ (تسک‌ها و یادداشت‌های آن حذف نمی‌شوند)`)) {
      try {
        await boxRepo.delete(editBox.id);
        toast.show('پوشه حذف شد');
        onSaved(editBox);
        handleClose();
      } catch (err) {
        console.error('Failed to delete box:', err);
      }
    }
  };

  if (!isOpen && !isClosing) return null;

  const iconPicker = (
    <Popover open={iconOpen} onOpenChange={setIconOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="انتخاب آیکون پوشه"
          title="آیکون پوشه"
          className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selectedIcon ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {selectedIcon ? (
            <BoxIconRenderer
              iconId={selectedIcon}
              boxImage={selectedImage}
              className="size-4"
            />
          ) : (
            <RiAddLine className="size-4" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[228px] rounded-xl border border-border/70 bg-popover p-2 shadow-xl"
      >
        <div className="grid grid-cols-6 gap-1">
          <button
            type="button"
            title="بدون آیکون"
            aria-label="بدون آیکون"
            onClick={() => {
              setSelectedIcon('');
              setIconOpen(false);
            }}
            className={`flex size-7 items-center justify-center rounded-md transition-colors ${
              !selectedIcon
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <RiCloseLine className="size-3.5" />
          </button>

          {BOX_ICONS_LIST.map(({ id, label, Icon }) => {
            const isSelected = selectedIcon === id;
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => {
                  setSelectedIcon(id);
                  setIconOpen(false);
                }}
                className={`flex size-7 items-center justify-center rounded-md transition-colors ${
                  isSelected
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div
      className={`absolute inset-0 z-50 select-none ${
        isDesktop
          ? 'flex items-center justify-center bg-black/55 p-6 backdrop-blur-[3px]'
          : 'flex flex-col justify-end bg-black/70'
      } ${isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex w-full flex-col overflow-hidden bg-card text-card-foreground ${
          isDesktop
            ? `max-w-[400px] rounded-2xl border border-border/70 shadow-[0_24px_60px_rgba(0,0,0,0.35)] ${
                isClosing ? 'animate-backdrop-out' : 'animate-popover-fade'
              }`
            : `rounded-t-[24px] border-t border-border/70 shadow-2xl ${
                isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
              }`
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
          <h2 className="text-[14px] font-semibold text-foreground">
            {editBox ? 'ویرایش پوشه' : 'ایجاد پوشه'}
          </h2>

          <div className="flex items-center gap-0.5">
            {editBox && (
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer rounded-full p-1.5 text-rose-500/80 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                title="حذف پوشه"
              >
                <RiDeleteBinLine className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="بستن"
            >
              <RiCloseLine className="size-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 pb-4 pt-3">
          <div ref={stripRef} className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {BOX_TEMPLATES.map((tmpl) => {
              const isSelected = selectedImage === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedImage(tmpl.id)}
                  title={tmpl.name}
                  aria-label={tmpl.name}
                  className={`flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                      : 'border-transparent hover:bg-secondary/60'
                  }`}
                >
                  <BoxThumbnail box={{ title: tmpl.name, image: tmpl.id }} size="sm" />
                </button>
              );
            })}
          </div>

          <div className="relative">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="نام پوشه را وارد کنید"
              dir="rtl"
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 pe-10 text-[13px] font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-foreground/30"
            />
            <span className="absolute inset-y-0 end-1.5 flex items-center">{iconPicker}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="mt-0.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-35"
          >
            <RiCheckLine className="size-4" />
            <span>{editBox ? 'ذخیره' : 'ایجاد پوشه'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
