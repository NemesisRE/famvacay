import { describe, it, expect } from 'vitest';
import { en } from '@/lib/i18n/locales/en';
import { de } from '@/lib/i18n/locales/de';
import { fr } from '@/lib/i18n/locales/fr';
import { es } from '@/lib/i18n/locales/es';
import { it as itLocale } from '@/lib/i18n/locales/it';

function getNestedKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getNestedKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n Catalog Key Parity Check', () => {
  const enKeys = getNestedKeys(en);

  it('German catalog has identical key parity with English reference', () => {
    const deKeys = getNestedKeys(de);
    expect(deKeys).toEqual(enKeys);
  });

  it('French catalog has identical key parity with English reference', () => {
    const frKeys = getNestedKeys(fr);
    expect(frKeys).toEqual(enKeys);
  });

  it('Spanish catalog has identical key parity with English reference', () => {
    const esKeys = getNestedKeys(es);
    expect(esKeys).toEqual(enKeys);
  });

  it('Italian catalog has identical key parity with English reference', () => {
    const itKeys = getNestedKeys(itLocale);
    expect(itKeys).toEqual(enKeys);
  });
});

