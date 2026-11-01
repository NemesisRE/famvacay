'use client';

import { useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { useIsSmallScreen, getResponsivePopoverStyle, PopoverBackdrop, viewportFit, POPOVER_DISMISS_OPTIONS } from '@/components/ui/responsive-popover';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  X,
  Shield,
  Info,
  ExternalLink,
} from 'lucide-react';
import { DestinationSafetyAssessment } from '@/lib/safety/safety-service';
import { getAdvisorySourceUrls } from '@/lib/safety/advisory-store';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useHistoryBack } from '@/lib/navigation/use-history-back';

interface DestinationSafetyPopoverProps {
  safety?: DestinationSafetyAssessment;
  destinationName?: string;
  countryName?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Translated safety texts from the structured assessment fields (the source titles are English /
 * German only). Shared by the safety popover and the score breakdown.
 */
export function getSafetyTexts(
  safety: DestinationSafetyAssessment,
  t: ReturnType<typeof useI18n>['t']
): { badgeLabel: string; usLevelText: string } {
  const isSafe = safety.isSafe ?? safety.isSafeForFamilies ?? true;
  const level = safety.advisoryLevel || safety.usStateDeptLevel || 1;
  const usLevelText = [t.home.safetyUsLevel1, t.home.safetyUsLevel2, t.home.safetyUsLevel3, t.home.safetyUsLevel4][level - 1];
  const badgeLabel = isSafe
    ? t.home.safeDestinationBadge
    : safety.level === 'CAUTION'
    ? t.home.safetyBadgeCaution
    : safety.level === 'WARNING'
    ? t.home.safetyStatusWarning
    : t.home.safetyBadgeDanger;
  return { badgeLabel, usLevelText };
}

function SourceLink({ href, label }: { href?: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline"
    >
      {label}
      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

export function DestinationSafetyPopover({
  safety,
  destinationName,
  countryName,
  className = '',
  compact = false,
}: DestinationSafetyPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  // The Back button closes it instead of leaving the page
  useHistoryBack(isOpen, () => setIsOpen(false));

  const isSmallScreen = useIsSmallScreen();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip({ fallbackAxisSideDirection: 'end', padding: 12 }),
      shift({ padding: 12 }),
      viewportFit(),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start',
  });

  const dismiss = useDismiss(context, POPOVER_DISMISS_OPTIONS);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  if (!safety) return null;

  const isSafe = safety.isSafe ?? safety.isSafeForFamilies ?? true;
  const advisoryLevel = safety.advisoryLevel || safety.usStateDeptLevel || 1;
  const score = Math.round(safety.score || (isSafe ? 90 : 35));

  // Colour tones (light + dark mode) shared by the badge and the status chips
  const TONE = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    orange: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    rose: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  };

  // Badge styling based on safety level
  const badgeStyle = isSafe
    ? `${TONE.green} hover:bg-emerald-100 dark:hover:bg-emerald-900/40`
    : safety.level === 'WARNING'
    ? `${TONE.amber} hover:bg-amber-100 dark:hover:bg-amber-900/40`
    : `${TONE.rose} hover:bg-rose-100 dark:hover:bg-rose-900/40`;

  const { badgeLabel, usLevelText } = getSafetyTexts(safety, t);

  const scoreBadgeBg = score >= 75 ? TONE.green : score >= 50 ? TONE.amber : TONE.rose;

  // Determine US State Dept Level color
  const usLevelBg = advisoryLevel === 1 ? TONE.green : advisoryLevel === 2 ? TONE.amber : advisoryLevel === 3 ? TONE.orange : TONE.rose;

  // German AA Status
  const germanStatus = safety.hasGermanWarning
    ? { text: t.home.safetyGermanFullWarning, chip: t.home.safetyAaStatusFull, color: TONE.rose }
    : safety.hasGermanPartialWarning
    ? { text: t.home.safetyGermanPartialWarning, chip: t.home.safetyAaStatusPartial, color: TONE.amber }
    : { text: t.home.safetyGermanNoWarning, chip: t.home.safetyAaStatusNone, color: TONE.green };

  const displayName = destinationName || countryName || safety.countryName || '';
  // Results saved before the links existed have no URLs: fall back to the providers' overviews
  const sourceUrls = {
    ...getAdvisorySourceUrls(),
    ...(safety.germanAdvisoryUrl && { germanAdvisoryUrl: safety.germanAdvisoryUrl }),
    ...(safety.usAdvisoryUrl && { usAdvisoryUrl: safety.usAdvisoryUrl }),
    ...(safety.caAdvisoryUrl && { caAdvisoryUrl: safety.caAdvisoryUrl }),
    ...(safety.auAdvisoryUrl && { auAdvisoryUrl: safety.auAdvisoryUrl }),
  };

  return (
    <div className={`inline-block ${className}`}>
      {/* Trigger Pill Badge */}
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold shadow-2xs cursor-pointer transition select-none ${badgeStyle}`}
        title={`${badgeLabel} — ${t.home.safetyShowDetails}`}
      >
        {isSafe ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : safety.level === 'WARNING' ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        )}
        <span className="truncate max-w-[200px] sm:max-w-[280px]">{badgeLabel}</span>
        <span className="opacity-60 group-hover:opacity-100 text-[10px] font-normal transition-opacity ml-0.5">
          ℹ
        </span>
      </button>

      {/* Floating Popout Modal */}
      {isOpen && (
        <FloatingPortal>
          <PopoverBackdrop show={isSmallScreen} zIndex={9998} />
          <div
            ref={refs.setFloating}
            style={getResponsivePopoverStyle(isSmallScreen, floatingStyles, 9999)}
            {...getFloatingProps()}
            onClick={(e) => e.stopPropagation()}
            className="z-50 w-[92vw] max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 focus:outline-hidden"
          >
            {/* Popout Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSafe ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isSafe ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                    {displayName}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {t.home.safetyPopoutSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${scoreBadgeBg}`}
                  title={`${t.home.safetyScoreLabel}: ${score} / 100`}
                >
                  {score}/100
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title={t.common.close}
                  aria-label={t.common.close}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contextual Travel Advisory Breakdown */}
            <div className="space-y-3">
              {/* 1. Auswärtiges Amt Status */}
              <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    {t.home.safetyGermanWarning}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${germanStatus.color}`}>
                    {germanStatus.chip}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  {germanStatus.text}
                </p>
                <SourceLink href={sourceUrls.germanAdvisoryUrl} label={t.home.safetyAaLink} />
              </div>

              {/* 2. US State Department Advisory */}
              <div className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    {t.home.safetyUsLevel}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${usLevelBg}`}>
                    {t.home.safetyUsLevelChip.replace('{level}', String(advisoryLevel))}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  {usLevelText}
                </p>
                <SourceLink href={sourceUrls.usAdvisoryUrl} label={t.home.safetyUsLink} />
              </div>

              {/* 3. Canada and Australia, only when they publish a rating for this country */}
              {([
                ['ca', safety.caAdvisoryLevel, safety.caAdvisoryTitle, t.home.safetyCaLevel, sourceUrls.caAdvisoryUrl, t.home.safetyCaLink],
                ['au', safety.auAdvisoryLevel, safety.auAdvisoryTitle, t.home.safetyAuLevel, sourceUrls.auAdvisoryUrl, t.home.safetyAuLink],
              ] as const).map(([key, level, title, label, href, linkLabel]) =>
                level ? (
                  <div key={key} className="bg-slate-50/80 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        {label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${level === 1 ? TONE.green : level === 2 ? TONE.amber : level === 3 ? TONE.orange : TONE.rose}`}>
                        {t.home.safetyUsLevelChip.replace('{level}', String(level))}
                      </span>
                    </div>
                    {title && <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{title}</p>}
                    <SourceLink href={href} label={linkLabel} />
                  </div>
                ) : null
              )}

              {/* 4. Specific Risks & Contextual Notes (if any) */}
              {safety.conflictZone && (
                <div className="bg-amber-50/80 dark:bg-amber-950/40 rounded-xl p-3 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 space-y-1">
                  <span className="text-[11px] font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    {t.home.safetySpecificRisks}
                  </span>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-medium">
                    {t.home.safetyConflictZone}
                  </p>
                </div>
              )}
            </div>

            {/* Footer with Source & Verification */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                <span>{t.home.safetyDataSource}</span>
              </span>
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

