import React, { useState, useCallback, useRef } from 'react';

const REACTION_POOLS = {
  vote:         ['🗳️', '⚖️', '🔨', '🏛️', '📊'],
  voteResult:   ['🎉', '🎊', '✅', '🏆', '🥂', '🎶'],
  voteRejected: ['❌', '🚫', '📉', '😬', '🤔'],
  research:     ['🔍', '📚', '💡', '🔬', '📡'],
  speakerPick:  ['🎤', '💬', '🗣️', '✨', '👏'],
  memberRequest:['🙋', '📣', '🔔', '⚡', '💥'],
  receive:      ['💭', '🤖', '⚙️', '🧠', '💫'],
};

export function useFloatingReactions() {
  const triggerRef = useRef(null);
  const trigger = useCallback((type, count = 6) => {
    triggerRef.current?.(type, count);
  }, []);
  return { trigger, triggerRef };
}

export default function FloatingReactions({ triggerRef }) {
  const [reactions, setReactions] = useState([]);
  const nextId = useRef(0);

  triggerRef.current = (type, count = 6) => {
    const pool = REACTION_POOLS[type] || REACTION_POOLS.receive;
    const burst = Array.from({ length: count }, () => ({
      id: nextId.current++,
      emoji: pool[Math.floor(Math.random() * pool.length)],
      x: 10 + Math.random() * 80,
      duration: 2200 + Math.random() * 1000,
      size: 20 + Math.floor(Math.random() * 20),
      delay: Math.random() * 400,
    }));
    setReactions(prev => [...prev, ...burst]);
    setTimeout(() => {
      const ids = new Set(burst.map(r => r.id));
      setReactions(prev => prev.filter(r => !ids.has(r.id)));
    }, 3600);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {reactions.map(r => (
        <div
          key={r.id}
          className="float-reaction absolute bottom-0"
          style={{
            left: `${r.x}%`,
            fontSize: `${r.size}px`,
            animationDuration: `${r.duration}ms`,
            animationDelay: `${r.delay}ms`,
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
}
