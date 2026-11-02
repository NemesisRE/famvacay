import { describe, expect, it } from 'vitest';
import { hotelNightlyRate, hotelPriceFactor, resortPremium, resortPremiumFor } from '../hotel-rates';

describe('hotel rates from country price levels', () => {
  it('ranks expensive countries above the reference and cheap ones below', () => {
    const swiss = hotelNightlyRate(1.28, 'PEAK');
    const spain = hotelNightlyRate(0.69, 'PEAK');
    const turkey = hotelNightlyRate(0.45, 'PEAK');
    expect(swiss).toBeGreaterThan(spain);
    expect(spain).toBeGreaterThan(turkey);
  });

  it('stays at the base rate without data', () => {
    expect(hotelNightlyRate(undefined, 'SHOULDER')).toBe(122);
    expect(hotelPriceFactor(0)).toBe(1);
  });

  it('clamps extreme price levels', () => {
    expect(hotelPriceFactor(0.05)).toBe(0.6);
    expect(hotelPriceFactor(5)).toBe(1.9);
  });

  it('is higher in peak season than off season', () => {
    expect(hotelNightlyRate(0.7, 'PEAK')).toBeGreaterThan(hotelNightlyRate(0.7, 'OFF'));
  });

  it('lifts rates where tourists spend far more than usual, never below the price level', () => {
    expect(resortPremium(3000, 1000)).toBeGreaterThan(1.3);
    expect(resortPremium(400, 1000)).toBe(1);
    expect(resortPremium(undefined, 1000)).toBe(1);
    expect(resortPremium(100000, 1000)).toBe(1.4);
    expect(hotelNightlyRate(0.62, 'PEAK', 1.5)).toBeGreaterThan(hotelNightlyRate(0.62, 'PEAK'));
  });

  it('lifts island luxury destinations to their floor but keeps a higher data premium', () => {
    expect(resortPremiumFor('mv', 1.1)).toBe(2);
    expect(resortPremiumFor('MV', 2.5)).toBe(2.5);
    expect(resortPremiumFor('ES', 1.04)).toBe(1.04);
  });
});
