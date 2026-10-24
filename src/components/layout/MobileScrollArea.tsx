import React, { useRef, useState, useEffect, useCallback } from 'react';

interface MobileScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Scroll container with a custom floating thumb and drag-to-scroll.
 *
 * Thumb geometry is written straight to the DOM instead of through React
 * state: scrolling must never re-render the (potentially large) children,
 * which is what made long lists stutter.
 */
export const MobileScrollArea: React.FC<MobileScrollAreaProps> = ({
  children,
  className = '',
  contentClassName = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef({ height: 0, top: 0 });
  const rafRef = useRef<number | null>(null);

  const [hasThumb, setHasThumb] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [isDraggingContent, setIsDraggingContent] = useState(false);

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingThumbRef = useRef(false);

  // Content drag-to-scroll refs
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);
  const hasDraggedContentRef = useRef(false);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const momentumRafRef = useRef<number | null>(null);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 2) {
      geometryRef.current = { height: 0, top: 0 };
      setHasThumb((prev) => (prev ? false : prev));
      return;
    }

    const minThumbHeight = 28;
    const computedHeight = Math.max(
      minThumbHeight,
      (clientHeight / scrollHeight) * clientHeight
    );
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - computedHeight;
    const computedTop = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0;

    geometryRef.current = { height: computedHeight, top: computedTop };

    const thumb = thumbRef.current;
    if (thumb) {
      thumb.style.height = `${computedHeight}px`;
      thumb.style.transform = `translateY(${computedTop}px)`;
    } else {
      // Mounted on the next paint with these values already in its inline style.
      setHasThumb(true);
    }
  }, []);

  /** Coalesce geometry work into one measurement per animation frame. */
  const scheduleThumbUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateThumb();
    });
  }, [updateThumb]);

  const showScrollbar = useCallback(() => {
    setIsVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingThumbRef.current) {
        setIsVisible(false);
      }
    }, 1200);
  }, []);

  const handleScroll = () => {
    scheduleThumbUpdate();
    showScrollbar();
  };

  // Recalculate on content change / resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      scheduleThumbUpdate();
    });

    observer.observe(el);
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }

    updateThumb();

    return () => {
      observer.disconnect();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (momentumRafRef.current) cancelAnimationFrame(momentumRafRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleThumbUpdate, updateThumb]);

  // --- 1. Thumb Dragging (Mouse & Touch) ---
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDraggingThumb(true);
    isDraggingThumbRef.current = true;
    setIsVisible(true);

    const startY = e.clientY;
    const el = scrollRef.current;
    if (!el) return;

    const startScrollTop = el.scrollTop;
    const { scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - geometryRef.current.height;
    const ratio = maxThumbTop > 0 ? maxScroll / maxThumbTop : 1;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = startScrollTop + deltaY * ratio;
      }
    };

    const onMouseUp = () => {
      setIsDraggingThumb(false);
      isDraggingThumbRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 1000);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleThumbTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();

    setIsDraggingThumb(true);
    isDraggingThumbRef.current = true;
    setIsVisible(true);

    const startY = e.touches[0].clientY;
    const el = scrollRef.current;
    if (!el) return;

    const startScrollTop = el.scrollTop;
    const { scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - geometryRef.current.height;
    const ratio = maxThumbTop > 0 ? maxScroll / maxThumbTop : 1;

    const onTouchMove = (moveEvent: TouchEvent) => {
      const deltaY = moveEvent.touches[0].clientY - startY;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = startScrollTop + deltaY * ratio;
      }
    };

    const onTouchEnd = () => {
      setIsDraggingThumb(false);
      isDraggingThumbRef.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 1000);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const el = scrollRef.current;
    if (!el) return;

    const { scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - geometryRef.current.height;
    const scrollTarget = maxThumbTop > 0 ? (clickY / maxThumbTop) * maxScroll : 0;
    el.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  };

  // Global cleanup on native HTML5 drag operations
  useEffect(() => {
    const handleGlobalDragEvent = () => {
      setIsDraggingContent(false);
      hasDraggedContentRef.current = false;
      if (momentumRafRef.current) {
        cancelAnimationFrame(momentumRafRef.current);
      }
    };

    window.addEventListener('dragstart', handleGlobalDragEvent);
    window.addEventListener('dragend', handleGlobalDragEvent);
    window.addEventListener('drop', handleGlobalDragEvent);

    return () => {
      window.removeEventListener('dragstart', handleGlobalDragEvent);
      window.removeEventListener('dragend', handleGlobalDragEvent);
      window.removeEventListener('drop', handleGlobalDragEvent);
    };
  }, []);

  // --- 2. Container Drag-To-Scroll (Mouse & Hand/Touch) ---
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Ignore right clicks or clicks on form inputs, buttons, drag handles, and draggable task cards
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (['input', 'textarea', 'select', 'button'].includes(target.tagName.toLowerCase())) return;
    if (
      target.closest(
        '[draggable="true"], [data-draggable], button, [data-no-drag-scroll], [role="button"], input, textarea, select, a'
      )
    ) {
      return;
    }
    if (target.isContentEditable) return;

    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
    }

    const el = scrollRef.current;
    if (!el) return;

    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = el.scrollTop;
    hasDraggedContentRef.current = false;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('dragstart', onDragCancel);
      window.removeEventListener('dragend', onDragCancel);
      window.removeEventListener('drop', onDragCancel);
      window.removeEventListener('blur', onDragCancel);
      setIsDraggingContent(false);
      setTimeout(() => {
        hasDraggedContentRef.current = false;
      }, 50);
    };

    const onDragCancel = () => {
      cleanup();
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartYRef.current;

      if (!hasDraggedContentRef.current && Math.abs(deltaY) > 4) {
        hasDraggedContentRef.current = true;
        setIsDraggingContent(true);
      }

      if (hasDraggedContentRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = dragStartScrollTopRef.current - deltaY;

        const now = performance.now();
        const dt = now - lastTimeRef.current;
        if (dt > 0) {
          velocityRef.current = (moveEvent.clientY - lastYRef.current) / dt;
          lastYRef.current = moveEvent.clientY;
          lastTimeRef.current = now;
        }
      }
    };

    const onMouseUp = () => {
      cleanup();

      if (hasDraggedContentRef.current) {
        // Apply smooth momentum gliding
        if (Math.abs(velocityRef.current) > 0.15) {
          let v = velocityRef.current * 16;
          const decay = 0.93;
          const step = () => {
            if (!scrollRef.current || Math.abs(v) < 0.4) return;
            scrollRef.current.scrollTop -= v;
            v *= decay;
            momentumRafRef.current = requestAnimationFrame(step);
          };
          momentumRafRef.current = requestAnimationFrame(step);
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('dragstart', onDragCancel);
    window.addEventListener('dragend', onDragCancel);
    window.addEventListener('drop', onDragCancel);
    window.addEventListener('blur', onDragCancel);
  };

  // Auto-scroll when dragging tasks near top or bottom edges
  const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const mouseY = e.clientY;
    const topEdge = rect.top + 60;
    const bottomEdge = rect.bottom - 60;

    if (mouseY < topEdge && el.scrollTop > 0) {
      const ratio = Math.max(0.2, (topEdge - mouseY) / 60);
      el.scrollTop -= Math.round(ratio * 12);
      showScrollbar();
    } else if (mouseY > bottomEdge && el.scrollTop < el.scrollHeight - el.clientHeight) {
      const ratio = Math.max(0.2, (mouseY - bottomEdge) / 60);
      el.scrollTop += Math.round(ratio * 12);
      showScrollbar();
    }
  };

  // Intercept and prevent accidental clicks after dragging
  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedContentRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className={`relative w-full flex-1 min-h-0 overflow-hidden ${className}`}>
      {/* Scrollable Container (Drag-to-scroll enabled with mouse and touch, auto-scroll during card drag) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleContainerMouseDown}
        onDragOver={handleContainerDragOver}
        onClickCapture={handleClickCapture}
        className={`w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar select-none ${
          isDraggingContent ? 'cursor-grabbing select-none' : 'cursor-default'
        }`}
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        <div className={contentClassName}>{children}</div>
      </div>

      {/* Floating Scrollbar: 2px thickness, completely rounded, shifted -5px to the left */}
      {hasThumb && (
        <div
          onClick={handleTrackClick}
          className={`absolute -left-1 top-0 bottom-0 w-[8px] z-30 transition-opacity duration-300 select-none ${
            isVisible || isDraggingThumb || isDraggingContent
              ? 'opacity-100 pointer-events-auto cursor-pointer'
              : 'opacity-0 pointer-events-none'
          }`}
          title="نوار اسکرول"
        >
          {/* Scroll Thumb: 2px width, completely rounded-full */}
          <div
            ref={thumbRef}
            style={{
              transform: `translateY(${geometryRef.current.top}px)`,
              height: `${geometryRef.current.height}px`,
            }}
            onMouseDown={handleThumbMouseDown}
            onTouchStart={handleThumbTouchStart}
            className="w-[2px] bg-black/45 hover:bg-black/70 active:bg-black/90 rounded-full cursor-pointer pointer-events-auto transition-colors"
          />
        </div>
      )}
    </div>
  );
};
