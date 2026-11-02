import React, { Suspense, lazy } from 'react';
import type { NoteEditModalProps } from './NoteEditModal';

const Modal = lazy(() =>
  import('./NoteEditModal').then((m) => ({ default: m.NoteEditModal }))
);

/**
 * The note editor sheet is only mounted while a note is open; keeping it lazy
 * keeps its toolbar and editor chrome out of the boot bundle.
 */
export const NoteEditModal: React.FC<NoteEditModalProps> = (props) => (
  <Suspense fallback={null}>
    <Modal key={props.note?.id ?? props.template?.id ?? 'modal'} {...props} />
  </Suspense>
);
