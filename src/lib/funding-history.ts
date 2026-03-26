import { list, put } from '@vercel/blob';
import { aggregateRates, buildResponse, fetchAllExchanges } from './fetcher';
import type {
  FundingRateHistoryRecord,
  FundingRateHistoryResponse,
  FundingRateResponse,
  CoinGroup,
} from './types';

const HISTORY_PREFIX = 'funding-history/';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

function normalizeLimit(limit: number | null | undefined): number | undefined {
  if (limit === undefined || limit === null) return undefined;
  if (Number.isNaN(limit) || limit <= 0) return undefined;
  return Math.floor(limit);
}

function toHistoryPath(timestamp: string): string {
  const safeTimestamp = timestamp.replace(/:/g, '-');
  return `${HISTORY_PREFIX}${safeTimestamp}.json`;
}

async function readHistoryRecord(url: string): Promise<FundingRateHistoryRecord | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as FundingRateHistoryRecord;
}

async function listAllHistoryBlobs(limit?: number) {
  const blobs: Array<{ pathname: string; url: string }> = [];
  let cursor: string | undefined;
  const safeLimit = normalizeLimit(limit);

  while (true) {
    const pageLimit = safeLimit ? Math.min(1000, safeLimit - blobs.length) : 1000;
    if (safeLimit && pageLimit <= 0) break;

    const page = await list({
      prefix: HISTORY_PREFIX,
      limit: pageLimit,
      cursor,
    });

    blobs.push(...page.blobs);
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }

  return blobs;
}

export async function recordFundingRateSnapshot(response: FundingRateResponse) {
  if (!BLOB_TOKEN) {
    console.warn('[funding-history] BLOB_READ_WRITE_TOKEN is missing, skip persisting snapshot');
    return { capturedAt: new Date().toISOString(), pathname: null };
  }

  const capturedAt = new Date().toISOString();
  const record: FundingRateHistoryRecord = {
    capturedAt,
    response,
  };

  const pathname = toHistoryPath(capturedAt);

  await put(pathname, JSON.stringify(record, null, 2), {
    access: 'public',
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });

  return { capturedAt, pathname };
}

export async function createAndStoreFundingRateSnapshot(): Promise<{
  response: FundingRateResponse;
  coins: CoinGroup[];
  capturedAt: string | null;
} | null> {
  const { rates, errors } = await fetchAllExchanges();
  const coins = aggregateRates(rates);

  if (coins.length === 0) {
    return null;
  }

  const response = buildResponse(coins, errors);
  const saved = await recordFundingRateSnapshot(response);

  return {
    response,
    coins,
    capturedAt: saved.capturedAt,
  };
}

export async function fetchFundingRateHistory(
  limit?: number,
): Promise<FundingRateHistoryResponse> {
  if (!BLOB_TOKEN) {
    return {
      records: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const safeLimit = normalizeLimit(limit);
  const blobs = await listAllHistoryBlobs(safeLimit);

  if (blobs.length === 0) {
    return {
      records: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const selectedBlobs = blobs
    .slice()
    .sort((a, b) => a.pathname.localeCompare(b.pathname))
    .slice(safeLimit ? -safeLimit : 0)
    .reverse();

  const records = await Promise.allSettled(
    selectedBlobs.map(async (blob) => readHistoryRecord(blob.url)),
  );

  const parsedRecords = records
    .filter((result): result is PromiseFulfilledResult<FundingRateHistoryRecord | null> =>
      result.status === 'fulfilled',
    )
    .map((result) => result.value)
    .filter((record): record is FundingRateHistoryRecord => record !== null)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return {
    records: parsedRecords,
    lastUpdated: new Date().toISOString(),
  };
}
