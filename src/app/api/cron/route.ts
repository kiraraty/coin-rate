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
      if (e.impact !== 'High') continue;
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

/** Build funding rate push: top 3 coins with all exchange details */
async function buildFundingRatePush(): Promise<{ title: string; desp: string } | null> {
  try {
    const { rates, errors } = await fetchAllExchanges();
    const coins = aggregateRates(rates);

    if (coins.length === 0) return null;

    let desp = '';
    for (const coin of coins.slice(0, 3)) {
      const sign = coin.exchanges[0].fundingRate > 0 ? '+' : '';
      const pct = (coin.exchanges[0].fundingRate * 100).toFixed(4);
      desp += `### ${coin.symbol} ${sign}${pct}%\n\n`;
      for (const ex of coin.exchanges) {
        const s = ex.fundingRate > 0 ? '+' : '';
        const p = (ex.fundingRate * 100).toFixed(4);
        desp += `- **${ex.exchange}** ${s}${p}%\n`;
      }
      desp += '\n';
    }

    if (errors.length > 0) {
      desp += `> 部分失败: ${errors.join(', ')}\n\n`;
    }

    const hour = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
    });
    return { title: `📊 ${hour} 资金费率 Top3`, desp };
  } catch {
    return null;
  }
}

/** Build economic calendar push: today's High/Medium USD events */
async function buildCalendarPush(): Promise<{ title: string; desp: string } | null> {
  try {
    const res = await fetch(CALENDAR_URL);
    const allEvents: EconomicEvent[] = await res.json();
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    const todayEvents = allEvents.filter((e) => {
      if (e.country !== 'USD') return false;
      if (e.impact !== 'High' && e.impact !== 'Medium') return false;
      const eventDate = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      return eventDate === todayStr;
    });

    if (todayEvents.length === 0) return null;

    let desp = '';
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

    const hour = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
    });
    return { title: `📅 ${hour} 今日经济日历`, desp };
  } catch {
    return null;
  }
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

    // 2) Hourly pushes only around minute 55 (wide tolerance for Vercel cron delay)
    if (bjMinute >= 50 || bjMinute <= 2) {
      // Funding rate: every hour
      const fundingPush = await buildFundingRatePush();
      if (fundingPush) {
        const r = await scSend(fundingPush.title, fundingPush.desp);
        results.push(`funding: ${r}`);
      }

      // Calendar: only at 20:00 and 22:00 (bjHour 19 and 21 when :55 triggers)
      if (bjHour === 19 || bjHour === 21) {
        const calendarPush = await buildCalendarPush();
        if (calendarPush) {
          const r = await scSend(calendarPush.title, calendarPush.desp);
          results.push(`calendar: ${r}`);
        }
      }
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
