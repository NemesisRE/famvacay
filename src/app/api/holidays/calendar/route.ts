import { NextRequest, NextResponse } from 'next/server';
import { getCountryHolidayCalendar, getPersonalHolidayCalendar } from '@/lib/holidays/holiday-calendar';

export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGION = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/;
const MAX_RANGE_DAYS = 2 * 366;

/**
 * Day-by-day holiday calendar of the travel period for the "Calendar" results tab:
 * ?view=country&region=DE-BW (school regions of the whole country on holiday) or
 * ?view=personal&region=DE-BW&schoolRegions=DE-BW,DE-BY (the family's own school holidays).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const view = params.get('view') === 'personal' ? 'personal' : 'country';
  const region = (params.get('region') || '').trim().toUpperCase();
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  if (!REGION.test(region)) return NextResponse.json({ error: 'invalid region' }, { status: 400 });
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || to < from || Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json({ error: 'invalid range' }, { status: 400 });
  }
  const locale = (params.get('locale') || 'en').slice(0, 2);
  const headers = { 'Cache-Control': 'private, max-age=3600' };

  if (view === 'country') {
    return NextResponse.json(await getCountryHolidayCalendar(region.split('-')[0], from, to, locale), { headers });
  }
  const schoolRegions = (params.get('schoolRegions') || '')
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter((r) => REGION.test(r))
    .slice(0, 10);
  return NextResponse.json(await getPersonalHolidayCalendar(region, schoolRegions, from, to, locale), { headers });
}
