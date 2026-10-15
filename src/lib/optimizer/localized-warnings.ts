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
    case 'OVERCROWDED_PEAK':
      return {
        title: warning.eventName
          ? `${t.home.seasonWarningCrowdedPeakTitle}: ${warning.eventName}`
          : t.home.seasonWarningCrowdedPeakTitle,
        description: warning.fallbackMessage || t.home.seasonWarningCrowdedPeakDesc,
      };
    default:
      return {
        title: warning.seasonType,
        description: warning.fallbackMessage,
      };
  }
}

