import React from 'react';
import { desktop } from '@/lib/desktop';

interface AppErrorBoundaryState {
  error: Error | null;
  componentStack: string;
  copied: boolean;
  /** Which runtime card was copied last, so only that one flashes "کپی شد". */
  copiedErrorId: number | null;
}

interface RuntimeToastError {
  id: number;
  title: string;
  detail: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState & { runtimeErrors: RuntimeToastError[] }
> {
  private nextId = 1;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      error: null,
      componentStack: '',
      copied: false,
      copiedErrorId: null,
      runtimeErrors: [],
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Uncaught render error:', error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack || '' });
  }

  componentDidMount(): void {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount(): void {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleWindowError = (event: ErrorEvent) => {
    const message = event.error?.message || event.message || 'خطای غیرمنتظره در اجرای برنامه';
    // Ignore benign ResizeObserver loop warnings that browsers emit.
    if (message.includes('ResizeObserver loop')) return;

    const stack =
      event.error?.stack ||
      (event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '');
    this.pushRuntimeError('خطای زمان اجرا', stack ? `${message}\n${stack}` : message);
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

    if (!message || message.includes('ResizeObserver loop')) return;
    // Capacitor ships web stubs for native-only plugins; on desktop and in the
    // browser they reject with "plugin is not implemented on web". Nothing the
    // user can act on, so it never becomes a visible error card.
    if (/plugin is not implemented on web/i.test(message)) return;
    const stack = reason instanceof Error && reason.stack ? `\n${reason.stack}` : '';
    this.pushRuntimeError('خطای شبکه یا عملیات ناهمگام', `${message}${stack}`);
  };

  private pushRuntimeError(title: string, detail: string) {
    const id = this.nextId++;
    this.setState((prev) => ({
      runtimeErrors: [...prev.runtimeErrors.slice(-2), { id, title, detail }],
    }));
  }

  private dismissRuntimeError = (id: number) => {
    this.setState((prev) => ({
      runtimeErrors: prev.runtimeErrors.filter((item) => item.id !== id),
    }));
  };

  private handleReload = () => {
    if (desktop?.reload) {
      desktop.reload();
    } else {
      window.location.reload();
    }
  };

  private handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  private copyRuntimeError = (id: number, text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        this.setState({ copiedErrorId: id });
        window.setTimeout(() => {
          this.setState((prev) =>
            prev.copiedErrorId === id ? { copiedErrorId: null } : { copiedErrorId: prev.copiedErrorId }
          );
        }, 1800);
      })
      .catch(() => {});
  };

  render() {
    const { error, componentStack, copied, runtimeErrors, copiedErrorId } = this.state;

    if (error) {
      const fullErrorText = [
        error.name ? `${error.name}: ${error.message}` : error.message,
        error.stack || '',
        componentStack ? `\nComponent Stack:${componentStack}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      return (
        <div
          dir="rtl"
          className="flex min-h-screen flex-col bg-background text-foreground font-sans select-text"
        >
          {desktop && (
            <div
              className="desktop-titlebar flex h-10 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3 select-none"
              onDoubleClick={() => desktop?.toggleMaximize()}
            >
              <span className="text-xs text-muted-foreground">SpaceZen — گزارش خطا</span>
              <div dir="ltr" className="desktop-no-drag flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => desktop?.minimize()}
                  className="flex h-7 w-8 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  title="کوچک کردن"
                >
                  —
                </button>
                <button
                  type="button"
                  onClick={() => desktop?.toggleMaximize()}
                  className="flex h-7 w-8 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  title="بزرگ کردن"
                >
                  □
                </button>
                <button
                  type="button"
                  onClick={() => desktop?.close()}
                  className="flex h-7 w-8 items-center justify-center rounded text-muted-foreground hover:bg-rose-600 hover:text-white"
                  title="بستن"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h1 className="text-base font-semibold text-destructive">
                  خطایی در نمایش برنامه رخ داد
                </h1>
                <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  {error.name || 'Error'}
                </span>
              </div>
              <p className="mb-4 text-xs leading-6 text-muted-foreground">
                برنامه با یک خطای پیش‌بینی‌نشده روبه‌رو شد. می‌توانید صفحه را دوباره بارگذاری کنید یا جزئیات خطا را بررسی کنید.
              </p>

              <pre
                dir="ltr"
                className="mb-4 max-h-60 overflow-auto rounded-lg border border-border bg-background/80 p-3 text-left font-mono text-[11.5px] leading-5 text-foreground whitespace-pre-wrap break-words"
              >
                {fullErrorText}
              </pre>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
                >
                  بارگذاری مجدد
                </button>
                <button
                  type="button"
                  onClick={() => this.setState({ error: null, componentStack: '' })}
                  className="rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  تلاش برای ادامه
                </button>
                <button
                  type="button"
                  onClick={() => this.handleCopy(fullErrorText)}
                  className="rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {copied ? 'کپی شد' : 'کپی جزئیات خطا'}
                </button>
                {desktop?.toggleDevTools && (
                  <button
                    type="button"
                    onClick={() => desktop?.toggleDevTools?.()}
                    className="rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    ابزار توسعه‌دهنده (F12)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {this.props.children}
        {runtimeErrors.length > 0 && (
          <div
            dir="rtl"
            className="fixed bottom-4 left-4 z-[9999] flex max-w-md flex-col gap-2 pointer-events-auto"
          >
            {runtimeErrors.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-destructive/40 bg-card/95 p-3.5 text-card-foreground shadow-lg backdrop-blur-md"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-destructive">{item.title}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        this.copyRuntimeError(item.id, `${item.title}\n${item.detail}`)
                      }
                      className="rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {copiedErrorId === item.id ? 'کپی شد' : 'کپی'}
                    </button>
                    {desktop?.toggleDevTools && (
                      <button
                        type="button"
                        onClick={() => desktop?.toggleDevTools?.()}
                        className="rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        DevTools
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => this.dismissRuntimeError(item.id)}
                      className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="بستن خطا"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <pre
                  dir="ltr"
                  className="max-h-28 overflow-auto rounded bg-background/70 p-2 text-left font-mono text-[11px] leading-4 text-muted-foreground whitespace-pre-wrap break-words"
                >
                  {item.detail}
                </pre>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
}

