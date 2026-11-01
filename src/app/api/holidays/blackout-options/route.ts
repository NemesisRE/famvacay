import { NextRequest, NextResponse } from 'next/server';
import { getHolidayBlackoutOptions, resolveHolidayBlackouts } from '@/lib/holidays/holiday-periods';

export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGION = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/;
const MAX_RANGE_DAYS = 3 * 366;

/**
 * Holiday blackout toggles of the home region (its public holidays, see holiday-periods.ts) with
 * their dates in [from, to], and the dates of the selected ones for the search. Without a range:
 * the coming twelve months (profile).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const region = (params.get('region') || '').trim().toUpperCase();
  if (!REGION.test(region)) return NextResponse.json({ error: 'invalid region' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const from = ISO_DATE.test(params.get('from') || '') ? params.get('from')! : today;
  const to = ISO_DATE.test(params.get('to') || '')
    ? params.get('to')!
    : new Date(Date.parse(`${from}T00:00:00Z`) + 365 * 86_400_000).toISOString().slice(0, 10);
  if (to < from || Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json({ error: 'invalid range' }, { status: 400 });
  }
  const locale = (params.get('locale') || 'en').slice(0, 2);
  const selected = (params.get('selected') || '').split(',').filter(Boolean).slice(0, 50);

  return NextResponse.json(
    {
      options: getHolidayBlackoutOptions(region, from, to, locale, selected),
      // Dates of the selected holidays, matched by their rules (robust where periods merge differently by year)
      blackouts: resolveHolidayBlackouts(selected, region, from, to, locale),
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
