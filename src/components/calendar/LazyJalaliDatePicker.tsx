import React, { Suspense, lazy } from 'react';
import type { JalaliDatePickerProps } from './JalaliDatePicker';

const Picker = lazy(() =>
  import('./JalaliDatePicker').then((m) => ({ default: m.JalaliDatePicker }))
);

/**
 * The date picker is a bottom sheet that only exists while it is open. It is
 * the single biggest component in the day view, so it is loaded on demand
 * instead of riding along in the boot bundle. The chunk is prefetched on idle
 * (see `main.tsx`), which makes the first open effectively instant.
 */
export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = (props) => (
  <Suspense fallback={null}>
    <Picker {...props} />
  </Suspense>
);
