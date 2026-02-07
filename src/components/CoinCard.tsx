'use client';

import { useState } from 'react';
import type { CoinGroup } from '@/lib/types';
import ExchangeRow from './ExchangeRow';
import CountdownTimer from './CountdownTimer';

interface CoinCardProps {
  coin: CoinGroup;
  rank: number;
}

const RANK_COLORS = ['bg-yellow-400', 'bg-blue-400', 'bg-orange-400'];

export default function CoinCard({ coin, rank }: CoinCardProps) {
  const [expanded, setExpanded] = useState(false);
  const topExchange = coin.exchanges[0];
  const restExchanges = coin.exchanges.slice(1);
  const hasMore = restExchanges.length > 0;

  const rankColor = rank <= 3 ? RANK_COLORS[rank - 1] : 'bg-gray-300';

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${rankColor}`}>
            {rank}
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800">{coin.symbol}</div>
            <div className="text-xs text-gray-400">{coin.exchangeCount} 个交易所</div>
          </div>
        </div>
        <CountdownTimer targetTimestamp={coin.nextSettlement} />
      </div>

      {/* Top exchange always visible */}
      {topExchange && <ExchangeRow data={topExchange} />}

      {/* Expand/collapse for remaining exchanges */}
      {hasMore && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            <span>{expanded ? '收起' : `查看其他 ${restExchanges.length} 个交易所`}</span>
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded && restExchanges.map((ex, i) => (
            <ExchangeRow key={`${ex.exchangeId}-${i}`} data={ex} />
          ))}
        </>
      )}
    </div>
  );
}
