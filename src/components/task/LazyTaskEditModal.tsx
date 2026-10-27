import React, { Suspense, lazy } from 'react';
import type { TaskEditModalProps } from './TaskEditModal';

const Modal = lazy(() =>
  import('./TaskEditModal').then((m) => ({ default: m.TaskEditModal }))
);

/**
 * Task editing is a full-screen sheet that only exists while it is open, so it
 * loads on demand rather than sitting in the boot bundle.
 */
export const TaskEditModal: React.FC<TaskEditModalProps> = (props) => (
  <Suspense fallback={null}>
    <Modal {...props} />
  </Suspense>
);
