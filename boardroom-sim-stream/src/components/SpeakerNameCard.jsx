import React, { useState, useEffect, useRef } from 'react';

export default function SpeakerNameCard({ processingStage, boardMembers }) {
  const [card, setCard] = useState(null);
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef(null);
  const prevStageRef = useRef('');

  useEffect(() => {
    if (!processingStage?.toLowerCase().includes('is speaking')) return;
    if (processingStage === prevStageRef.current) return;
    prevStageRef.current = processingStage;

    const member = boardMembers?.find(m =>
      processingStage.toLowerCase().includes(m.name.toLowerCase())
    );
    if (!member) return;

    clearTimeout(dismissRef.current);
    setCard({ name: member.name, role: member.role, avatar: member.avatar });
    setVisible(true);
    dismissRef.current = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(dismissRef.current);
  }, [processingStage, boardMembers]);

  if (!card) return null;

  return (
    <div
      className={`fixed bottom-24 left-1/2 z-50 pointer-events-none select-none ${visible ? 'lower-third-enter' : 'lower-third-exit'}`}
    >
      <div className="flex items-center gap-3 px-5 py-3 bg-gray-950/95 border-l-4 border-violet-500 rounded-r-xl shadow-2xl backdrop-blur-sm">
        <div className={`w-10 h-10 rounded-full ${card.avatar} flex items-center justify-center text-sm font-black text-white shadow-lg flex-shrink-0`}>
          {card.name[0]}
        </div>
        <div>
          <div className="text-white font-bold text-lg leading-tight">{card.name}</div>
          <div className="text-violet-400 text-xs font-semibold uppercase tracking-wider">{card.role}</div>
        </div>
        <div className="ml-2 flex items-end gap-px" style={{ height: '16px' }}>
          {[5, 14, 9, 12, 7].map((h, i) => (
            <span
              key={i}
              className="w-1 bg-violet-400 rounded-sm origin-bottom"
              style={{ height: `${h}px`, animation: `audiobar 0.7s ease-in-out ${i * 0.12}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
