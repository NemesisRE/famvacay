'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Pieces of the tag-input combobox used by the destination and airport selectors: the chips and
 * the search input share one field, a click anywhere in it starts typing, and the result list is
 * a listbox driven by the keyboard (ArrowUp/ArrowDown, Enter, Escape).
 */

interface ComboboxNavigationOptions {
  /** Number of options currently shown */
  count: number;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Enter on a highlighted option */
  onSelectIndex: (index: number) => void;
  /** Enter without a highlighted option (e.g. take the typed text) */
  onEnter?: () => void;
  /** Backspace in an empty input (e.g. remove the last chip) */
  onBackspaceEmpty?: () => void;
}

export function useComboboxNavigation({
  count,
  isOpen,
  onOpen,
  onClose,
  onSelectIndex,
  onEnter,
  onBackspaceEmpty,
}: ComboboxNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(-1);
  // A new result list (or a closed one) starts without a highlighted option
  const [trackedCount, setTrackedCount] = useState(count);
  const [trackedOpen, setTrackedOpen] = useState(isOpen);
  if (count !== trackedCount || isOpen !== trackedOpen) {
    setTrackedCount(count);
    setTrackedOpen(isOpen);
    setActiveIndex(-1);
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) onOpen();
        else if (count > 0) setActiveIndex((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen && count > 0) setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && activeIndex >= 0 && activeIndex < count) onSelectIndex(activeIndex);
        else onEnter?.();
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          onClose();
        }
        break;
      case 'Backspace':
        if (e.currentTarget.value === '') onBackspaceEmpty?.();
        break;
    }
  };

  return { activeIndex, setActiveIndex, onKeyDown };
}

/** Ids tying the input to its listbox and the highlighted option (aria-activedescendant) */
export function comboboxIds(base: string) {
  return {
    listbox: `${base}-listbox`,
    option: (index: number) => `${base}-option-${index}`,
  };
}

/**
 * The bordered field holding the chips and the input; a click anywhere on it (not on a chip's own
 * button) focuses the input, so the field is the search bar.
 */
export function ComboboxField({
  inputRef,
  children,
  invalid = false,
  className = '',
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  children: React.ReactNode;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) inputRef.current?.focus();
      }}
      className={`flex flex-wrap items-center gap-1.5 min-h-[42px] p-1.5 rounded-xl border bg-white dark:bg-slate-800 cursor-text transition focus-within:ring-2 ${
        invalid
          ? 'border-amber-400 focus-within:ring-amber-500'
          : 'border-slate-300 dark:border-slate-700 focus-within:ring-teal-500 focus-within:border-transparent'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** "Flexible" state of a selector (no destination / no airport chosen): the same chip everywhere */
export function FlexibleChip({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title}
      className="text-xs text-teal-700 dark:text-teal-300 font-medium inline-flex items-center gap-1.5 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 shrink-0"
    >
      <Sparkles className="w-3 h-3 text-teal-500" />
      <span>{label}</span>
    </span>
  );
}

/** "Back to flexible" link next to a selector's label (shown once something is chosen) */
export function FlexibleResetLink({ label, onClick, title }: { label: string; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer">
      {label}
    </button>
  );
}

/** Input class for the field: 16 px on phones (no zoom on focus in iOS), compact from sm up */
export const COMBOBOX_INPUT_CLASS =
  'flex-1 min-w-0 bg-transparent border-0 p-1 text-base sm:text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden';

/**
 * Wrapper of icon + input + clear button: wide enough for the placeholder in every language
 * ("Rechercher un aéroport…" at 16 px), otherwise it wraps below the chips instead of being cut.
 */
export const COMBOBOX_INPUT_WRAP_CLASS = 'flex items-center gap-1.5 flex-1 min-w-[min(100%,15rem)] sm:min-w-[min(100%,11rem)]';
