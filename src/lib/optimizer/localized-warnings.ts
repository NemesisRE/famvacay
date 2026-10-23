import { SeasonalConstraintWarning } from './weather';
import { TranslationDictionary } from '../i18n/types';
import { HIGH_DEMAND_THRESHOLD } from '../holidays/source-markets';

/** "Germany, Netherlands, France +2" in the interface language */
export function formatMarketList(countries: string[], locale: string = 'en'): string {
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = undefined;
  }
  const label = (c: string) => names?.of(c) || c;
  const shown = countries.slice(0, 3).map(label).join(', ');
  return countries.length > 3 ? `${shown} +${countries.length - 3}` : shown;
}

export function buildSchoolHolidaySeasonalWarning(
  destinationCode: string,
  startDate: string,
  marketsOnHoliday: string[]
): SeasonalConstraintWarning {
  const monthIndex = Math.max(0, (parseInt(startDate.slice(5, 7), 10) || 1) - 1);
  return {
    destinationCode,
    seasonType: 'OVERCROWDED_PEAK',
    monthRange: [monthIndex],
    messageKey: 'seasonWarningCrowdedPeak',
    fallbackMessage: `School holidays in ${marketsOnHoliday.join(', ')}: High travel demand, crowded destinations, and elevated rates.`,
    eventKey: 'school_holidays',
    marketsOnHoliday,
  };
}

/**
 * Returns all active seasonal warnings to display for a candidate window, ensuring high
 * European school-holiday demand (`sourceMarketDemand.index >= 0.45`) always renders its own
 * crowded-season warning box (including for windows hydrated from cached/shared searches or
 * windows that also have a separate weather/event warning).
 */
export function getWindowSeasonalWarnings(win: {
  destinationAirport: string;
  startDate: string;
  seasonalWarning?: SeasonalConstraintWarning | null;
  sourceMarketDemand?: { index: number; marketsOnHoliday: string[] };
}): SeasonalConstraintWarning[] {
  const warnings: SeasonalConstraintWarning[] = [];
  const hasHighDemand = Boolean(
    win.sourceMarketDemand &&
      win.sourceMarketDemand.index >= HIGH_DEMAND_THRESHOLD &&
      win.sourceMarketDemand.marketsOnHoliday.length > 0
  );

  if (win.seasonalWarning) {
    if (win.seasonalWarning.eventKey === 'school_holidays') {
      warnings.push(win.seasonalWarning);
      return warnings;
    }
    if (win.seasonalWarning.seasonType === 'EXTREME_HEAT' && hasHighDemand) {
      const { marketsOnHoliday: _ignored, ...cleanHeatWarning } = win.seasonalWarning;
      warnings.push(cleanHeatWarning);
      warnings.push(
        buildSchoolHolidaySeasonalWarning(
          win.destinationAirport,
          win.startDate,
          win.sourceMarketDemand!.marketsOnHoliday
        )
      );
      return warnings;
    }
    warnings.push(win.seasonalWarning);
    return warnings;
  }

  if (hasHighDemand) {
    warnings.push(
      buildSchoolHolidaySeasonalWarning(
        win.destinationAirport,
        win.startDate,
        win.sourceMarketDemand!.marketsOnHoliday
      )
    );
  }

  return warnings;
}

/**
 * Returns the primary non-heat seasonal warning controlled by the Seasonal Warnings filter
 * (Extreme Summer Heat has its own dedicated filter).
 */
export function getWindowFilterWarning(win: {
  destinationAirport: string;
  startDate: string;
  seasonalWarning?: SeasonalConstraintWarning | null;
  sourceMarketDemand?: { index: number; marketsOnHoliday: string[] };
}): SeasonalConstraintWarning | null {
  return getWindowSeasonalWarnings(win).find((w) => w.seasonType !== 'EXTREME_HEAT') || null;
}

/**
 * Stable identifier for a seasonal warning category/event so users can selectively filter
 * or include individual warning types.
 */
export function getSeasonalWarningTypeKey(warning: SeasonalConstraintWarning): string {
  switch (warning.seasonType) {
    case 'OVERCROWDED_PEAK':
      return warning.eventKey ? `OVERCROWDED_PEAK:${warning.eventKey}` : 'OVERCROWDED_PEAK';
    case 'NATURAL_PHENOMENON':
      return warning.phenomenonType ? `NATURAL_PHENOMENON:${warning.phenomenonType}` : 'NATURAL_PHENOMENON';
    default:
      return warning.seasonType;
  }
}

/**
 * Localized label for a seasonal warning type in the filter dropdown and Windows Found popover.
 */
export function getLocalizedSeasonalWarningTypeLabel(
  warning: SeasonalConstraintWarning,
  t: TranslationDictionary,
  locale: string = 'en'
): string {
  if (warning.seasonType === 'OVERCROWDED_PEAK' && warning.eventKey === 'school_holidays') {
    return `${t.home.seasonWarningCrowdedPeakTitle}: ${t.home.demandPriceLabel}`;
  }
  const { marketsOnHoliday: _ignored, ...cleanWarning } = warning;
  return getLocalizedSeasonalWarning(cleanWarning, t, locale).title;
}

export function getLocalizedSeasonalWarning(
  warning: SeasonalConstraintWarning,
  t: TranslationDictionary,
  locale: string = 'en'
): { title: string; description: string } {
  const marketsNote =
    warning.marketsOnHoliday && warning.marketsOnHoliday.length > 0
      ? t.home.demandHighBadge.replace('{markets}', formatMarketList(warning.marketsOnHoliday, locale))
      : undefined;
  const withMarkets = (desc: string) => (marketsNote ? `${desc} (${marketsNote})` : desc);

  switch (warning.seasonType) {
    case 'MONSOON':
      return {
        title: t.home.seasonWarningMonsoonTitle,
        description: withMarkets(t.home.seasonWarningMonsoonDesc),
      };
    case 'EXTREME_HEAT':
      return {
        title: t.home.seasonWarningExtremeHeatTitle,
        description: withMarkets(t.home.seasonWarningExtremeHeatDesc),
      };
    case 'TYPHOON_HURRICANE':
      return {
        title: t.home.seasonWarningHurricaneTitle,
        description: withMarkets(t.home.seasonWarningHurricaneDesc),
      };
    case 'OVERCROWDED_PEAK': {
      let eventTitle = warning.eventName;
      if (warning.eventKey) {
        switch (warning.eventKey) {
          case 'easter':
            eventTitle = t.home.seasonEventEaster;
            break;
          case 'spring_break_easter':
            eventTitle = t.home.seasonEventSpringBreakEaster;
            break;
          case 'carnival':
            eventTitle = t.home.seasonEventCarnival;
            break;
          case 'golden_week':
            eventTitle = t.home.seasonEventGoldenWeek;
            break;
          case 'oktoberfest':
            eventTitle = t.home.seasonEventOktoberfest;
            break;
          case 'christmas_new_year':
            eventTitle = t.home.seasonEventChristmasNewYear;
            break;
          case 'lunar_new_year':
            eventTitle = t.home.seasonEventLunarNewYear;
            break;
          case 'songkran':
            eventTitle = t.home.seasonEventSongkran;
            break;
          case 'school_holidays':
            eventTitle = marketsNote;
            break;
        }
      }

      const baseDesc =
        warning.eventKey === 'school_holidays'
          ? `${t.home.seasonWarningCrowdedPeakDesc} ${t.home.demandTitle}`
          : warning.eventKey
          ? withMarkets(t.home.seasonWarningCrowdedPeakDesc)
          : withMarkets(warning.fallbackMessage || t.home.seasonWarningCrowdedPeakDesc);

      return {
        title: eventTitle
          ? `${t.home.seasonWarningCrowdedPeakTitle}: ${eventTitle}`
          : t.home.seasonWarningCrowdedPeakTitle,
        description: baseDesc,
      };
    }
    case 'NATURAL_PHENOMENON': {
      switch (warning.phenomenonType) {
        case 'SARGASSUM':
          return {
            title: t.home.seasonWarningSargassumTitle || 'Sargassum Seaweed Bloom',
            description: withMarkets(t.home.seasonWarningSargassumDesc || warning.fallbackMessage),
          };
        case 'RED_TIDE':
          return {
            title: t.home.seasonWarningRedTideTitle || 'Red Tide / Algal Bloom',
            description: withMarkets(t.home.seasonWarningRedTideDesc || warning.fallbackMessage),
          };
        case 'JELLYFISH':
          return {
            title: t.home.seasonWarningJellyfishTitle || 'Marine Stinger / Jellyfish Swarms',
            description: withMarkets(t.home.seasonWarningJellyfishDesc || warning.fallbackMessage),
          };
        case 'MIDGE_SANDFLY':
          return {
            title: t.home.seasonWarningMidgeTitle || 'Midge & Sandfly Outbreak',
            description: withMarkets(t.home.seasonWarningMidgeDesc || warning.fallbackMessage),
          };
        case 'CICADA':
          return {
            title: t.home.seasonWarningCicadaTitle || 'Periodical Cicada Emergence',
            description: withMarkets(t.home.seasonWarningCicadaDesc || warning.fallbackMessage),
          };
        case 'VOLCANIC_VOG':
          return {
            title: t.home.seasonWarningVogTitle || 'Volcanic Activity & Vog Advisory',
            description: withMarkets(t.home.seasonWarningVogDesc || warning.fallbackMessage),
          };
        default:
          return {
            title: t.home.seasonWarningNaturalPhenomenonTitle || 'Natural Phenomenon',
            description: withMarkets(warning.fallbackMessage),
          };
      }
    }
    default:
      return {
        title: warning.seasonType,
        description: withMarkets(warning.fallbackMessage || t.home.seasonWarningCrowdedPeakDesc),
      };
  }
}

