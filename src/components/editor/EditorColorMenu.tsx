import React from 'react';
import { useBlockNoteEditor, useComponentsContext } from '@blocknote/react';
import { RiPaletteLine } from '@remixicon/react';

export const EDITOR_COLORS: { value: string; label: string }[] = [
  { value: 'default', label: 'پیش‌فرض' },
  { value: 'gray', label: 'خاکستری' },
  { value: 'brown', label: 'قهوه‌ای' },
  { value: 'red', label: 'قرمز' },
  { value: 'orange', label: 'نارنجی' },
  { value: 'yellow', label: 'زرد' },
  { value: 'green', label: 'سبز' },
  { value: 'blue', label: 'آبی' },
  { value: 'purple', label: 'بنفش' },
  { value: 'pink', label: 'صورتی' },
];

const textColorOf = (value: string) =>
  value === 'default' ? 'hsl(var(--foreground))' : `var(--editor-${value}-text)`;

const bgColorOf = (value: string) =>
  value === 'default' ? 'transparent' : `var(--editor-${value}-bg)`;

interface ColorPanelProps {
  textColor?: string;
  backgroundColor?: string;
  onPickText: (value: string) => void;
  onPickBackground: (value: string) => void;
}

/** A Notion-like color panel: text colors over background colors. */
export const ColorPanel: React.FC<ColorPanelProps> = ({
  textColor = 'default',
  backgroundColor = 'default',
  onPickText,
  onPickBackground,
}) => (
  <div dir="rtl" className="w-[248px] select-none p-1">
    <div className="px-1 pb-1 pt-0.5 text-[10.5px] font-medium text-muted-foreground">
      رنگ متن
    </div>
    <div className="grid grid-cols-5 gap-1">
      {EDITOR_COLORS.map((color) => {
        const isActive = textColor === color.value;
        return (
          <button
            key={`text-${color.value}`}
            type="button"
            title={`رنگ متن: ${color.label}`}
            aria-label={`رنگ متن: ${color.label}`}
            onClick={() => onPickText(color.value)}
            className={`flex h-8 items-center justify-center rounded-md border text-[13px] font-bold transition-colors hover:bg-secondary ${
              isActive ? 'border-foreground/50 bg-secondary' : 'border-border/50'
            }`}
            style={{ color: textColorOf(color.value) }}
          >
            A
          </button>
        );
      })}
    </div>

    <div className="px-1 pb-1 pt-2 text-[10.5px] font-medium text-muted-foreground">
      رنگ پس‌زمینه
    </div>
    <div className="grid grid-cols-5 gap-1">
      {EDITOR_COLORS.map((color) => {
        const isActive = backgroundColor === color.value;
        return (
          <button
            key={`bg-${color.value}`}
            type="button"
            title={`رنگ پس‌زمینه: ${color.label}`}
            aria-label={`رنگ پس‌زمینه: ${color.label}`}
            onClick={() => onPickBackground(color.value)}
            className={`h-8 rounded-md border transition-colors hover:border-foreground/40 ${
              isActive ? 'border-foreground/60 ring-2 ring-foreground/25' : 'border-border/60'
            }`}
            style={{ backgroundColor: bgColorOf(color.value) }}
          />
        );
      })}
    </div>
  </div>
);

/** Color button for the text selection toolbar. */
export const SelectionColorButton: React.FC = () => {
  const Components = useComponentsContext()! as any;
  const editor = useBlockNoteEditor<any, any, any>();

  const apply = (kind: 'text' | 'background', value: string) => {
    try {
      editor.addStyles(
        kind === 'text' ? ({ textColor: value } as any) : ({ backgroundColor: value } as any)
      );
    } catch (err) {
      console.error('Failed to apply color:', err);
    }
  };

  return (
    <Components.Generic.Menu.Root position="bottom">
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          mainTooltip="رنگ متن و پس‌زمینه"
          label="رنگ"
          icon={<RiPaletteLine className="size-4" />}
        />
      </Components.Generic.Menu.Trigger>

      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-color-picker-dropdown !z-[130] rounded-xl border border-border/70 bg-popover p-1.5 shadow-xl">
        <ColorPanel
          onPickText={(value) => apply('text', value)}
          onPickBackground={(value) => apply('background', value)}
        />
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
};
