import { NextResponse } from 'next/server';
import { economicCalendarCache } from '@/lib/cache';
import type { EconomicEvent, EconomicCalendarResponse } from '@/lib/types';

const CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export async function GET() {
  try {
    const cached = economicCalendarCache.get() as EconomicCalendarResponse | null;
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
      });
    }

    const res = await fetch(CALENDAR_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw: EconomicEvent[] = await res.json();

    // Filter USD events only, sort by date
    const events = raw
      .filter((e) => e.country === 'USD')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const response: EconomicCalendarResponse = {
      events,
      lastUpdated: new Date().toISOString(),
    };

    economicCalendarCache.set(response);

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
