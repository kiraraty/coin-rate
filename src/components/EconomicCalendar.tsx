'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EconomicEvent, EconomicCalendarResponse } from '@/lib/types';

const IMPACT_STYLES: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-500',
  Holiday: 'bg-blue-100 text-blue-600',
};

const IMPACT_LABELS: Record<string, string> = {
  High: '高',
  Medium: '中',
  Low: '低',
  Holiday: '假日',
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}/${d.getDate()} ${weekdays[d.getDay()]}`;
}

function groupByDate(events: EconomicEvent[]): Map<string, EconomicEvent[]> {
  const groups = new Map<string, EconomicEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.date).toLocaleDateString('zh-CN');
    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  }
  return groups;
}

export default function EconomicCalendar() {
  const [data, setData] = useState<EconomicCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'High' | 'Medium'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/economic-calendar');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: EconomicCalendarResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = data?.events.filter((e) => {
    if (filter === 'all') return true;
    return e.impact === filter;
  }) ?? [];

  const grouped = groupByDate(filtered);

  return (
    <div>
      {/* Filter buttons */}
      <div className="mb-4 flex gap-2">
        {([['all', '全部'], ['High', '高影响'], ['Medium', '中影响']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          加载失败: {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      )}

      {/* Event list grouped by date */}
      {data && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-400">
              当前没有符合条件的经济事件
            </div>
          ) : (
            [...grouped.entries()].map(([dateKey, events]) => (
              <div key={dateKey} className="overflow-hidden rounded-xl bg-white shadow-sm">
                {/* Date header */}
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">
                  {formatDate(events[0].date)}
                </div>
                {/* Events */}
                <div className="divide-y divide-gray-50">
                  {events.map((event, i) => (
                    <EventRow key={`${event.title}-${i}`} event={event} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: EconomicEvent }) {
  const isPast = new Date(event.date).getTime() < Date.now();
  const impactStyle = IMPACT_STYLES[event.impact] || IMPACT_STYLES.Low;
  const impactLabel = IMPACT_LABELS[event.impact] || event.impact;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${isPast ? 'opacity-50' : ''}`}>
      {/* Time */}
      <div className="w-12 shrink-0 pt-0.5 text-xs font-medium text-gray-500">
        {formatTime(event.date)}
      </div>
      {/* Impact badge */}
      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${impactStyle}`}>
        {impactLabel}
      </span>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-800">{event.title}</div>
        {(event.forecast || event.previous) && (
          <div className="mt-1 flex gap-3 text-xs text-gray-400">
            {event.forecast && <span>预期: {event.forecast}</span>}
            {event.previous && <span>前值: {event.previous}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
