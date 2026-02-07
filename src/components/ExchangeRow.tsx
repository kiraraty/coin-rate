'use client';

import type { ExchangeFundingRate } from '@/lib/types';

interface ExchangeRowProps {
  data: ExchangeFundingRate;
}

export default function ExchangeRow({ data }: ExchangeRowProps) {
  const ratePercent = (data.fundingRate * 100).toFixed(4);
  const dailyRate = (data.fundingRate * 3 * 100).toFixed(2);
  const isNegative = data.fundingRate < 0;

  const settlementTime = new Date(data.nextFundingTimestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const diff = data.nextFundingTimestamp - Date.now();
  const minutesLeft = Math.max(0, Math.floor(diff / 60_000));
  const secondsLeft = Math.max(0, Math.floor((diff % 60_000) / 1000));
  const countdown = `${minutesLeft}分${String(secondsLeft).padStart(2, '0')}秒后`;

  let volumeStr = '--';
  if (data.volume24h !== null) {
    if (data.volume24h >= 1_000_000) {
      volumeStr = (data.volume24h / 1_000_000).toFixed(2) + 'M';
    } else if (data.volume24h >= 1_000) {
      volumeStr = (data.volume24h / 1_000).toFixed(2) + 'K';
    } else {
      volumeStr = data.volume24h.toFixed(2);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3 last:border-b-0">
      <div className="flex-1">
        <div className="font-medium text-gray-800">{data.exchange}</div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{settlementTime}</span>
          <span className="text-blue-500">({countdown})</span>
        </div>
      </div>
      <div className="flex-1 text-center">
        <div className={`text-lg font-bold ${isNegative ? 'text-green-500' : 'text-red-500'}`}>
          {isNegative ? '' : '+'}{ratePercent}%
        </div>
        <div className="text-xs text-gray-400">日化 {dailyRate}%</div>
      </div>
      <div className="flex items-center gap-1 text-right">
        <div>
          <div className="text-sm text-gray-600">{volumeStr}</div>
          <div className="text-xs text-gray-400">24h量</div>
        </div>
        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
