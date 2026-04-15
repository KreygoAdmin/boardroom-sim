import React, { useEffect, useRef, useState } from 'react';

export default function CountdownWidget({ sessionRemaining, sessionTotal }) {
  const [displayed, setDisplayed] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const prevRef = useRef(null);

  // Sync from server value — resync whenever the server sends a new number
  useEffect(() => {
    if (sessionRemaining == null) { setDisplayed(null); return; }
    setDisplayed(sessionRemaining);
  }, [sessionRemaining]);

  // Local tick — counts down every second independently of server updates
  useEffect(() => {
    if (displayed == null) return;
    if (displayed <= 0) return;
    const id = setInterval(() => setDisplayed(d => (d != null && d > 0 ? d - 1 : d)), 1000);
    return () => clearInterval(id);
  }, [displayed == null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Milestone flashes (based on server value so they fire at accurate boundaries)
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = sessionRemaining;
    if (prev == null || sessionRemaining == null) return;
    if      (prev > 300 && sessionRemaining <= 300) setMilestone('warn');
    else if (prev > 60  && sessionRemaining <= 60)  setMilestone('warn');
    else if (prev > 30  && sessionRemaining <= 30)  setMilestone('warn');
    else return;
    const t = setTimeout(() => setMilestone(null), 700);
    return () => clearTimeout(t);
  }, [sessionRemaining]);

  if (displayed == null) return null;

  const pct = sessionTotal > 0 ? Math.max(0, Math.min(100, (displayed / sessionTotal) * 100)) : 0;
  const isRed    = displayed <= 60;
  const isYellow = !isRed && displayed <= 300;
  const color = isRed
    ? { text: 'text-red-400',     bar: 'bg-red-500',     border: 'border-red-700/60',     bg: 'bg-red-950/80'     }
    : isYellow
    ? { text: 'text-yellow-400',  bar: 'bg-yellow-400',  border: 'border-yellow-700/60',  bg: 'bg-yellow-950/80'  }
    : { text: 'text-emerald-400', bar: 'bg-emerald-500', border: 'border-emerald-800/60', bg: 'bg-emerald-950/60' };

  const m = Math.floor(displayed / 60);
  const s = displayed % 60;

  return (
    <div className={`fixed top-16 right-4 z-50 pointer-events-none select-none countdown-enter ${milestone ? 'countdown-milestone' : ''}`}>
      <div className={`${color.bg} ${color.border} border rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[120px]`}>
        <div className={`font-mono font-black tabular-nums text-4xl leading-none text-center tracking-tight ${color.text} ${isRed ? 'animate-pulse' : ''}`}>
          {m}:{String(s).padStart(2, '0')}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-center mt-1 opacity-50 text-gray-300">
          Session Time
        </div>
        <div className="mt-2 h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${color.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
