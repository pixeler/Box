import React, { useState, useEffect } from 'react';
import type { Box } from '@/types/models';
import { boxRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import {
  RiCloseLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiFolderLine,
  RiBookLine,
  RiLightbulbLine,
  RiBriefcaseLine,
  RiGraduationCapLine,
  RiHeartLine,
  RiCodeLine,
  RiCompassLine,
  RiStarLine,
  RiMusicLine,
  RiCameraLine,
  RiShieldLine,
  RiGlobalLine,
} from '@remixicon/react';
import { NOTE_COLOR_PRESETS } from './noteTheme';

interface BoxEditModalProps {
  isOpen: boolean;
  box?: Box | null;
  onClose: () => void;
  onSaved: () => void;
}

const BOX_ICONS = [
  { id: 'RiFolderLine', icon: RiFolderLine },
  { id: 'RiBookLine', icon: RiBookLine },
  { id: 'RiLightbulbLine', icon: RiLightbulbLine },
  { id: 'RiBriefcaseLine', icon: RiBriefcaseLine },
  { id: 'RiGraduationCapLine', icon: RiGraduationCapLine },
  { id: 'RiHeartLine', icon: RiHeartLine },
  { id: 'RiCodeLine', icon: RiCodeLine },
  { id: 'RiCompassLine', icon: RiCompassLine },
  { id: 'RiStarLine', icon: RiStarLine },
  { id: 'RiMusicLine', icon: RiMusicLine },
  { id: 'RiCameraLine', icon: RiCameraLine },
  { id: 'RiShieldLine', icon: RiShieldLine },
  { id: 'RiGlobalLine', icon: RiGlobalLine },
];

export const BoxEditModal: React.FC<BoxEditModalProps> = ({
  isOpen,
  box,
  onClose,
  onSaved,
}) => {
  const isEditing = !!box;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#8B5CF6');
  const [selectedIcon, setSelectedIcon] = useState('RiFolderLine');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (box) {
        setTitle(box.title || '');
        setDescription(box.description || '');
        setSelectedColor(box.color || box.icon_color || '#8B5CF6');
        setSelectedIcon(box.icon || 'RiFolderLine');
      } else {
        setTitle('');
        setDescription('');
        setSelectedColor('#8B5CF6');
        setSelectedIcon('RiFolderLine');
      }
      setIsDeleting(false);
    }
  }, [isOpen, box]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.show('لطفاً نام جعبه را وارد کنید');
      return;
    }

    try {
      if (isEditing && box) {
        await boxRepo.update(box.id, {
          title: trimmedTitle,
          description: description.trim(),
          color: selectedColor,
          icon: selectedIcon,
          icon_color: selectedColor,
        });
        toast.show('جعبه با موفقیت به‌روزرسانی شد');
      } else {
        await boxRepo.create({
          title: trimmedTitle,
          description: description.trim(),
          color: selectedColor,
          icon: selectedIcon,
          icon_color: selectedColor,
          image: 'Box 1.png',
        });
        toast.show('جعبه جدید با موفقیت ساخته شد');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save box:', err);
      toast.show('خطا در ذخیره جعبه');
    }
  };

  const handleDelete = async () => {
    if (!box) return;
    try {
      await boxRepo.delete(box.id);
      toast.show('جعبه حذف شد (یادداشت‌ها حفظ شدند)');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to delete box:', err);
      toast.show('خطا در حذف جعبه');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border/80 text-card-foreground rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: selectedColor }}
            />
            <h2 className="font-darvish text-lg font-bold">
              {isEditing ? 'ویرایش جعبه' : 'ایجاد جعبه جدید'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <RiCloseLine className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              نام جعبه یا دسته‌بندی
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اقتصاد، تکنولوژی، مقالات، دستور غذا..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-secondary/60 border border-border/70 text-sm focus:outline-none focus:border-primary transition-colors text-foreground"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              توضیحات کوتاه (اختیاری)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحاتی برای محتوا یا هدف این جعبه..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-2xl bg-secondary/60 border border-border/70 text-xs focus:outline-none focus:border-primary transition-colors resize-none text-foreground"
            />
          </div>

          {/* Color Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              رنگ شاخص
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {NOTE_COLOR_PRESETS.map((p) => {
                const isSelected = selectedColor === p.dot;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedColor(p.dot)}
                    className={`size-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110 shadow-xs' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: p.dot }}
                    title={p.name}
                  >
                    {isSelected && <RiCheckLine className="size-4 text-white drop-shadow-xs" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              آیکون
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {BOX_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    className={`size-9 rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <IconComponent className="size-4.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60 mt-1">
            {isEditing ? (
              isDeleting ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer"
                  >
                    تأیید حذف
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleting(false)}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsDeleting(true)}
                  className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 px-2 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <RiDeleteBinLine className="size-4" />
                  <span>حذف جعبه</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                {isEditing ? 'ذخیره تغییرات' : 'ایجاد جعبه'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
