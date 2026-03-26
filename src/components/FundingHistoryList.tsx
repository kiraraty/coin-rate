'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FundingRateHistoryRecord, FundingRateHistoryResponse } from '@/lib/types';

function formatDateKey(timestamp: string) {
  return new Date(timestamp).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai',
  });
}

function formatDayLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function formatHour(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatShanghaiDateTime(timestamp: string) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function todayDateKey() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai',
  });
}

function formatRate(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(4)}%`;
}

function groupByDay(records: FundingRateHistoryRecord[]) {
  return records.reduce<Record<string, FundingRateHistoryRecord[]>>((acc, record) => {
    const key = formatDateKey(record.capturedAt);
    const list = acc[key] || [];
    list.push(record);
    acc[key] = list;
    return acc;
  }, {});
}

function summarizeCoin(record: FundingRateHistoryRecord) {
  const topCoins = record.response.coins.slice(0, 4);

  return (
    <div className="space-y-2">
      {topCoins.map((coin) => (
        <div key={`${record.capturedAt}-${coin.symbol}`} className="rounded-lg bg-white px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">{coin.symbol}</div>
              <div className="text-xs text-gray-400">
                {coin.exchangeCount} 个交易所 · 最高 {formatRate(coin.maxAbsFundingRate)}
              </div>
            </div>
            <div className="text-xs text-gray-400">{formatHour(record.capturedAt)}</div>
          </div>

          <div className="mt-2 space-y-1">
            {coin.exchanges.slice(0, 3).map((exchange) => (
              <div key={`${record.capturedAt}-${coin.symbol}-${exchange.exchangeId}`} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{exchange.exchange}</span>
                <span className={exchange.fundingRate < 0 ? 'text-green-600' : 'text-red-500'}>
                  {formatRate(exchange.fundingRate)}
                </span>
              </div>
            ))}
            {coin.exchanges.length > 3 && (
              <div className="text-[11px] text-gray-400">还有 {coin.exchanges.length - 3} 个交易所</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FundingHistoryList() {
  const [data, setData] = useState<FundingRateHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(() => todayDateKey());

  useEffect(() => {
    let active = true;

    async function fetchHistory() {
      if (active) {
        setError(null);
      }

      try {
        const res = await fetch('/api/funding-history', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: FundingRateHistoryResponse = await res.json();
        if (active) setData(json);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '请求失败');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchHistory();
    const interval = setInterval(fetchHistory, 300_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const grouped = useMemo(() => groupByDay(data?.records ?? []), [data]);
  const availableDays = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped],
  );
  const selectedRecords = selectedDay ? (grouped[selectedDay] || []) : [];

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800">历史记录</div>
          <div className="text-xs text-gray-400">按天选取，再按小时看当时的快照</div>
        </div>
        <div className="text-xs text-gray-400">
          {data?.records?.length ? `${data.records.length} 条` : '暂无数据'}
        </div>
      </div>

      {data && data.records.length > 0 && (
        <div className="mb-4 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-gray-500">选择日期</div>
              <div className="mt-0.5 text-xs text-gray-400">
                {selectedDay ? `${selectedRecords.length} 个小时记录` : '请选择一个日期'}
              </div>
            </div>
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-300"
            />
          </div>

          {availableDays.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableDays.map((day) => {
                const active = day === selectedDay;
                const count = grouped[day]?.length ?? 0;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      active ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {day} · {count}h
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
          历史记录加载失败: {error}
        </div>
      )}

      {data && data.records.length === 0 && !error && (
        <div className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
          还没有历史记录，等快照任务跑起来后这里会显示。
        </div>
      )}

      {data && data.records.length > 0 && selectedDay && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="text-sm font-semibold text-gray-700">
              {formatDayLabel(selectedDay)}
            </div>
            <div className="text-xs text-gray-400">{selectedRecords.length} 个小时记录</div>
          </div>

          {selectedRecords.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
              这一天没有记录。
            </div>
          ) : (
            <div className="space-y-3">
              {selectedRecords
                .slice()
                .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
                .map((record) => {
                  const topCoin = record.response.coins[0];
                  const keyCoinCount = record.response.coins.length;

                  return (
                    <div key={record.capturedAt} className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex gap-3 px-3 py-3">
                        <div className="flex w-16 shrink-0 flex-col items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white">
                            {formatHour(record.capturedAt)}
                          </div>
                          <div className="mt-2 h-full w-px bg-gray-200" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-800">
                                {topCoin ? `${topCoin.symbol} 资金费率快照` : '资金费率快照'}
                              </div>
                              <div className="mt-0.5 text-xs text-gray-500">
                                币种 {record.response.meta.totalCoins} · 交易所 {record.response.meta.totalExchanges}
                              </div>
                            </div>
                            <div className="text-right text-xs text-gray-500">
                              <div>北京时间 {formatShanghaiDateTime(record.response.meta.lastUpdated)}</div>
                              <div>{keyCoinCount} 个币种</div>
                            </div>
                          </div>

                          {topCoin && (
                            <div className="mt-3 rounded-lg bg-white px-3 py-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">本小时最强</div>
                                <div className="text-sm font-semibold text-gray-800">
                                  {topCoin.symbol} {formatRate(topCoin.maxAbsFundingRate)}
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] text-gray-400">
                                下次结算 {formatShanghaiDateTime(new Date(topCoin.nextSettlement).toISOString())}
                              </div>
                            </div>
                          )}

                          <div className="mt-3">
                            {summarizeCoin(record)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
