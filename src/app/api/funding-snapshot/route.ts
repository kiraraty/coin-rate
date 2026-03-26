import { NextResponse } from 'next/server';
import { createAndStoreFundingRateSnapshot } from '@/lib/funding-history';

export const maxDuration = 60;

const SNAPSHOT_SECRET = process.env.CRON_SECRET || '';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (SNAPSHOT_SECRET && authHeader !== `Bearer ${SNAPSHOT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await createAndStoreFundingRateSnapshot();

    if (!snapshot) {
      return NextResponse.json({
        success: true,
        saved: false,
        reason: 'No qualifying coins',
      });
    }

    return NextResponse.json({
      success: true,
      saved: true,
      capturedAt: snapshot.capturedAt,
      totalCoins: snapshot.response.meta.totalCoins,
      totalExchanges: snapshot.response.meta.totalExchanges,
      errors: snapshot.response.meta.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
