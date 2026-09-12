import { fa } from '@blocknote/core/locales';
import type { Dictionary } from '@blocknote/core';

// سفارشی‌سازی دیکشنری فارسی با کلمات روان‌تر و امروزی‌تر
export const faDictionary: Dictionary = {
  ...fa,
  placeholders: {
    ...fa.placeholders,
    default: 'برای نوشتن آغاز کنید یا با / دستورات را بیاورید...',
    heading: 'عنوان...',
    bulletListItem: 'مورد...',
    numberedListItem: 'مورد شماره‌دار...',
    checkListItem: 'کار جدید...',
  },
  slash_menu: {
    ...fa.slash_menu,
    check_list: {
      ...fa.slash_menu.check_list,
      title: 'چک‌لیست',
      subtext: 'لیست وظایف با امکان تیک زدن',
      aliases: ['چک لیست', 'وظایف', 'تسک', 'todo', 'check'],
      group: 'بلوک‌های پایه',
    },
    bullet_list: {
      ...fa.slash_menu.bullet_list,
      title: 'لیست نشانه‌دار (بولت)',
      subtext: 'لیست ساده با نقطه‌های نشانه‌دار',
      aliases: ['لیست', 'بولت', 'نشان دار', 'bullet', 'list'],
      group: 'بلوک‌های پایه',
    },
    numbered_list: {
      ...fa.slash_menu.numbered_list,
      title: 'لیست شماره‌دار',
      subtext: 'لیست با ترتیب اعداد',
      aliases: ['شماره', 'لیست شماره دار', 'number', 'ordered'],
      group: 'بلوک‌های پایه',
    },
    paragraph: {
      ...fa.slash_menu.paragraph,
      title: 'متن ساده',
      subtext: 'شروع یک پاراگراف جدید',
      aliases: ['متن', 'پاراگراف', 'text', 'p'],
      group: 'بلوک‌های پایه',
    },
    quote: {
      ...fa.slash_menu.quote,
      title: 'نقل‌قول',
      subtext: 'باکس مخصوص نقل‌قول',
      aliases: ['نقل قول', 'گفتاورد', 'quote'],
      group: 'پیشرفته',
    },
    divider: {
      ...fa.slash_menu.divider,
      title: 'خط جداکننده',
      subtext: 'خط افقی برای تفکیک بخش‌ها',
      aliases: ['خط', 'جداکننده', 'divider', 'hr'],
      group: 'پیشرفته',
    },
  },
};
