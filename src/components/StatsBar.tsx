'use client';

interface StatsBarProps {
  totalCoins: number;
  totalExchanges: number;
  lastUpdated: string;
}

export default function StatsBar({ totalCoins, totalExchanges, lastUpdated }: StatsBarProps) {
  const updateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="grid grid-cols-3 gap-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="text-center">
        <div className="text-xs text-gray-400">币种数量</div>
        <div className="text-2xl font-bold text-blue-600">{totalCoins}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400">交易所覆盖</div>
        <div className="text-2xl font-bold text-gray-800">{totalExchanges}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400">更新时间</div>
        <div className="text-2xl font-bold text-gray-800">{updateTime}</div>
      </div>
    </div>
  );
}
