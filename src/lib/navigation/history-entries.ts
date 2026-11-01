/**
 * Browser history entries for in-page overlays and views, so the Back button (and the back
 * gesture on phones) closes the topmost popover/modal or returns to the previous in-app view
 * instead of leaving the page.
 *
 * Opening pushes an entry onto the browser history; Back pops it and calls the entry's onBack.
 * Closing in the UI (click, Escape) releases the entry with history.back(), so the next Back
 * does not land on a stale entry. Entries are a stack: Back always handles the most recent one.
 *
 * The entries carry no URL, and Next.js copies its router state into native pushState calls,
 * so the App Router treats the extra entries as the same page.
 */

export const HISTORY_ENTRY_KEY = 'famvacayEntry';

/** onBack returns false to stay open (e.g. the calendar asks first); its entry is restored. */
export type HistoryBackHandler = () => boolean | void;

interface HistoryTarget {
  history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;
  addEventListener(type: 'popstate', listener: () => void): void;
}

interface Entry {
  id: number;
  onBack: HistoryBackHandler;
}

export interface HistoryEntries {
  push(onBack: HistoryBackHandler): number;
  release(id: number): void;
  /** An in-app back button: steps back through the browser history, which runs onBack */
  goBack(id: number): void;
  replaceUrl(url: string): void;
  /** Entries currently open, oldest first (for tests) */
  size(): number;
}

export function createHistoryEntries(target: HistoryTarget): HistoryEntries {
  const stack: Entry[] = [];
  let nextId = 1;
  // history.back() calls of our own whose popstate must not close anything
  let ownBackCalls = 0;
  let listening = false;

  const currentEntryId = (): number | undefined => {
    const state = target.history.state as Record<string, unknown> | null;
    const id = state?.[HISTORY_ENTRY_KEY];
    return typeof id === 'number' ? id : undefined;
  };

  const pushEntry = (entry: Entry) => {
    if (!listening) {
      target.addEventListener('popstate', onPopState);
      listening = true;
    }
    target.history.pushState({ [HISTORY_ENTRY_KEY]: entry.id }, '');
    stack.push(entry);
  };

  function onPopState() {
    if (ownBackCalls > 0) {
      ownBackCalls--;
      return;
    }
    const top = stack[stack.length - 1];
    // Forward onto an entry, or a traversal that left the top entry where it was
    if (!top || currentEntryId() === top.id) return;
    stack.pop();
    if (top.onBack() === false) pushEntry(top);
  }

  return {
    push(onBack) {
      const entry = { id: nextId++, onBack };
      pushEntry(entry);
      return entry.id;
    },
    release(id) {
      const index = stack.findIndex((e) => e.id === id);
      // Already consumed by Back
      if (index === -1) return;
      stack.splice(index, 1);
      // Only step back over our own entry: after a navigation to another page the current entry
      // belongs to that page
      if (currentEntryId() === id) {
        ownBackCalls++;
        target.history.back();
      }
    },
    goBack(id) {
      const index = stack.findIndex((e) => e.id === id);
      if (index === -1) return;
      if (index === stack.length - 1 && currentEntryId() === id) {
        target.history.back();
        return;
      }
      // Not on top of the history (anymore): run it directly
      const [entry] = stack.splice(index, 1);
      entry.onBack();
    },
    replaceUrl(url) {
      // Keeps the marker of an open entry (a plain replaceState(null) would drop it)
      const id = currentEntryId();
      target.history.replaceState(id === undefined ? null : { [HISTORY_ENTRY_KEY]: id }, '', url);
    },
    size: () => stack.length,
  };
}

let browserEntries: HistoryEntries | null = null;

/** The page-wide instance; null during server rendering. */
export function getHistoryEntries(): HistoryEntries | null {
  if (typeof window === 'undefined') return null;
  browserEntries ??= createHistoryEntries(window);
  return browserEntries;
}

/** URL updates (filters, view) that must not drop the history entry of an open overlay. */
export function replaceUrlKeepingHistoryEntry(url: string): void {
  getHistoryEntries()?.replaceUrl(url);
}
