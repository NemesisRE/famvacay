'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { useI18n } from '@/lib/i18n/i18n-context';

export interface ResultsPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (size: number) => void;
}

const navButtonClass =
  'px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer';

export function ResultsPagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: ResultsPaginationProps) {
  const { t } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span>{t.home.resultsPerPage}:</span>
        <SelectDropdown
          variant="form-sm"
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          className="w-16"
          options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
        />
        <span className="text-slate-400 dark:text-slate-500 ml-2">
          {t.home.page} {page} {t.home.of} {totalPages}
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className={navButtonClass}>
            <ChevronLeft className="w-3.5 h-3.5" />
            {t.home.prevPage}
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            if (totalPages > 5 && page > 3) {
              pageNum = page - 3 + i;
              if (pageNum > totalPages) pageNum = totalPages - (4 - i);
            }
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                  page === pageNum
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className={navButtonClass}
          >
            {t.home.nextPage}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
