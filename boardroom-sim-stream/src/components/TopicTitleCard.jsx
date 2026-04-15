import React, { useState, useEffect, useRef } from 'react';

const DISPLAY_DURATION = 60; // seconds

export default function TopicTitleCard({ pendingTopic, onClear }) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState(null);
  const [countdown, setCountdown] = useState(DISPLAY_DURATION);
  const [milestone, setMilestone] = useState(false);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!pendingTopic) return;
    setDisplayed(pendingTopic);
    setVisible(true);
    setCountdown(DISPLAY_DURATION);
    setMilestone(false);

    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);

    let remaining = DISPLAY_DURATION;

    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      // Trigger milestone bounce on dramatic moments
      if ([10, 5, 3, 2, 1].includes(remaining)) {
        setMilestone(true);
        setTimeout(() => setMilestone(false), 650);
      }

      if (remaining <= 0) clearInterval(intervalRef.current);
    }, 1000);

    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setDisplayed(null);
        onClear?.();
      }, 600);
    }, DISPLAY_DURATION * 1000);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);
    };
  }, [pendingTopic]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!displayed) return null;

  const isRed    = countdown <= 5;
  const isOrange = !isRed && countdown <= 10;
  const isYellow = !isRed && !isOrange && countdown <= 20;

  const color = isRed
    ? { text: 'text-red-400',    bar: 'bg-red-500',    border: 'border-red-700/60',    bg: 'bg-red-950/80'    }
    : isOrange
    ? { text: 'text-orange-400', bar: 'bg-orange-500', border: 'border-orange-700/60', bg: 'bg-orange-950/80' }
    : isYellow
    ? { text: 'text-yellow-400', bar: 'bg-yellow-400', border: 'border-yellow-700/60', bg: 'bg-yellow-950/80' }
    : { text: 'text-emerald-400', bar: 'bg-emerald-500', border: 'border-emerald-800/60', bg: 'bg-emerald-950/60' };

  const pct = Math.max(0, (countdown / DISPLAY_DURATION) * 100);
  const numSize = isRed ? 'text-7xl' : isOrange ? 'text-6xl' : 'text-5xl';

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center pointer-events-none select-none ${visible ? 'topic-card-enter' : 'topic-card-exit'}`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 max-w-2xl w-full mx-6 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600/90 rounded-full mb-4 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-xs font-black uppercase tracking-[0.2em]">New Topic</span>
        </div>

        {/* Topic text */}
        <div className="text-3xl sm:text-4xl font-black text-white leading-tight drop-shadow-2xl mb-3 px-2">
          "{displayed.request_text}"
        </div>

        {/* Submitted by */}
        <div className="text-indigo-300 text-sm font-semibold mb-8">
          Submitted by <span className="text-white font-bold">{displayed.viewer_name}</span>
        </div>

        {/* Countdown — same vibe as the session timer */}
        <div className={`inline-block ${color.bg} ${color.border} border rounded-2xl px-8 py-4 shadow-2xl backdrop-blur-md ${milestone ? 'countdown-milestone' : ''}`}>
          <div className="text-[9px] font-bold uppercase tracking-widest text-center mb-1 opacity-60 text-gray-300">
            Starting In
          </div>
          <div className={`font-mono font-black tabular-nums leading-none text-center tracking-tight transition-all duration-300 ${numSize} ${color.text} ${isRed ? 'animate-pulse' : ''}`}>
            {countdown}
          </div>
          <div className="mt-3 h-1.5 bg-gray-800/60 rounded-full overflow-hidden w-36 mx-auto">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${color.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
