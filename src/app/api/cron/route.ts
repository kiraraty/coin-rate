import { NextResponse } from 'next/server';
import { fetchAllExchanges, aggregateRates } from '@/lib/fetcher';
import type { EconomicEvent } from '@/lib/types';

export const maxDuration = 60;

const SC_SENDKEY = process.env.SC_SENDKEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

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

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SC_SENDKEY) {
    return NextResponse.json({ error: 'SC_SENDKEY not configured' }, { status: 500 });
  }

  // Check Beijing time window: 6:00 - 2:00 (next day)
  const bjHour = Number(
    new Date().toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Shanghai' })
  );
  if (bjHour >= 2 && bjHour < 6) {
    return NextResponse.json({ skipped: true, reason: `Beijing time ${bjHour}:00, outside 06:00-02:00 window` });
  }

  try {
    // Fetch funding rates and economic calendar in parallel
    const [fundingResult, calendarResult] = await Promise.allSettled([
      fetchAllExchanges(),
      fetch(CALENDAR_URL).then((r) => r.json() as Promise<EconomicEvent[]>),
    ]);

    let desp = '';

    // Build funding rate section
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

    // Build economic calendar section
    desp += '---\n\n## 今日经济日历\n\n';
    if (calendarResult.status === 'fulfilled') {
      const allEvents = calendarResult.value;
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

      // Filter USD, today, High/Medium impact
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

    // Build title
    const hour = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
    });
    const title = `📊 ${hour} 资金费率 & 经济日历`;

    const result = await scSend(title, desp);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
