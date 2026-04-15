import React from 'react';

/**
 * Sticky top banner that stays on screen for the full duration of an active session.
 * Shows the current topic prominently so viewers always know what's being discussed.
 */
export default function ActiveTopicBanner({ topic }) {
  if (!topic) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[55] pointer-events-none select-none">
      <div className="w-full bg-gray-950/95 border-b border-indigo-700/50 backdrop-blur-md px-4 py-2.5 flex items-center gap-3">
        {/* Live pill */}
        <div className="flex items-center gap-1.5 shrink-0 bg-indigo-600/20 border border-indigo-600/40 rounded-full px-2.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest">Topic</span>
        </div>

        {/* Topic text */}
        <p className="text-white font-bold text-base sm:text-lg leading-tight truncate flex-1">
          "{topic.request_text}"
        </p>

        {/* Submitted by */}
        <span className="text-gray-400 text-xs font-medium shrink-0 hidden sm:block">
          by <span className="text-gray-200">{topic.viewer_name}</span>
        </span>
      </div>
    </div>
  );
}
