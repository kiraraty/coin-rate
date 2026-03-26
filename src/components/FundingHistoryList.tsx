'use client';

import { useEffect, useState } from 'react';
import type { FundingRateHistoryResponse } from '@/lib/types';

function formatRate(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(4)}%`;
}

function dateKey(timestamp: string) {
  return new Date(timestamp).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai',
  });
}

function dateLabel(timestamp: string) {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function timeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
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

  const groupedRecords = data?.records.reduce<Record<string, FundingRateHistoryResponse['records']>>((acc, record) => {
    const key = dateKey(record.capturedAt);
    const list = acc[key] || [];
    list.push(record);
    acc[key] = list;
    return acc;
  }, {}) || {};

  const availableDays = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));
  const selectedRecords = selectedDay ? (groupedRecords[selectedDay] || []) : [];

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800">历史记录</div>
          <div className="text-xs text-gray-400">选一天，看这一天每个小时保存的快照</div>
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
              {availableDays.slice(0, 14).map((day) => {
                const active = day === selectedDay;
                const count = groupedRecords[day]?.length ?? 0;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
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
          还没有历史记录，等 cron 跑一次后这里会显示。
        </div>
      )}

      {data && data.records.length > 0 && selectedDay && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="text-sm font-semibold text-gray-700">
              {dateLabel(selectedRecords[0]?.capturedAt || selectedDay)}
            </div>
            <div className="text-xs text-gray-400">{selectedRecords.length} 个小时记录</div>
          </div>

          {selectedRecords.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
              这一天没有记录。
            </div>
          ) : (
            <div className="space-y-2">
              {selectedRecords
                .slice()
                .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
                .map((record) => {
                  const topCoin = record.response.coins[0];
                  const topExchange = topCoin?.exchanges[0];

                  return (
                    <div key={record.capturedAt} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{timeLabel(record.capturedAt)}</div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            币种 {record.response.meta.totalCoins} · 交易所 {record.response.meta.totalExchanges}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div>{topCoin ? `最强: ${topCoin.symbol} ${formatRate(topCoin.maxAbsFundingRate)}` : '--'}</div>
                          <div>{topExchange ? `交易所: ${topExchange.exchange}` : ''}</div>
                        </div>
                      </div>

                      {record.response.coins.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {record.response.coins.slice(0, 3).map((coin) => (
                            <span
                              key={`${record.capturedAt}-${coin.symbol}`}
                              className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600"
                            >
                              {coin.symbol} {formatRate(coin.maxAbsFundingRate)}
                            </span>
                          ))}
                        </div>
                      )}
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
