import { useEffect, useReducer, useRef } from 'react';
import { useHistoryBack } from '@/lib/navigation/use-history-back';

/**
 * Calendar popovers must not silently drop a month/year the user navigated to: people pick a
 * month and year in the dropdowns and click outside, expecting the date to change. After such
 * a change without a day click, a close request (outside click, Escape, the trigger) shows a
 * confirmation instead - choose a day, or close without a change.
 */
export interface CalendarGuardState {
  open: boolean;
  /** Month or year changed in this session, no day picked since */
  dirty: boolean;
  /** The "no day selected yet" prompt is showing */
  confirming: boolean;
}

export type CalendarGuardAction =
  | { type: 'open' }
  | { type: 'toggle' }
  | { type: 'navigate' }
  | { type: 'select' }
  | { type: 'requestClose' }
  | { type: 'keepChoosing' }
  | { type: 'discard' };

export const CLOSED_CALENDAR: CalendarGuardState = { open: false, dirty: false, confirming: false };

export function calendarGuardReducer(state: CalendarGuardState, action: CalendarGuardAction): CalendarGuardState {
  switch (action.type) {
    case 'open':
      return { open: true, dirty: false, confirming: false };
    case 'toggle':
      return state.open ? calendarGuardReducer(state, { type: 'requestClose' }) : { open: true, dirty: false, confirming: false };
    case 'navigate':
      return state.open ? { ...state, dirty: true, confirming: false } : state;
    case 'select':
    case 'discard':
      return CLOSED_CALENDAR;
    case 'requestClose':
      if (!state.open) return state;
      return state.dirty ? { ...state, confirming: true } : CLOSED_CALENDAR;
    case 'keepChoosing':
      return { ...state, confirming: false };
  }
}

/**
 * The guard state plus the Back button: Back is one more close request, so after a month change
 * without a day it shows the prompt and keeps the calendar (and its history entry).
 */
export function useCalendarGuard() {
  const [state, dispatch] = useReducer(calendarGuardReducer, CLOSED_CALENDAR);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  useHistoryBack(state.open, () => {
    const stays = calendarGuardReducer(stateRef.current, { type: 'requestClose' }).open;
    dispatch({ type: 'requestClose' });
    return !stays;
  });
  return [state, dispatch] as const;
}
