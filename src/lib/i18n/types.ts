export type SupportedLocale = 'en' | 'de' | 'fr' | 'es' | 'it';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const SUPPORTED_LOCALES: { code: SupportedLocale; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: 'EN' },
  { code: 'de', name: 'Deutsch', flag: 'DE' },
  { code: 'fr', name: 'Français', flag: 'FR' },
  { code: 'es', name: 'Español', flag: 'ES' },
  { code: 'it', name: 'Italiano', flag: 'IT' },
];

export interface TranslationDictionary {
  nav: {
    familyProfile: string;
    signIn: string;
    signOut: string;
  };
  home: {
    heroBadge: string;
    heroTitle: string;
    heroDescription: string;
    constraintsTitle: string;
    countryLabel: string;
    homeStateLabel: string;
    airportsLabel: string;
    airportsHint: string;
    childrenAgesLabel: string;
    childrenAgesHint: string;
    tripTypeLabel: string;
    beach: string;
    city: string;
    nature: string;
    ski: string;
    targetDestinationLabel: string;
    allDestinations: string;
    durationLabel: string;
    durationMinLabel: string;
    durationMaxLabel: string;
    earliestDateLabel: string;
    latestDateLabel: string;
    blackoutFilterTitle: string;
    addBlackout: string;
    removeBlackout: string;
    noBlackouts: string;
    blackoutStart: string;
    blackoutEnd: string;
    prefilledFromProfile: string;
    runOptimization: string;
    optimizing: string;
    resultsTitle: string;
    windowsFound: string;
    readyTitle: string;
    readyDescription: string;
    noResultsTitle: string;
    noResultsHint: string;
    arbitrageBadge: string;
    arbitrageSaving: string;
    seasonalWarningBadge: string;
    days: string;
    ptoConsumed: string;
    ptoSaved: string;
    ptoRatio: string;
    score: string;
    cachedBenchmark: string;
    estFamilyCost: string;
    perPerson: string;
  };
  profile: {
    title: string;
    subtitle: string;
    membersBadge: string;
    sec1Title: string;
    familyName: string;
    homeLocation: string;
    country: string;
    federalState: string;
    sec2Title: string;
    maxDrive: string;
    cabinClass: string;
    economy: string;
    premiumEconomy: string;
    business: string;
    climatePref: string;
    warm: string;
    moderate: string;
    cool: string;
    passportCheck: string;
    travelModesLabel: string;
    travelModesHint: string;
    modeCar: string;
    modeTrain: string;
    modeFlight: string;
    modeCamper: string;
    blackoutDatesTitle: string;
    blackoutDatesDesc: string;
    addBlackout: string;
    removeBlackout: string;
    noBlackouts: string;
    sec3Title: string;
    addMember: string;
    name: string;
    role: string;
    parent: string;
    child: string;
    infant: string;
    other: string;
    birthDate: string;
    passportExpiry: string;
    saveProfile: string;
    saving: string;
    successSaved: string;
  };
  auth: {
    welcome: string;
    createAccount: string;
    welcomeSubtitle: string;
    createSubtitle: string;
    continueGoogle: string;
    continueApple: string;
    orCredentials: string;
    fullName: string;
    email: string;
    password: string;
    signInBtn: string;
    createBtn: string;
    passkeyBtn: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    signingIn: string;
  };
  common: {
    footer: string;
  };
}

