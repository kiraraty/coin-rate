import { NextResponse } from 'next/server';
import { fundingRateCache } from '@/lib/cache';
import { fetchAllExchanges, aggregateRates, buildResponse } from '@/lib/fetcher';
import type { FundingRateResponse } from '@/lib/types';

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';

    if (!forceRefresh) {
      const cached = fundingRateCache.get() as FundingRateResponse | null;
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
          },
        });
      }
    }

    const { rates, errors } = await fetchAllExchanges();
    const coins = aggregateRates(rates);
    const response = buildResponse(coins, errors);

    fundingRateCache.set(response);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
