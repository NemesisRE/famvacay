import { describe, it, expect, vi } from 'vitest';
import { createHistoryEntries, HISTORY_ENTRY_KEY } from '../history-entries';

/** Browser-like history: back() is asynchronous and fires popstate; pushState drops forward entries. */
function fakeBrowser() {
  const entries: unknown[] = [{ page: true }];
  let index = 0;
  const listeners: (() => void)[] = [];
  const go = (delta: number) => {
    setTimeout(() => {
      const next = index + delta;
      if (next < 0 || next >= entries.length) return;
      index = next;
      listeners.forEach((l) => l());
    }, 0);
  };
  return {
    history: {
      get state() {
        return entries[index];
      },
      pushState(state: unknown) {
        entries.splice(index + 1, entries.length, state);
        index++;
      },
      replaceState(state: unknown) {
        entries[index] = state;
      },
      back: () => go(-1),
    },
    forward: () => go(1),
    addEventListener: (_type: 'popstate', listener: () => void) => {
      listeners.push(listener);
    },
    get length() {
      return entries.length;
    },
    get index() {
      return index;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('history entries for overlays and views', () => {
  it('Back closes the open overlay instead of leaving the page', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const onBack = vi.fn();
    entries.push(onBack);
    expect(browser.index).toBe(1);

    browser.history.back();
    await settle();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(entries.size()).toBe(0);
    expect(browser.index).toBe(0);
  });

  it('closing in the UI removes the entry, so the next Back is not wasted', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const onBack = vi.fn();
    const id = entries.push(onBack);

    entries.release(id);
    await settle();
    expect(browser.index).toBe(0);
    // Our own history.back() must not call the (already closed) overlay
    expect(onBack).not.toHaveBeenCalled();
  });

  it('Back closes the topmost of several overlays first', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const lower = vi.fn();
    const upper = vi.fn();
    entries.push(lower);
    entries.push(upper);

    browser.history.back();
    await settle();
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();

    browser.history.back();
    await settle();
    expect(lower).toHaveBeenCalledTimes(1);
  });

  it('an overlay that stays open on Back (dirty calendar) gets its entry back', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    let dirty = true;
    const onBack = vi.fn(() => !dirty);
    entries.push(onBack);

    browser.history.back();
    await settle();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(entries.size()).toBe(1);
    expect(browser.index).toBe(1);

    // Confirmed: the next Back closes it
    dirty = false;
    browser.history.back();
    await settle();
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(entries.size()).toBe(0);
  });

  it('an in-app back button steps back through the history and runs the step once', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const restoreView = vi.fn();
    const id = entries.push(restoreView);

    entries.goBack(id);
    await settle();
    expect(restoreView).toHaveBeenCalledTimes(1);
    expect(browser.index).toBe(0);
    expect(entries.size()).toBe(0);
  });

  it('Forward onto a stale entry does nothing', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const onBack = vi.fn();
    entries.push(onBack);
    browser.history.back();
    await settle();

    browser.forward();
    await settle();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('releasing after a navigation to another page leaves that page alone', async () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const id = entries.push(vi.fn());
    // A link inside the popover navigated away; the overlay unmounts afterwards
    browser.history.pushState({ otherPage: true });
    entries.release(id);
    await settle();
    expect(browser.index).toBe(2);
  });

  it('URL updates keep the marker of the open entry', () => {
    const browser = fakeBrowser();
    const entries = createHistoryEntries(browser);
    const id = entries.push(vi.fn());
    entries.replaceUrl('/?view=list');
    expect(browser.history.state).toEqual({ [HISTORY_ENTRY_KEY]: id });
  });
});
