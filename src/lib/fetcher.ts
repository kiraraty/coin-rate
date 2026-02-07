import { type ExchangeConfig, EXCHANGE_CONFIGS } from './exchanges';
import type { ExchangeFundingRate, CoinGroup, FundingRateResponse } from './types';

const PER_EXCHANGE_TIMEOUT = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function fetchFromExchange(config: ExchangeConfig): Promise<ExchangeFundingRate[]> {
  const exchange = config.createInstance();
  await exchange.loadMarkets();

  const fundingRates = await exchange.fetchFundingRates();
  const results: ExchangeFundingRate[] = [];

  for (const [pair, data] of Object.entries(fundingRates)) {
    // Only include USDT-margined perpetuals
    if (!pair.includes('/USDT')) continue;

    const fundingRate = data.fundingRate;
    if (fundingRate === undefined || fundingRate === null) continue;

    const symbol = pair.split('/')[0];
    // Use fundingTimestamp as next settlement if it's in the future,
    // otherwise fall back to nextFundingTimestamp, then estimate
    const now = Date.now();
    let nextFundingTimestamp: number;
    if (data.fundingTimestamp && data.fundingTimestamp > now) {
      nextFundingTimestamp = data.fundingTimestamp;
    } else if (data.nextFundingTimestamp && data.nextFundingTimestamp > now) {
      nextFundingTimestamp = data.nextFundingTimestamp;
    } else {
      nextFundingTimestamp = estimateNextFunding();
    }

    results.push({
      exchange: config.name,
      exchangeId: config.id,
      symbol,
      pair,
      fundingRate,
      nextFundingTimestamp,
      markPrice: data.markPrice ?? null,
      volume24h: null,
    });
  }

  return results;
}

function estimateNextFunding(): number {
  const now = Date.now();
  const hour = 3600_000;
  // Common 8-hour intervals: 00:00, 08:00, 16:00 UTC
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const base = dayStart.getTime();

  for (let i = 0; i < 4; i++) {
    const t = base + i * 8 * hour;
    if (t > now) return t;
  }
  return base + 24 * hour;
}

export async function fetchAllExchanges(): Promise<{
  rates: ExchangeFundingRate[];
  errors: string[];
}> {
  const promises = EXCHANGE_CONFIGS.map((config) =>
    withTimeout(fetchFromExchange(config), PER_EXCHANGE_TIMEOUT, config.name)
  );

  const settled = await Promise.allSettled(promises);
  const rates: ExchangeFundingRate[] = [];
  const errors: string[] = [];

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      rates.push(...result.value);
    } else {
      errors.push(`${EXCHANGE_CONFIGS[i].name}: ${result.reason?.message ?? 'Unknown error'}`);
    }
  });

  return { rates, errors };
}

export function aggregateRates(
  rates: ExchangeFundingRate[],
  minAbsRate: number = 0.0005
): CoinGroup[] {
  const now = Date.now();
  const oneHourLater = now + 3600_000;

  // Group by symbol — only include settlements within next hour
  const groups = new Map<string, ExchangeFundingRate[]>();
  for (const rate of rates) {
    if (rate.nextFundingTimestamp < now) continue;
    if (rate.nextFundingTimestamp > oneHourLater) continue;

    const existing = groups.get(rate.symbol) || [];
    existing.push(rate);
    groups.set(rate.symbol, existing);
  }

  // Build CoinGroup array
  const coins: CoinGroup[] = [];
  for (const [symbol, exchanges] of groups) {
    const maxAbsFundingRate = Math.max(...exchanges.map((e) => Math.abs(e.fundingRate)));
    if (maxAbsFundingRate < minAbsRate) continue;

    // Sort exchanges by absolute funding rate descending
    exchanges.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    const nextSettlement = Math.min(...exchanges.map((e) => e.nextFundingTimestamp));

    coins.push({
      symbol,
      maxAbsFundingRate,
      nextSettlement,
      exchangeCount: exchanges.length,
      exchanges,
    });
  }

  // Sort by max absolute funding rate descending
  coins.sort((a, b) => b.maxAbsFundingRate - a.maxAbsFundingRate);

  return coins;
}

export function buildResponse(
  coins: CoinGroup[],
  errors: string[]
): FundingRateResponse {
  const exchangeSet = new Set<string>();
  for (const coin of coins) {
    for (const ex of coin.exchanges) {
      exchangeSet.add(ex.exchangeId);
    }
  }

  return {
    coins,
    meta: {
      totalCoins: coins.length,
      totalExchanges: exchangeSet.size,
      lastUpdated: new Date().toISOString(),
      errors,
    },
  };
}
