/**
 * Boot-time scheduling helpers.
 *
 * The app is offline-first: everything the first screen needs lives in the
 * local database, so nothing should be allowed to compete with the first
 * paint. These helpers push non-critical work (cloud sync, seeding, chunk
 * prefetching, native plugin wiring) out of the critical path.
 */

type Task = () => void;

function safeRun(task: Task): void {
  try {
    task();
  } catch (err) {
    console.warn('Deferred task failed:', err);
  }
}

/** Runs `task` once the browser is idle, with a hard upper bound. */
export function runWhenIdle(task: Task, timeout = 1500): void {
  if (typeof window === 'undefined') return;

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => safeRun(task), { timeout });
    return;
  }

  window.setTimeout(() => safeRun(task), 150);
}

/** Runs `task` right after the first frame has been painted. */
export function afterFirstPaint(task: Task): void {
  if (typeof window === 'undefined') return;

  const run = () => window.setTimeout(task, 0);

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    return;
  }
  run();
}
