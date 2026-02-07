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

async function fetchBatchExchange(config: ExchangeConfig): Promise<ExchangeFundingRate[]> {
  const exchange = config.createInstance();
  await exchange.loadMarkets();

  const fundingRates = await exchange.fetchFundingRates();
  return parseFundingRates(config, fundingRates);
}

async function fetchSingleExchange(
  config: ExchangeConfig,
  symbols: string[],
): Promise<ExchangeFundingRate[]> {
  const exchange = config.createInstance();
  await exchange.loadMarkets();

  const results: ExchangeFundingRate[] = [];
  // Find matching market symbols for this exchange
  const marketSymbols: string[] = [];
  for (const sym of symbols) {
    const usdtPair = `${sym}/USDT:USDT`;
    if (exchange.markets[usdtPair]) {
      marketSymbols.push(usdtPair);
    }
  }

  // Fetch in parallel, max 10 concurrent
  const chunks: string[][] = [];
  for (let i = 0; i < marketSymbols.length; i += 10) {
    chunks.push(marketSymbols.slice(i, i + 10));
  }
  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map((pair) => exchange.fetchFundingRate(pair))
    );
    for (const result of settled) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const data = result.value;
      const pair = data.symbol;
      if (!pair) continue;
      const parsed = parseSingleRate(config, pair, data);
      if (parsed) results.push(parsed);
    }
  }
  return results;
}

function parseSingleRate(
  config: ExchangeConfig,
  pair: string,
  data: Record<string, any>,
): ExchangeFundingRate | null {
  const fundingRate = data.fundingRate as number | undefined | null;
  if (fundingRate === undefined || fundingRate === null) return null;

  const symbol = pair.split('/')[0];
  const now = Date.now();
  const ft = data.fundingTimestamp as number | undefined;
  const nft = data.nextFundingTimestamp as number | undefined;

  let nextFundingTimestamp: number;
  if (ft && ft > now) {
    nextFundingTimestamp = ft;
  } else if (nft && nft > now) {
    nextFundingTimestamp = nft;
  } else {
    nextFundingTimestamp = estimateNextFunding();
  }

  return {
    exchange: config.name,
    exchangeId: config.id,
    symbol,
    pair,
    fundingRate,
    nextFundingTimestamp,
    markPrice: (data.markPrice as number) ?? null,
    volume24h: null,
  };
}

function parseFundingRates(
  config: ExchangeConfig,
  fundingRates: Record<string, any>,
): ExchangeFundingRate[] {
  const results: ExchangeFundingRate[] = [];

  for (const [pair, data] of Object.entries(fundingRates)) {
    // Only include USDT/USDC-margined perpetuals
    if (!pair.includes('/USDT') && !pair.includes('/USDC')) continue;

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
  const batchConfigs = EXCHANGE_CONFIGS.filter((c) => c.mode === 'batch');
  const singleConfigs = EXCHANGE_CONFIGS.filter((c) => c.mode === 'single');

  // Phase 1: fetch all batch exchanges in parallel
  const batchPromises = batchConfigs.map((config) =>
    withTimeout(fetchBatchExchange(config), PER_EXCHANGE_TIMEOUT, config.name)
  );
  const batchSettled = await Promise.allSettled(batchPromises);

  const rates: ExchangeFundingRate[] = [];
  const errors: string[] = [];

  batchSettled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      rates.push(...result.value);
    } else {
      errors.push(`${batchConfigs[i].name}: ${result.reason?.message ?? 'Unknown error'}`);
    }
  });

  // Phase 2: only query single-mode exchanges for symbols that already have
  // high funding rates and settle within the next hour (pre-filter to reduce requests)
  if (singleConfigs.length > 0) {
    const now = Date.now();
    const oneHourLater = now + 3600_000;
    const highRateSymbols = new Set<string>();
    for (const r of rates) {
      if (r.nextFundingTimestamp > now && r.nextFundingTimestamp <= oneHourLater
          && Math.abs(r.fundingRate) >= 0.0005) {
        highRateSymbols.add(r.symbol);
      }
    }
    const symbols = [...highRateSymbols];
    if (symbols.length > 0) {
      const singlePromises = singleConfigs.map((config) =>
        withTimeout(fetchSingleExchange(config, symbols), PER_EXCHANGE_TIMEOUT, config.name)
      );
      const singleSettled = await Promise.allSettled(singlePromises);

      singleSettled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          rates.push(...result.value);
        } else {
          errors.push(`${singleConfigs[i].name}: ${result.reason?.message ?? 'Unknown error'}`);
        }
      });
    }
  }

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
