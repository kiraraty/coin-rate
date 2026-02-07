'use client';

import { useState } from 'react';
import FundingRatePanel from '@/components/FundingRatePanel';
import EconomicCalendar from '@/components/EconomicCalendar';

type Tab = 'funding' | 'calendar';

export default function Home() {
  const [tab, setTab] = useState<Tab>('funding');

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-6">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setTab('funding')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'funding'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          资金费率
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'calendar'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          经济日历
        </button>
      </div>

      {/* Tab content */}
      {tab === 'funding' && <FundingRatePanel />}
      {tab === 'calendar' && <EconomicCalendar />}
    </div>
  );
}
