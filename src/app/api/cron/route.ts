import { NextResponse } from 'next/server';
import { fetchAllExchanges, aggregateRates } from '@/lib/fetcher';
import type { EconomicEvent } from '@/lib/types';

export const maxDuration = 60;

const SC_SENDKEY = process.env.SC_SENDKEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

// Track already-alerted events to avoid duplicate pushes (in-memory, resets on cold start)
const alertedEvents = new Set<string>();

async function scSend(text: string, desp: string) {
  const url = `https://sctapi.ftqq.com/${SC_SENDKEY}.send`;
  const body = new URLSearchParams({ text, desp });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.text();
}

function getBjTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'Asia/Shanghai',
  }).formatToParts(now);
  const bjHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const bjMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { now, bjHour, bjMinute };
}

/** Check if upcoming economic events need an advance alert (30 min before) */
async function checkCalendarAlerts(now: Date): Promise<string | null> {
  try {
    const res = await fetch(CALENDAR_URL);
    const allEvents: EconomicEvent[] = await res.json();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    const nowMs = now.getTime();
    const upcoming: EconomicEvent[] = [];

    for (const e of allEvents) {
      if (e.country !== 'USD') continue;
      if (e.impact !== 'High' && e.impact !== 'Medium') continue;
      const eventDate = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      if (eventDate !== todayStr) continue;

      const eventMs = new Date(e.date).getTime();
      const diffMin = (eventMs - nowMs) / 60_000;
      const eventKey = `${e.title}-${e.date}`;

      // Alert if event is 15–35 minutes away and not already alerted
      if (diffMin > 15 && diffMin <= 35 && !alertedEvents.has(eventKey)) {
        upcoming.push(e);
        alertedEvents.add(eventKey);
      }
    }

    if (upcoming.length === 0) return null;

    let desp = '';
    for (const e of upcoming) {
      const time = new Date(e.date).toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
      });
      const impact = e.impact === 'High' ? '🔴' : '🟡';
      desp += `${impact} **${time}** ${e.title}`;
      if (e.forecast) desp += ` (预期: ${e.forecast})`;
      if (e.previous) desp += ` (前值: ${e.previous})`;
      desp += '\n\n';
    }

    return desp;
  } catch {
    return null;
  }
}

/** Build the full hourly funding rate + calendar summary */
async function buildHourlySummary(): Promise<{ title: string; desp: string }> {
  const [fundingResult, calendarResult] = await Promise.allSettled([
    fetchAllExchanges(),
    fetch(CALENDAR_URL).then((r) => r.json() as Promise<EconomicEvent[]>),
  ]);

  let desp = '';

  // Funding rate section
  desp += '## 资金费率\n\n';
  if (fundingResult.status === 'fulfilled') {
    const { rates, errors } = fundingResult.value;
    const coins = aggregateRates(rates);

    if (coins.length === 0) {
      desp += '当前无高费率币种结算\n\n';
    } else {
      for (const coin of coins.slice(0, 15)) {
        const topRate = coin.exchanges[0];
        const sign = topRate.fundingRate > 0 ? '+' : '';
        const pct = (topRate.fundingRate * 100).toFixed(4);
        desp += `**${coin.symbol}** ${sign}${pct}% (${topRate.exchange})`;
        if (coin.exchangeCount > 1) {
          desp += ` 等${coin.exchangeCount}所`;
        }
        desp += '\n\n';
      }
    }

    if (errors.length > 0) {
      desp += `> 部分失败: ${errors.join(', ')}\n\n`;
    }
  } else {
    desp += `获取失败: ${fundingResult.reason?.message ?? 'Unknown'}\n\n`;
  }

  // Economic calendar section
  desp += '---\n\n## 今日经济日历\n\n';
  if (calendarResult.status === 'fulfilled') {
    const allEvents = calendarResult.value;
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    const todayEvents = allEvents.filter((e) => {
      if (e.country !== 'USD') return false;
      if (e.impact !== 'High' && e.impact !== 'Medium') return false;
      const eventDate = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      return eventDate === todayStr;
    });

    if (todayEvents.length === 0) {
      desp += '今日无重要经济事件\n\n';
    } else {
      for (const e of todayEvents) {
        const time = new Date(e.date).toLocaleTimeString('zh-CN', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
        });
        const impact = e.impact === 'High' ? '🔴' : '🟡';
        desp += `${impact} **${time}** ${e.title}`;
        if (e.forecast) desp += ` (预期: ${e.forecast})`;
        if (e.previous) desp += ` (前值: ${e.previous})`;
        desp += '\n\n';
      }
    }
  } else {
    desp += '经济日历获取失败\n\n';
  }

  const hour = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
  });
  const title = `📊 ${hour} 资金费率 & 经济日历`;

  return { title, desp };
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SC_SENDKEY) {
    return NextResponse.json({ error: 'SC_SENDKEY not configured' }, { status: 500 });
  }

  // Check Beijing time window: 6:00 - 2:00 (next day)
  const { now, bjHour, bjMinute } = getBjTime();
  if (bjHour >= 2 && bjHour < 6) {
    return NextResponse.json({ skipped: true, reason: `Beijing time ${bjHour}:xx, outside 06:00-02:00 window` });
  }

  const results: string[] = [];

  try {
    // 1) Always check for upcoming economic event alerts (30 min advance)
    const alertDesp = await checkCalendarAlerts(now);
    if (alertDesp) {
      const alertResult = await scSend('⏰ 经济事件提醒 (30分钟后)', alertDesp);
      results.push(`calendar_alert: ${alertResult}`);
    }

    // 2) Full hourly summary only at minute 55 (±2 min tolerance)
    if (bjMinute >= 53 && bjMinute <= 57) {
      const { title, desp } = await buildHourlySummary();
      const summaryResult = await scSend(title, desp);
      results.push(`hourly_summary: ${summaryResult}`);
    }

    if (results.length === 0) {
      return NextResponse.json({ success: true, action: 'no_push_needed' });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
