import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, negotiateLocale } from './locale-negotiation';
import type { SupportedLocale } from './types';

/** The language of this request: saved choice (cookie), otherwise Accept-Language */
export async function getRequestLocale(): Promise<SupportedLocale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return negotiateLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get('accept-language'));
}
