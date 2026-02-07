'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FundingRateResponse } from '@/lib/types';
import StatsBar from '@/components/StatsBar';
import FilterBanner from '@/components/FilterBanner';
import CoinCard from '@/components/CoinCard';
import RefreshButton from '@/components/RefreshButton';

export default function FundingRatePanel() {
  const [data, setData] = useState<FundingRateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = forceRefresh ? '/api/funding-rates?refresh=1' : '/api/funding-rates';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: FundingRateResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">资金费率看板</h1>
        <RefreshButton onClick={() => fetchData(true)} loading={loading} />
      </div>

      {/* Stats */}
      {data && (
        <div className="mb-4">
          <StatsBar
            totalCoins={data.meta.totalCoins}
            totalExchanges={data.meta.totalExchanges}
            lastUpdated={data.meta.lastUpdated}
          />
        </div>
      )}

      {/* Filter Banner */}
      <div className="mb-4">
        <FilterBanner />
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          加载失败: {error}
        </div>
      )}

      {/* API errors (partial failures) */}
      {data?.meta.errors && data.meta.errors.length > 0 && (
        <div className="mb-4 rounded-xl bg-yellow-50 p-3 text-xs text-yellow-700">
          部分交易所获取失败: {data.meta.errors.join(', ')}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                  <div>
                    <div className="h-4 w-16 rounded bg-gray-200" />
                    <div className="mt-1.5 h-3 w-24 rounded bg-gray-100" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-5 w-20 rounded bg-gray-200" />
                  <div className="mt-1.5 h-3 w-14 rounded bg-gray-100" />
                </div>
              </div>
              <div className="mt-3 border-t border-gray-50 pt-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 rounded bg-gray-100" />
                  <div className="h-3 w-16 rounded bg-gray-100" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="h-3 w-24 rounded bg-gray-100" />
                  <div className="h-3 w-20 rounded bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coin list */}
      {data && (
        <div className="space-y-4">
          {data.coins.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-400">
              当前没有符合条件的币种
            </div>
          ) : (
            data.coins.map((coin, i) => (
              <CoinCard key={coin.symbol} coin={coin} rank={i + 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
