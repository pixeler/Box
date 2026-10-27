import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Page title; the only h1 on the page. */
  title: string;
  /** Extra classes for the h1, e.g. a display font. */
  titleClassName?: string;
  /** A quiet second line: date, counter or short context. */
  subtitle?: React.ReactNode;
  /** Extra classes for the subtitle, e.g. a slightly larger date line. */
  subtitleClassName?: string;
  /** Optional inline badge next to the title (e.g. a "today" chip). */
  badge?: React.ReactNode;
  /** Actions rendered on the opposite side of the title. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The shared page layout: one title on the reading-start side, actions on the
 * other, and a hairline that only appears while the body scrolls under it.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  badge,
  actions,
  className,
}) => (
  <header
    className={cn(
      'flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pb-4 pt-8 sm:px-6 sm:pt-10',
      className
    )}
  >
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <h1
          className={cn(
            'truncate text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[24px]',
            titleClassName
          )}
        >
          {title}
        </h1>
        {badge}
      </div>
      {subtitle && (
        <p className={cn('mt-1 text-[12.5px] leading-5 text-muted-foreground', subtitleClassName)}>
          {subtitle}
        </p>
      )}
    </div>

    {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
  </header>
);
