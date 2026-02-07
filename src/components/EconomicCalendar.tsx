'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EconomicEvent, EconomicCalendarResponse } from '@/lib/types';

// Common US economic event translations
const EVENT_TRANSLATIONS: Record<string, string> = {
  // Employment
  'Non-Farm Employment Change': '非农就业人数变化',
  'ADP Non-Farm Employment Change': 'ADP非农就业人数变化',
  'Unemployment Claims': '初请失业金人数',
  'Unemployment Rate': '失业率',
  'Average Hourly Earnings m/m': '平均每小时工资月率',
  'Average Hourly Earnings y/y': '平均每小时工资年率',
  'JOLTS Job Openings': 'JOLTS职位空缺数',
  'Challenger Job Cuts y/y': '挑战者企业裁员年率',
  // Inflation & Prices
  'CPI m/m': 'CPI月率',
  'CPI y/y': 'CPI年率',
  'Core CPI m/m': '核心CPI月率',
  'Core CPI y/y': '核心CPI年率',
  'PPI m/m': 'PPI月率',
  'PPI y/y': 'PPI年率',
  'Core PPI m/m': '核心PPI月率',
  'Core PPI y/y': '核心PPI年率',
  'PCE Price Index m/m': 'PCE物价指数月率',
  'Core PCE Price Index m/m': '核心PCE物价指数月率',
  'Core PCE Price Index y/y': '核心PCE物价指数年率',
  'ISM Manufacturing Prices': 'ISM制造业物价指数',
  // GDP
  'Advance GDP q/q': 'GDP初值季率',
  'Prelim GDP q/q': 'GDP修正值季率',
  'Final GDP q/q': 'GDP终值季率',
  'Advance GDP Price Index q/q': 'GDP物价指数初值季率',
  // PMI & Manufacturing
  'ISM Manufacturing PMI': 'ISM制造业PMI',
  'ISM Services PMI': 'ISM非制造业PMI',
  'Final Manufacturing PMI': '制造业PMI终值',
  'Final Services PMI': '服务业PMI终值',
  'Flash Manufacturing PMI': '制造业PMI初值',
  'Flash Services PMI': '服务业PMI初值',
  // Consumer
  'Retail Sales m/m': '零售销售月率',
  'Core Retail Sales m/m': '核心零售销售月率',
  'Consumer Confidence': '消费者信心指数',
  'CB Consumer Confidence': 'CB消费者信心指数',
  'Prelim UoM Consumer Sentiment': '密歇根消费者信心指数初值',
  'Revised UoM Consumer Sentiment': '密歇根消费者信心指数修正值',
  'Prelim UoM Inflation Expectations': '密歇根通胀预期初值',
  'Revised UoM Inflation Expectations': '密歇根通胀预期修正值',
  'Consumer Credit m/m': '消费者信贷月率',
  // Housing
  'Building Permits': '营建许可',
  'Housing Starts': '新屋开工',
  'Existing Home Sales': '成屋销售',
  'New Home Sales': '新屋销售',
  'Pending Home Sales m/m': '成屋签约销售月率',
  // Trade & Industry
  'Trade Balance': '贸易帐',
  'Industrial Production m/m': '工业产出月率',
  'Capacity Utilization Rate': '产能利用率',
  'Durable Goods Orders m/m': '耐用品订单月率',
  'Core Durable Goods Orders m/m': '核心耐用品订单月率',
  'Factory Orders m/m': '工厂订单月率',
  // Fed & Interest Rates
  'Federal Funds Rate': '联邦基金利率',
  'FOMC Statement': 'FOMC声明',
  'FOMC Meeting Minutes': 'FOMC会议纪要',
  'FOMC Press Conference': 'FOMC新闻发布会',
  // Energy
  'Crude Oil Inventories': '原油库存',
  'Natural Gas Storage': '天然气库存',
  'API Weekly Statistical Bulletin': 'API原油库存周报',
  // Other
  'Loan Officer Survey': '贷款官员调查',
  'Wards Total Vehicle Sales': '汽车总销量',
  'RCM/TIPP Economic Optimism': 'RCM/TIPP经济乐观指数',
  'President Trump Speaks': '特朗普总统讲话',
};

// Match FOMC/Fed member speeches
function translateTitle(title: string): string | null {
  if (EVENT_TRANSLATIONS[title]) return EVENT_TRANSLATIONS[title];
  // FOMC Member XXX Speaks
  const fomcMatch = title.match(/^FOMC Member (\w+) Speaks$/);
  if (fomcMatch) return `FOMC委员${fomcMatch[1]}讲话`;
  // Fed Chair XXX Speaks
  const fedChairMatch = title.match(/^Fed Chair (\w+) Speaks$/);
  if (fedChairMatch) return `美联储主席${fedChairMatch[1]}讲话`;
  return null;
}

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
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  // Use Asia/Shanghai to get correct weekday and date
  const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Shanghai' });
  return formatter.format(d);
}

function groupByDate(events: EconomicEvent[]): Map<string, EconomicEvent[]> {
  const groups = new Map<string, EconomicEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.date).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
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
          {[1, 2].map((g) => (
            <div key={g} className="animate-pulse overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <div className="h-4 w-24 rounded bg-gray-200" />
              </div>
              <div className="divide-y divide-gray-50">
                {[1, 2, 3].map((r) => (
                  <div key={r} className="flex items-start gap-3 px-4 py-3">
                    <div className="h-3 w-10 rounded bg-gray-200" />
                    <div className="h-4 w-6 rounded bg-gray-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 rounded bg-gray-200" />
                      <div className="h-3 w-20 rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
  const zhTitle = translateTitle(event.title);

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
        <div className="text-sm font-medium text-gray-800">
          {zhTitle ?? event.title}
        </div>
        {zhTitle && (
          <div className="mt-0.5 text-xs text-gray-400">{event.title}</div>
        )}
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
