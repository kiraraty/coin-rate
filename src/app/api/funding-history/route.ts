import { NextResponse } from 'next/server';
import { fetchFundingRateHistory } from '@/lib/funding-history';

export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam === null ? undefined : Number(limitParam);
    const history = await fetchFundingRateHistory(Number.isNaN(limit ?? NaN) ? undefined : limit);

    return NextResponse.json(history, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, records: [], lastUpdated: new Date().toISOString() },
      { status: 500 },
    );
  }
}
