import { useReducer } from 'react';

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

export function useCalendarGuard() {
  return useReducer(calendarGuardReducer, CLOSED_CALENDAR);
}
