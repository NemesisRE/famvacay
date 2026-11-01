import { describe, it, expect, beforeAll } from 'vitest';
import {
  isDestinationSafeForVacation,
  getDestinationSafetyAssessment,
  refreshTravelAdvisories,
  parseCanadaAdvisories,
  parseSmartravellerAdvisories,
} from './safety-service';
import { getAdvisorySourceUrls, peakAdvisoryLevel } from './advisory-store';

describe('Destination Safety & Security Service (Auswärtiges Amt & US State Dept Live APIs)', () => {
  beforeAll(async () => {
    // Ingest official live data from Auswärtiges Amt & US State Department
    await refreshTravelAdvisories(true);
  }, 15000);

  it('identifies safe family vacation destinations with high scores (Level 1 / 2)', () => {
    // Mallorca / Spain
    expect(isDestinationSafeForVacation('PMI', 'ES')).toBe(true);
    const pmiAssessment = getDestinationSafetyAssessment('PMI', 'ES');
    expect(pmiAssessment.isSafe).toBe(true);
    expect(pmiAssessment.isSafeForFamilies).toBe(true);
    expect(pmiAssessment.countryCode).toBe('ES');
    expect(pmiAssessment.score).toBeGreaterThanOrEqual(75);
    expect(pmiAssessment.advisoryLevel).toBeLessThanOrEqual(2);
    expect(pmiAssessment.advisoryTitle).toBeDefined();

    // Austria / Alps
    expect(isDestinationSafeForVacation('INN', 'AT')).toBe(true);
    const innAssessment = getDestinationSafetyAssessment('INN', 'AT');
    expect(innAssessment.score).toBeGreaterThanOrEqual(90);

    // Japan / Tokyo
    expect(isDestinationSafeForVacation('HND', 'JP')).toBe(true);
    const hndAssessment = getDestinationSafetyAssessment('HND', 'JP');
    expect(hndAssessment.isSafeForFamilies).toBe(true);
    expect(hndAssessment.score).toBeGreaterThanOrEqual(75);

    // Portugal / Lisbon
    expect(isDestinationSafeForVacation('LIS', 'PT')).toBe(true);
    const lisAssessment = getDestinationSafetyAssessment('LIS', 'PT');
    expect(lisAssessment.isSafeForFamilies).toBe(true);
    expect(lisAssessment.score).toBeGreaterThanOrEqual(85);

    // Thailand (Phuket / Bangkok)
    expect(isDestinationSafeForVacation('BKK', 'TH')).toBe(true);
    const bkkAssessment = getDestinationSafetyAssessment('BKK', 'TH');
    expect(bkkAssessment.isSafeForFamilies).toBe(true);
    expect(bkkAssessment.advisoryLevel).toBeLessThanOrEqual(2);
  });

  it('correctly assesses countries with Level 3 Reconsider Travel (e.g. UAE)', () => {
    // UAE is designated Level 3: Reconsider Travel by US State Department
    expect(isDestinationSafeForVacation('DXB', 'AE')).toBe(false);
    const dxbAssessment = getDestinationSafetyAssessment('DXB', 'AE');
    expect(dxbAssessment.isSafeForFamilies).toBe(false);
    expect(dxbAssessment.advisoryLevel).toBe(3);
    expect(dxbAssessment.level).toBe('WARNING');
  });

  it('strictly rejects high-risk countries and active conflict zones from flex search', () => {
    // Ukraine
    expect(isDestinationSafeForVacation('KBP', 'UA')).toBe(false);
    expect(isDestinationSafeForVacation('ODS', 'Ukraine')).toBe(false);

    // Russia & Belarus
    expect(isDestinationSafeForVacation('SVO', 'RU')).toBe(false);
    expect(isDestinationSafeForVacation('LED', 'Russian Federation')).toBe(false);
    expect(isDestinationSafeForVacation('MSQ', 'BY')).toBe(false);

    // Syria & Yemen
    expect(isDestinationSafeForVacation('DAM', 'SY')).toBe(false);
    expect(isDestinationSafeForVacation('SAH', 'YE')).toBe(false);

    // Afghanistan & Iraq
    expect(isDestinationSafeForVacation('KBL', 'AF')).toBe(false);
    expect(isDestinationSafeForVacation('BGW', 'IQ')).toBe(false);

    // Somalia, Sudan, Libya, Haiti
    expect(isDestinationSafeForVacation('MGQ', 'SO')).toBe(false);
    expect(isDestinationSafeForVacation('KRT', 'SD')).toBe(false);
    expect(isDestinationSafeForVacation('TIP', 'LY')).toBe(false);
    expect(isDestinationSafeForVacation('PAP', 'HT')).toBe(false);

    // Lebanon
    expect(isDestinationSafeForVacation('BEY', 'LB')).toBe(false);

    const kbpAssessment = getDestinationSafetyAssessment('KBP', 'UA');
    expect(kbpAssessment.isSafeForFamilies).toBe(false);
    expect(kbpAssessment.level).toBe('DANGER');
    expect(kbpAssessment.advisoryLevel).toBe(4);
  });

  it('fetches and caches advisories from Auswärtiges Amt and US State Dept APIs', async () => {
    const { refreshTravelAdvisories } = await import('./safety-service');
    const cache = await refreshTravelAdvisories(true);
    expect(cache).toBeDefined();
    expect(cache.timestamp).toBeGreaterThan(0);
    expect(Object.keys(cache.entries).length).toBeGreaterThan(50);
    // Verified German Reisewarnung for Ukraine or Russia
    expect(cache.entries['UA']?.hasGermanWarning || cache.entries['RU']?.hasGermanWarning).toBe(true);
    // Verified US State Dept Level for Ukraine or Russia
    expect(cache.entries['UA']?.usStateDeptLevel === 4 || cache.entries['RU']?.usStateDeptLevel === 4).toBe(true);
  }, 10000);
});

describe('getAdvisorySourceUrls', () => {
  it('links the country pages when known and the overviews otherwise', () => {
    expect(
      getAdvisorySourceUrls({
        germanContentId: '201558',
        usUrl: 'https://travel.state.gov/content/tsg_aem/us/en/home/international-travel/travel-advisories/destination.tha.html',
      })
    ).toEqual({
      germanAdvisoryUrl: 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise/201558',
      usAdvisoryUrl: 'https://travel.state.gov/content/tsg_aem/us/en/home/international-travel/travel-advisories/destination.tha.html',
      caAdvisoryUrl: 'https://travel.gc.ca/travelling/advisories',
      auAdvisoryUrl: 'https://www.smartraveller.gov.au/destinations',
    });
    expect(getAdvisorySourceUrls()).toEqual({
      germanAdvisoryUrl: 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise',
      usAdvisoryUrl: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html',
      caAdvisoryUrl: 'https://travel.gc.ca/travelling/advisories',
      auAdvisoryUrl: 'https://www.smartraveller.gov.au/destinations',
    });
  });
});


describe('Canada and Australia advisories', () => {
  it('normalizes Canadian states 0-3 and skips regional entries', () => {
    const list = parseCanadaAdvisories({
      data: {
        AF: { 'country-iso': 'AF', 'advisory-state': 3, eng: { 'url-slug': 'afghanistan', 'advisory-text': 'Avoid all travel' } },
        AL: { 'country-iso': 'AL', 'advisory-state': 0, eng: { 'url-slug': 'albania!', 'advisory-text': 'Exercise normal security precautions' } },
        'PT-20': { 'country-iso': 'PT', 'advisory-state': 2, eng: { 'url-slug': 'azores' } },
      },
    });
    expect(list).toEqual([
      { iso: 'AF', level: 4, title: 'Avoid all travel', url: 'https://travel.gc.ca/destinations/afghanistan' },
      { iso: 'AL', level: 1, title: 'Exercise normal security precautions', url: undefined },
    ]);
    expect(parseCanadaAdvisories(null)).toEqual([]);
  });

  it('maps Smartraveller levels and ignores non-countries and foreign links', () => {
    const list = parseSmartravellerAdvisories([
      { title: 'Afghanistan', field_overall_advice_level: 'Do not travel', field_url: 'https://evil.example/x' },
      { title: 'Spain', field_overall_advice_level: 'Reconsider your need to travel', field_url: 'https://www.smartraveller.gov.au/destinations/europe/spain' },
      { title: 'Atlantis', field_overall_advice_level: 'Exercise normal safety precautions' },
      { title: 'Japan', field_overall_advice_level: 'unknown wording' },
    ]);
    expect(list.map((x) => [x.iso, x.level, Boolean(x.url)])).toEqual([['AF', 4, false], ['ES', 3, true]]);
  });

  it('caps the extra sources at level 3 so they never become a hard ban', () => {
    expect(peakAdvisoryLevel({ usStateDeptLevel: 1, caLevel: 4, auLevel: 4 })).toBe(3);
    expect(peakAdvisoryLevel({ usStateDeptLevel: 4, caLevel: 1 })).toBe(4);
    expect(peakAdvisoryLevel({ usStateDeptLevel: 2 })).toBe(2);
  });

  it('merges them into the live assessment', async () => {
    await refreshTravelAdvisories(true);
    const uae = getDestinationSafetyAssessment('DXB', 'AE');
    expect(uae.caAdvisoryLevel).toBe(2);
    expect(uae.caAdvisoryUrl).toBe('https://travel.gc.ca/destinations/united-arab-emirates');
    const spain = getDestinationSafetyAssessment('PMI', 'ES');
    expect(spain.auAdvisoryLevel).toBe(1);
    expect(spain.advisoryLevel).toBeLessThanOrEqual(2);
  });
});
