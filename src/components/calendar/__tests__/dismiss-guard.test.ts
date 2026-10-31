import { describe, it, expect } from 'vitest';
import { calendarGuardReducer, CLOSED_CALENDAR, type CalendarGuardAction, type CalendarGuardState } from '../dismiss-guard';

const run = (...actions: CalendarGuardAction['type'][]): CalendarGuardState =>
  actions.reduce((state, type) => calendarGuardReducer(state, { type } as CalendarGuardAction), CLOSED_CALENDAR);

describe('calendar popover dismiss guard', () => {
  it('closes normally when the month was not touched', () => {
    expect(run('open', 'requestClose')).toEqual(CLOSED_CALENDAR);
    expect(run('toggle', 'toggle')).toEqual(CLOSED_CALENDAR);
  });

  it('asks instead of closing after a month/year change without a day', () => {
    const state = run('open', 'navigate', 'requestClose');
    expect(state).toEqual({ open: true, dirty: true, confirming: true });
    // The trigger button is a close request too
    expect(run('toggle', 'navigate', 'toggle')).toMatchObject({ open: true, confirming: true });
    // Asking again keeps the prompt
    expect(run('open', 'navigate', 'requestClose', 'requestClose')).toMatchObject({ open: true, confirming: true });
  });

  it('keeps choosing or discards on request', () => {
    expect(run('open', 'navigate', 'requestClose', 'keepChoosing')).toEqual({ open: true, dirty: true, confirming: false });
    expect(run('open', 'navigate', 'requestClose', 'discard')).toEqual(CLOSED_CALENDAR);
  });

  it('closes after a day was picked, also following a navigation', () => {
    expect(run('open', 'navigate', 'select')).toEqual(CLOSED_CALENDAR);
    // Navigating again hides an open prompt and the next day click closes
    expect(run('open', 'navigate', 'requestClose', 'navigate')).toEqual({ open: true, dirty: true, confirming: false });
  });

  it('starts every session clean', () => {
    expect(run('open', 'navigate', 'requestClose', 'discard', 'open', 'requestClose')).toEqual(CLOSED_CALENDAR);
    // A closed calendar ignores navigation and close requests
    expect(run('navigate', 'requestClose')).toEqual(CLOSED_CALENDAR);
  });
});
