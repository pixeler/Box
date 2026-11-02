/**
 * A tiny event bus for "start focusing on this task".
 *
 * Task cards live deep in the tree (today, calendar, notes) and should not have
 * to consume the timer context, which changes twice a second. They fire a
 * request instead, and a single listener inside the app starts the session and
 * navigates to the focus view.
 */
const FOCUS_TASK_EVENT = 'app:start-focus-task';

export interface FocusTaskRequest {
  id: string;
  title: string;
  minutes?: number;
}

export function requestFocusTask(task: FocusTaskRequest): void {
  window.dispatchEvent(new CustomEvent<FocusTaskRequest>(FOCUS_TASK_EVENT, { detail: task }));
}

export function onFocusTaskRequest(handler: (task: FocusTaskRequest) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<FocusTaskRequest>).detail);
  window.addEventListener(FOCUS_TASK_EVENT, listener);
  return () => window.removeEventListener(FOCUS_TASK_EVENT, listener);
}
