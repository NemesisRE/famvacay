'use client';

import { useEffect, useState } from 'react';
import { Check, Palmtree, Sparkles, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

export type BackgroundSearchState =
  | { status: 'idle' }
  | { status: 'running' }
  /** More destinations found, held back until the user chooses to show them */
  | { status: 'ready'; added: number }
  | { status: 'done'; added: number };

const MESSAGE_INTERVAL_MS = 2600;
const DONE_BANNER_MS = 8000;

/** One of the playful loading lines, changing every few seconds in a shuffled order */
function useRotatingMessage(messages: string[]): string {
  const [order] = useState(() => {
    const indexes = messages.map((_, i) => i);
    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    return indexes;
  });
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => s + 1), MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return messages[order[step % order.length]] ?? '';
}

/** Shown in the results column while the first results are being computed */
export function SearchLoadingPanel() {
  const { t } = useI18n();
  const message = useRotatingMessage(t.searchProgress.messages);
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4"
    >
      <div className="relative w-14 h-14 mx-auto">
        <span className="absolute inset-0 rounded-full border-4 border-teal-100 dark:border-teal-900/60 border-t-teal-500 dark:border-t-teal-400 animate-spin" />
        <Palmtree className="absolute inset-0 m-auto w-6 h-6 text-teal-600 dark:text-teal-400" aria-hidden="true" />
      </div>
      <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-base">{t.searchProgress.loadingTitle}</h3>
      <p key={message} className="text-sm text-teal-700 dark:text-teal-300 italic min-h-5 animate-in fade-in duration-500">
        {message}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{t.searchProgress.loadingHint}</p>
    </div>
  );
}

/** Slim banner above the results while more destinations are searched, and when they arrive */
export function BackgroundSearchBanner({
  state,
  onDismiss,
  onApply,
}: {
  state: BackgroundSearchState;
  onDismiss: () => void;
  onApply: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (state.status !== 'done') return;
    const timer = setTimeout(onDismiss, DONE_BANNER_MS);
    return () => clearTimeout(timer);
  }, [state, onDismiss]);

  if (state.status === 'idle') return null;

  if (state.status === 'running') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 text-xs text-teal-900 dark:text-teal-200"
      >
        <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-teal-300 dark:border-teal-700 border-t-teal-600 dark:border-t-teal-300 animate-spin" />
        <span className="font-semibold">{t.searchProgress.backgroundRunning}</span>
      </div>
    );
  }

  if (state.status === 'ready') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 text-xs font-semibold text-teal-900 dark:text-teal-200"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 min-w-0">{t.searchProgress.backgroundReady.replace('{count}', String(state.added))}</span>
        <button
          type="button"
          onClick={onApply}
          className="shrink-0 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
        >
          {t.searchProgress.backgroundShow}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.common.close}
          title={t.common.close}
          className="shrink-0 p-1 rounded-lg text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs font-semibold text-emerald-900 dark:text-emerald-200"
    >
      {state.added > 0 ? <Sparkles className="w-3.5 h-3.5 shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
      {state.added > 0
        ? t.searchProgress.backgroundDone.replace('{count}', String(state.added))
        : t.searchProgress.backgroundDoneNone}
    </div>
  );
}
