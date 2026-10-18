import { describe, it, expect } from 'vitest';
import {
  isDestinationSafeForVacation,
  getDestinationSafetyAssessment,
} from './safety-service';

describe('Destination Safety & Security Service (Amadeus Safe Place / Travel Advisory)', () => {
  it('identifies safe family vacation destinations with high scores (Level 1 / 2)', () => {
    // Mallorca / Spain
    expect(isDestinationSafeForVacation('PMI', 'ES')).toBe(true);
    const pmiAssessment = getDestinationSafetyAssessment('PMI', 'ES');
    expect(pmiAssessment.isSafeForFamilies).toBe(true);
    expect(pmiAssessment.score).toBeGreaterThanOrEqual(75);
    expect(pmiAssessment.advisoryLevel).toBeLessThanOrEqual(2);

    // Austria / Alps
    expect(isDestinationSafeForVacation('INN', 'AT')).toBe(true);
    const innAssessment = getDestinationSafetyAssessment('INN', 'AT');
    expect(innAssessment.score).toBeGreaterThanOrEqual(90);

    // Japan / Tokyo
    expect(isDestinationSafeForVacation('HND', 'JP')).toBe(true);
    const hndAssessment = getDestinationSafetyAssessment('HND', 'JP');
    expect(hndAssessment.isSafeForFamilies).toBe(true);
    expect(hndAssessment.score).toBeGreaterThanOrEqual(75);

    // United Arab Emirates / Dubai
    expect(isDestinationSafeForVacation('DXB', 'AE')).toBe(true);

    // Thailand (Phuket / Bangkok)
    expect(isDestinationSafeForVacation('BKK', 'TH')).toBe(true);
    const bkkAssessment = getDestinationSafetyAssessment('BKK', 'TH');
    expect(bkkAssessment.isSafeForFamilies).toBe(true);
    expect(bkkAssessment.advisoryLevel).toBeLessThanOrEqual(2);
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

