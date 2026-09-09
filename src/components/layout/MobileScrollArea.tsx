import React, { useRef, useState, useEffect, useCallback } from 'react';

interface MobileScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const MobileScrollArea: React.FC<MobileScrollAreaProps> = ({
  children,
  className = '',
  contentClassName = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
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
      setThumbHeight(0);
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

    setThumbHeight(computedHeight);
    setThumbTop(computedTop);
  }, []);

  const triggerScrollVisibility = useCallback(() => {
    updateThumb();
    setIsVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingThumbRef.current) {
        setIsVisible(false);
      }
    }, 1200);
  }, [updateThumb]);

  const handleScroll = () => {
    triggerScrollVisibility();
  };

  // Recalculate on content change / resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      updateThumb();
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
    };
  }, [updateThumb]);

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
    const maxThumbTop = clientHeight - thumbHeight;
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
    const maxThumbTop = clientHeight - thumbHeight;
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
    const maxThumbTop = clientHeight - thumbHeight;
    const scrollTarget = maxThumbTop > 0 ? (clickY / maxThumbTop) * maxScroll : 0;
    el.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  };

  // --- 2. Container Drag-To-Scroll (Mouse & Hand/Touch) ---
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Ignore right clicks or clicks on form inputs
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())) return;
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
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (hasDraggedContentRef.current) {
        setIsDraggingContent(false);

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

        // Reset drag state on next tick to allow click capture to intercept
        setTimeout(() => {
          hasDraggedContentRef.current = false;
        }, 50);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
      {/* Scrollable Container (Drag-to-scroll enabled with mouse and touch) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleContainerMouseDown}
        onClickCapture={handleClickCapture}
        className={`w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar select-none ${
          isDraggingContent ? 'cursor-grabbing select-none' : 'cursor-default'
        }`}
        style={{ touchAction: 'pan-y' }}
      >
        <div className={contentClassName}>{children}</div>
      </div>

      {/* Floating Scrollbar: 2px thickness, completely rounded, shifted -5px to the left */}
      {thumbHeight > 0 && (
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
            style={{
              transform: `translateY(${thumbTop}px)`,
              height: `${thumbHeight}px`,
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
