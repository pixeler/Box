import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { FocusTimerProvider } from './components/focus/FocusTimerContext';
import { AuthProvider } from './lib/auth';
import { afterFirstPaint, runWhenIdle } from './lib/idle';

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <FocusTimerProvider>
        <App />
      </FocusTimerProvider>
    </AuthProvider>
  </React.StrictMode>
);

/**
 * Everything below is deliberately kept out of the critical path.
 *
 * The first screen renders straight from IndexedDB, so native chrome and the
 * cloud sync engine only start once the first frame is on screen. Sync is a
 * background reconciliation: if there is no network the app simply keeps
 * working with local data.
 */
afterFirstPaint(() => {
  import('./lib/capacitor')
    .then((mod) => mod.initNativePlugins())
    .catch(() => {});

  runWhenIdle(() => {
    import('./lib/sync')
      .then((mod) => mod.syncManager.init())
      .catch(() => {});
  });

  // Warm the tab chunks once the first screen is interactive, so switching
  // between Today / Calendar / Notebook / Focus never waits on a fetch.
  runWhenIdle(() => {
    void import('./components/calendar/CalendarView');
    void import('./components/notebook/NotebookView');
    void import('./components/todo/TodoView');
    void import('./components/focus/FocusView');
  }, 3000);

  // Same idea for the on-demand overlays: they are opened rarely, but never
  // during the first seconds, so warming them on idle costs nothing.
  runWhenIdle(() => {
    void import('./components/calendar/JalaliDatePicker');
    void import('./components/task/TaskEditModal');
    void import('./components/notebook/NoteEditModal');
    void import('./components/settings/SettingsDialog');
  }, 5000);
});
