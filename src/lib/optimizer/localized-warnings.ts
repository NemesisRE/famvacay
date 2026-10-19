import { SeasonalConstraintWarning } from './weather';
import { TranslationDictionary } from '../i18n/types';

export function getLocalizedSeasonalWarning(
  warning: SeasonalConstraintWarning,
  t: TranslationDictionary
): { title: string; description: string } {
  switch (warning.seasonType) {
    case 'MONSOON':
      return {
        title: t.home.seasonWarningMonsoonTitle,
        description: t.home.seasonWarningMonsoonDesc,
      };
    case 'EXTREME_HEAT':
      return {
        title: t.home.seasonWarningExtremeHeatTitle,
        description: t.home.seasonWarningExtremeHeatDesc,
      };
    case 'TYPHOON_HURRICANE':
      return {
        title: t.home.seasonWarningHurricaneTitle,
        description: t.home.seasonWarningHurricaneDesc,
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
        }
      }

      return {
        title: eventTitle
          ? `${t.home.seasonWarningCrowdedPeakTitle}: ${eventTitle}`
          : t.home.seasonWarningCrowdedPeakTitle,
        description: warning.eventKey
          ? t.home.seasonWarningCrowdedPeakDesc
          : (warning.fallbackMessage || t.home.seasonWarningCrowdedPeakDesc),
      };
    }
    case 'NATURAL_PHENOMENON': {
      switch (warning.phenomenonType) {
        case 'SARGASSUM':
          return {
            title: t.home.seasonWarningSargassumTitle || 'Sargassum Seaweed Bloom',
            description: t.home.seasonWarningSargassumDesc || warning.fallbackMessage,
          };
        case 'RED_TIDE':
          return {
            title: t.home.seasonWarningRedTideTitle || 'Red Tide / Algal Bloom',
            description: t.home.seasonWarningRedTideDesc || warning.fallbackMessage,
          };
        case 'JELLYFISH':
          return {
            title: t.home.seasonWarningJellyfishTitle || 'Marine Stinger / Jellyfish Swarms',
            description: t.home.seasonWarningJellyfishDesc || warning.fallbackMessage,
          };
        case 'MIDGE_SANDFLY':
          return {
            title: t.home.seasonWarningMidgeTitle || 'Midge & Sandfly Outbreak',
            description: t.home.seasonWarningMidgeDesc || warning.fallbackMessage,
          };
        case 'CICADA':
          return {
            title: t.home.seasonWarningCicadaTitle || 'Periodical Cicada Emergence',
            description: t.home.seasonWarningCicadaDesc || warning.fallbackMessage,
          };
        case 'VOLCANIC_VOG':
          return {
            title: t.home.seasonWarningVogTitle || 'Volcanic Activity & Vog Advisory',
            description: t.home.seasonWarningVogDesc || warning.fallbackMessage,
          };
        default:
          return {
            title: t.home.seasonWarningNaturalPhenomenonTitle || 'Natural Phenomenon',
            description: warning.fallbackMessage,
          };
      }
    }
    default:
      return {
        title: warning.seasonType,
        description: warning.fallbackMessage || t.home.seasonWarningCrowdedPeakDesc,
      };
  }
}

