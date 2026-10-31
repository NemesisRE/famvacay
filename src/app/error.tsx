'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * React's removeChild / insertBefore failures: something outside React (browser translation
 * wrapping text in <font>, an extension) changed nodes React still manages. Retrying renders into
 * the same corrupted DOM, so only a reload helps.
 */
function isForeignDomMutation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'NotFoundError' || /removeChild|insertBefore|not a child of this node/i.test(error.message);
}

/**
 * Error boundary of the page content: the header, language menu and footer stay usable, and the
 * page can be retried or reloaded instead of turning into a white screen.
 */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useI18n();
  const domMutation = isForeignDomMutation(error);

  useEffect(() => {
    console.error('[page] render error:', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="max-w-lg mx-auto my-12 p-6 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 space-y-4"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <h1 className="text-lg font-bold">{t.errorPage.title}</h1>
      </div>
      <p className="text-sm">{t.errorPage.body}</p>
      {domMutation && <p className="text-sm">{t.errorPage.domHint}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        {!domMutation && (
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.errorPage.retry}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer ${
            domMutation
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t.errorPage.reload}</span>
        </button>
      </div>
    </div>
  );
}
