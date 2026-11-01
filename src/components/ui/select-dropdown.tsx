'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useHistoryBack } from '@/lib/navigation/use-history-back';
import { foldForSearch } from '@/lib/text/search-fold';
import { isImeComposing } from '@/components/ui/combobox';

export interface SelectDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Small pill on the right, e.g. a result count */
  hint?: string | number;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectDropdownOption[];
  /** Icon in front of the label */
  icon?: React.ReactNode;
  /** Teal "active filter" look (the value differs from the neutral one) */
  highlighted?: boolean;
  /** 'compact' for filter rows (like the destination filter), 'form' for form fields, 'form-sm' for dense rows */
  variant?: 'compact' | 'form' | 'form-sm';
  /** Heading inside the menu */
  menuTitle?: string;
  /** Search box in the menu; defaults to on for long lists */
  searchable?: boolean;
  disabled?: boolean;
  id?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Single-select dropdown in the style of the destination filter: rounded trigger with chevron,
 * floating menu with check marks and optional search, centered overlay on phones. Replaces the
 * native <select> elements so every dropdown looks and behaves the same.
 */
export function SelectDropdown({
  value,
  onChange,
  options,
  icon,
  highlighted = false,
  variant = 'compact',
  menuTitle,
  searchable,
  disabled = false,
  id,
  title,
  ariaLabel,
  className = '',
}: SelectDropdownProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The Back button closes it instead of leaving the page
  useHistoryBack(isOpen, () => setIsOpen(false));
  const [query, setQuery] = useState('');
  const isSmallScreen = useIsSmallScreen();
  const listRef = useRef<HTMLDivElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (!open) setQuery('');
    },
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
      // At least as wide as the trigger; height limited to the space available on screen
      size({
        padding: 12,
        apply({ rects, elements, availableHeight }) {
          elements.floating.style.minWidth = `${Math.max(rects.reference.width, 224)}px`;
          elements.floating.style.setProperty('--menu-available-height', `${Math.max(160, availableHeight)}px`);
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });
  const dismiss = useDismiss(context, POPOVER_DISMISS_OPTIONS);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 12;
  const visibleOptions = useMemo(() => {
    // Umlauts and accents optional ("Baden-Wurttemberg" finds Baden-Württemberg)
    const q = foldForSearch(query);
    return q ? options.filter((o) => foldForSearch(o.label).includes(q)) : options;
  }, [options, query]);

  // Focus the selected option when opening (keyboard users continue with the arrow keys).
  // preventScroll: true - the floating menu hasn't been positioned by floating-ui yet on this
  // first frame, so a native focus-triggered scroll-into-view would jump to wherever the
  // unpositioned element happens to sit (observed as the whole page jumping to scrollY 0).
  useEffect(() => {
    if (!isOpen || showSearch) return;
    const frame = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ||
        listRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
      el?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, showSearch]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Same preventScroll reasoning as above, for the searchable-menu case (native autoFocus does
  // not support preventScroll, so this focuses manually once the menu has mounted).
  useEffect(() => {
    if (!isOpen || !showSearch) return;
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, showSearch]);

  const choose = (option: SelectDropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setQuery('');
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? Math.min(buttons.length - 1, current + 1) : Math.max(0, current - 1);
    buttons[next]?.focus();
  };

  const isForm = variant !== 'compact';
  const triggerSize =
    variant === 'form'
      ? 'w-full px-3 py-2 rounded-lg font-medium'
      : variant === 'form-sm'
      ? 'w-full px-2 py-1 rounded-lg font-medium'
      : 'w-full sm:w-64 px-3 py-1.5 rounded-xl font-semibold';
  const triggerTone = highlighted
    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold hover:bg-teal-100/70 dark:hover:bg-teal-900/40'
    : isForm
    ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-600'
    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600';

  return (
    <div className={`relative ${isForm ? 'block' : 'block flex-1 min-w-0 sm:flex-none sm:inline-block'} ${className}`}>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        id={id}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${triggerSize} ${triggerTone} border text-xs flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="flex items-center gap-2 truncate min-w-0">
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <span className="truncate" suppressHydrationWarning>{selected?.label ?? value}</span>
          {selected?.hint !== undefined && (
            <span className="text-[10px] font-medium opacity-70 shrink-0">({selected.hint})</span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={99998} />
          <div
            ref={refs.setFloating}
            style={{
              ...getResponsivePopoverStyle(isSmallScreen, floatingStyles, 99999),
              // Only the option list scrolls; header and search stay in place
              maxHeight: isSmallScreen ? '85vh' : 'min(var(--menu-available-height, 24rem), 24rem)',
              overflowY: 'hidden',
            }}
            {...getFloatingProps()}
            className="w-72 max-w-[calc(100vw-24px)] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {menuTitle && (
              <div className="shrink-0 pb-1.5 px-1 border-b border-slate-100 dark:border-slate-800 mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {menuTitle}
              </div>
            )}

            {showSearch && (
              <div className="relative mb-2 px-0.5 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (isImeComposing(e)) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const first = visibleOptions.find((o) => !o.disabled);
                      if (first) choose(first);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      listRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
                    }
                  }}
                  placeholder={t.common.search}
                  className="w-full text-base sm:text-xs rounded-lg pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-teal-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t.common.close}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 -mx-1 px-1" onKeyDown={onListKeyDown}>
              {visibleOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => choose(option)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      option.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-500 dark:text-slate-500'
                        : isSelected
                        ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-semibold cursor-pointer'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 cursor-pointer'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-3.5 shrink-0">
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 stroke-3" />}
                      </span>
                      <span className="truncate" title={option.label}>{option.label}</span>
                    </span>
                    {option.hint !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          isSelected
                            ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {option.hint}
                      </span>
                    )}
                  </button>
                );
              })}
              {visibleOptions.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500">—</p>
              )}
            </div>

            {/* Long, searchable lists: a clear way out, like the destination filter */}
            {showSearch && (
              <div className="shrink-0 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {t.common.done}
                </button>
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
