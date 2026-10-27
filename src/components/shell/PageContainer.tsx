import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  width?: 'content' | 'prose' | 'calendar' | 'wide';
  className?: string;
}

const WIDTHS: Record<NonNullable<PageContainerProps['width']>, string> = {
  content: 'max-w-[var(--content-max)]',
  prose: 'max-w-[var(--prose-max)]',
  calendar: 'max-w-[var(--calendar-max)]',
  wide: 'max-w-[1120px]',
};

/**
 * One centred column inside the shell. Horizontal padding is intentionally
 * small because each page still owns its own comfortable gutters.
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  width = 'content',
  className,
}) => (
  <div className={cn('mx-auto w-full', WIDTHS[width], className)}>{children}</div>
);
