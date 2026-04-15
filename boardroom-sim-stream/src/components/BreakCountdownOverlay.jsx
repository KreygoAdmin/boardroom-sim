import React, { useEffect, useState } from 'react';

/**
 * Full-screen overlay shown between sessions during the 15-minute break.
 * Displays a large countdown so viewers always know when the next topic starts.
 */
export default function BreakCountdownOverlay({ breakRemaining }) {
  const [displayed, setDisplayed] = useState(null);

  // Sync from server value
  useEffect(() => {
    if (!breakRemaining || breakRemaining.remaining_seconds <= 0) { setDisplayed(null); return; }
    setDisplayed(breakRemaining.remaining_seconds);
  }, [breakRemaining?.remaining_seconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local tick every second
  useEffect(() => {
    if (displayed == null || displayed <= 0) return;
    const id = setInterval(() => setDisplayed(d => (d != null && d > 0 ? d - 1 : d)), 1000);
    return () => clearInterval(id);
  }, [displayed == null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (displayed == null || displayed <= 0) return null;

  const total_seconds = breakRemaining?.total_seconds ?? displayed;
  const pct = Math.max(0, (displayed / total_seconds) * 100);

  const mins = Math.floor(displayed / 60);
  const secs = displayed % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  const isUnderFive  = displayed <= 300; // last 5 min
  const isUnderOne   = displayed <= 60;  // last 1 min
  const isUnderTen   = displayed <= 10;  // final 10s

  const color = isUnderTen
    ? { text: 'text-red-400',    bar: 'bg-red-500',    border: 'border-red-700/50',    bg: 'bg-red-950/80'    }
    : isUnderOne
    ? { text: 'text-orange-400', bar: 'bg-orange-500', border: 'border-orange-700/50', bg: 'bg-orange-950/80' }
    : isUnderFive
    ? { text: 'text-yellow-400', bar: 'bg-yellow-400', border: 'border-yellow-700/50', bg: 'bg-yellow-950/80' }
    : { text: 'text-indigo-300', bar: 'bg-indigo-500', border: 'border-indigo-700/50', bg: 'bg-indigo-950/60' };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none select-none">
      {/* Soft dark backdrop — not totally black so chat is still faintly visible */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">

        {/* Heading */}
        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-800/90 border border-gray-600/60 rounded-full shadow-lg">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-gray-300 text-xs font-black uppercase tracking-[0.2em]">Taking a Break</span>
          </div>
          <p className="text-gray-300 text-lg font-semibold mt-1">
            Next topic coming up — hang tight!
          </p>
        </div>

        {/* Countdown clock */}
        <div className={`${color.bg} ${color.border} border rounded-3xl px-12 py-6 shadow-2xl backdrop-blur-md`}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-center mb-1 opacity-60 text-gray-300">
            Next Topic In
          </div>
          <div className={`font-mono font-black tabular-nums leading-none text-center tracking-tight text-7xl sm:text-8xl transition-all duration-300 ${color.text} ${isUnderTen ? 'animate-pulse' : ''}`}>
            {timeStr}
          </div>
          <div className="mt-4 h-2 bg-gray-800/60 rounded-full overflow-hidden w-48 sm:w-64 mx-auto">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${color.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Chat nudge */}
        <p className="text-gray-500 text-sm font-medium">
          Chat in Twitch while you wait ·{' '}
          <span className="text-indigo-400 font-semibold">submit a topic to jump the queue</span>
        </p>

      </div>
    </div>
  );
}
