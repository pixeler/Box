import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { FocusTimerProvider } from './components/focus/FocusTimerContext';
import { initNativePlugins } from './lib/capacitor';

import { AuthProvider } from './lib/auth';
import { syncManager } from './lib/sync';

// Initialize native Capacitor plugins when running on Android/iOS
initNativePlugins();

// Initialize smart background sync engine
syncManager.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <FocusTimerProvider>
        <App />
      </FocusTimerProvider>
    </AuthProvider>
  </React.StrictMode>
);
