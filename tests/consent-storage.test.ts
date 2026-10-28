import { describe, it, expect, beforeEach } from 'vitest';
import { setUmamiDisabled, setBannerChoice } from '@/lib/consent/cookie-consent-context';

describe('Cookie and Umami consent storage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    if (typeof window === 'undefined') {
      Object.defineProperty(globalThis, 'window', {
        value: {
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        },
        writable: true,
        configurable: true,
      });
    }
  });

  it('removes umami.disabled from localStorage when analytics is enabled (not storing "0")', () => {
    setUmamiDisabled(false);
    expect(localStorage.getItem('umami.disabled')).toBeNull();
  });

  it('sets umami.disabled to "1" when disabled', () => {
    setUmamiDisabled(true);
    expect(localStorage.getItem('umami.disabled')).toBe('1');
  });

  it('cleans up legacy "0" in localStorage so Umami tracker is not silenced by truthy "0"', () => {
    localStorage.setItem('umami.disabled', '0');
    setUmamiDisabled(false);
    expect(localStorage.getItem('umami.disabled')).toBeNull();
  });

  it('removes umami.disabled on setBannerChoice("accepted")', () => {
    setBannerChoice('accepted');
    expect(localStorage.getItem('umami.disabled')).toBeNull();
    expect(localStorage.getItem('famvacay_cookie_choice')).toBe('accepted');
  });

  it('sets umami.disabled to "1" on setBannerChoice("essential_only")', () => {
    setBannerChoice('essential_only');
    expect(localStorage.getItem('umami.disabled')).toBe('1');
    expect(localStorage.getItem('famvacay_cookie_choice')).toBe('essential_only');
  });
});
