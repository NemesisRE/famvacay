'use client';

import { useEffect, useRef } from 'react';
import { getHistoryEntries, type HistoryBackHandler } from './history-entries';

/**
 * While `active`, the browser Back button calls `onBack` instead of leaving the page: for
 * popovers, modals and drawers (onBack closes them) and in-app views (onBack returns to the
 * previous one). Closing by other means releases the history entry again.
 */
export function useHistoryBack(active: boolean, onBack: HistoryBackHandler): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    const entries = getHistoryEntries();
    if (!entries) return;
    const id = entries.push(() => onBackRef.current());
    return () => entries.release(id);
  }, [active]);
}

/**
 * For a step that is not an open/closed state (a view switch): push now, Back calls onBack.
 * Returns the step's id for goBackHistoryStep (null during server rendering).
 */
export function pushHistoryStep(onBack: HistoryBackHandler): number | null {
  return getHistoryEntries()?.push(onBack) ?? null;
}

/** An in-app back button for a step: goes back through the browser history (runs onBack). */
export function goBackHistoryStep(id: number): void {
  getHistoryEntries()?.goBack(id);
}
