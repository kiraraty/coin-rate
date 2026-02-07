'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer({ targetTimestamp }: { targetTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const diff = targetTimestamp - Date.now();
      if (diff <= 0) {
        setTimeLeft('已结算');
        return;
      }
      const hours = Math.floor(diff / 3600_000);
      const minutes = Math.floor((diff % 3600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      if (hours > 0) {
        setTimeLeft(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      } else {
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return (
    <div className="text-right">
      <div className="text-lg font-bold text-blue-500">{timeLeft}</div>
      <div className="text-xs text-gray-400">距结算</div>
    </div>
  );
}
