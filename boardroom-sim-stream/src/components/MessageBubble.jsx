import React, { useState, useEffect } from 'react';
import { Gavel, AlertTriangle, Globe, Volume2, X, Copy, Check, Lock, Sparkles } from 'lucide-react';

// Renders a single message in the chat feed.
// Handles five variants: research, alert, error, upgrade, vote-result, and standard chat (user/assistant).
export default function MessageBubble({ msg, idx, onDismiss, onSpeak, isSpeaking = false, onOpenPricing }) {
  if (msg.type === 'research') return (
    <div className="msg-fade-in flex items-start gap-3 p-3 my-2 border border-cyan-900 rounded-lg bg-cyan-950/30">
      <div className="w-7 h-7 rounded-full bg-cyan-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Globe size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-cyan-400 uppercase mb-1 flex items-center gap-2">
          <span>Research Report</span>
          {msg.query && <span className="text-cyan-600 normal-case font-normal italic truncate">"{msg.query}"</span>}
        </div>
        {msg.headline && (
          <div className="text-sm font-semibold text-cyan-200 leading-snug mb-2">{msg.headline}</div>
        )}
        {msg.keyFacts?.length > 0 && (
          <ul className="mb-2 space-y-0.5">
            {msg.keyFacts.map((fact, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-gray-300 leading-relaxed">
                <span className="text-cyan-500 mt-1 flex-shrink-0">▸</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        )}
        {msg.context && (
          <div className="text-xs text-gray-400 italic leading-relaxed mb-1">{msg.context}</div>
        )}
        {msg.caveats && (
          <div className="text-[10px] text-yellow-600 leading-relaxed mb-1">⚠ {msg.caveats}</div>
        )}
        {/* fallback for old plain-text messages */}
        {msg.text && !msg.headline && (
          <div className="text-sm text-gray-300 leading-relaxed">{msg.text}</div>
        )}
        {msg.sources?.length > 0 && (
          <div className="mt-1.5 text-[10px] text-cyan-700">
            via Google Search: {msg.sources.join(', ')}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(idx)}
        className="text-cyan-800 hover:text-cyan-500 transition-colors flex-shrink-0 mt-0.5"
        title="Dismiss research"
      >
        <X size={14} />
      </button>
    </div>
  );

  if (msg.type === 'alert') return (
    <div className="msg-fade-in flex items-center justify-center p-2 my-2 text-xs font-bold text-red-400 border border-red-900 rounded bg-red-900/20">
      <Gavel className="w-4 h-4 mr-2" /> {msg.text}
    </div>
  );

  if (msg.type === 'error') return (
    <div className="msg-fade-in flex items-center justify-center p-2 my-2 text-xs font-bold text-yellow-500 border border-yellow-900 rounded bg-yellow-900/20">
      <AlertTriangle className="w-4 h-4 mr-2" /> {msg.text}
    </div>
  );

  if (msg.type === 'upgrade') return (
    <div className="msg-fade-in my-3 p-4 rounded-lg border border-indigo-500/40 bg-indigo-950/40 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lock size={14} className="text-indigo-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">
            {msg.plan === 'pro' ? 'Pro Plan Limit Reached' : 'Free Plan Limit Reached'}
          </div>
          <div className="text-sm text-gray-300 leading-snug">
            {msg.plan === 'pro'
              ? "You've used all your credits for this billing cycle. Upgrade to Pioneer for unlimited credits."
              : "You've used all your free credits for this month. Upgrade to Pro or Pioneer to keep the conversation going."}
          </div>
        </div>
      </div>
      {onOpenPricing && (
        <button
          onClick={onOpenPricing}
          className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded text-xs flex items-center justify-center gap-2 transition-all"
        >
          <Sparkles size={13} fill="white" /> Upgrade Your Plan
        </button>
      )}
    </div>
  );

  if (msg.type === 'vote-result') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [barsRevealed, setBarsRevealed] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [verdictRevealed, setVerdictRevealed] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [detailsRevealed, setDetailsRevealed] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const t0 = setTimeout(() => setBarsRevealed(true), 60);
      const t1 = setTimeout(() => setVerdictRevealed(true), 800);
      const t2 = setTimeout(() => setDetailsRevealed(true), 1400);
      return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
    }, []);

    const CopyVoteButton = () => {
      const [copied, setCopied] = useState(false);
      const handleCopy = () => {
        const isMultiLocal = msg.options && msg.options.length >= 2;
        const tallyLocal = isMultiLocal ? (() => {
          const t = {};
          msg.options.forEach((_, i) => { t[String.fromCharCode(65 + i)] = 0; });
          msg.details.forEach(r => { if (t[r.vote] !== undefined) t[r.vote]++; });
          return t;
        })() : null;
        const winnerKeyLocal = (isMultiLocal && !msg.isTie)
          ? Object.keys(tallyLocal).reduce((a, b) => tallyLocal[a] > tallyLocal[b] ? a : b)
          : null;

        const lines = [];
        if (msg.proposal) lines.push(`Motion: "${msg.proposal}"\n`);
        lines.push('--- Vote Results ---');
        if (isMultiLocal) {
          msg.options.forEach((opt, i) => {
            const key = String.fromCharCode(65 + i);
            lines.push(`${key}. ${opt} — ${tallyLocal[key]} vote${tallyLocal[key] !== 1 ? 's' : ''}${key === winnerKeyLocal ? ' ✓ WINNER' : ''}`);
          });
          lines.push('');
        }
        msg.details.forEach(v => lines.push(`${v.member}: ${v.vote} — "${v.reason}"`));
        if (msg.resolution) lines.push(`\nResolution: ${msg.resolution}`);

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      };
      return (
        <button
          onClick={handleCopy}
          className="opacity-50 hover:opacity-100 transition-opacity p-1 hover:text-indigo-300"
          title="Copy vote results"
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
        </button>
      );
    };

    const isMulti = msg.options && msg.options.length >= 2;
    const isTie = isMulti && msg.isTie;
    const tiedKeys = isTie ? (msg.tiedKeys || []) : [];
    const tally = isMulti ? (() => {
      const t = {};
      msg.options.forEach((_, i) => { t[String.fromCharCode(65 + i)] = 0; });
      msg.details.forEach(r => { if (t[r.vote] !== undefined) t[r.vote]++; });
      return t;
    })() : null;
    // Only declare a single winner if there's no tie
    const winnerKey = (isMulti && !isTie) ? Object.keys(tally).reduce((a, b) => tally[a] > tally[b] ? a : b) : null;
    const optionColors = ['bg-indigo-600', 'bg-purple-600', 'bg-pink-600', 'bg-orange-600'];
    return (
      <div className={`msg-slide-left p-4 my-4 border rounded-lg bg-gray-800/80 ${isTie ? 'border-amber-800' : 'border-gray-700'}`}>
        {msg.proposal && (
          <div className="mb-3 p-3 bg-indigo-900/30 border border-indigo-800 rounded">
            <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Motion on the Table</div>
            <div className="text-sm text-white italic">"{msg.proposal}"</div>
          </div>
        )}
        <h3 className="mb-3 text-sm font-bold text-white uppercase border-b border-gray-700 pb-2 flex items-center gap-2">
          <span>Vote Results</span><CopyVoteButton />
        </h3>

        {verdictRevealed && (
          <div className={`vote-verdict-banner mb-3 py-3 rounded-lg text-center font-black text-xl tracking-widest shadow-lg ${
            isMulti
              ? isTie ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                      : 'bg-green-900/60 text-green-300 border border-green-700'
              : msg.text.includes('PASSED')
                ? 'bg-green-900/60 text-green-300 border border-green-700'
                : 'bg-red-900/60 text-red-300 border border-red-700'
          }`}>
            {isMulti
              ? isTie ? '⚖ DEADLOCK — TIED' : `✓ OPTION ${winnerKey} WINS`
              : msg.text.includes('PASSED') ? '✅ MOTION PASSED' : '❌ MOTION REJECTED'}
          </div>
        )}

        {/* Multi-option tally */}
        {isMulti && (
          <div className="mb-4 space-y-2">
            {isTie && (
              <div className="text-xs font-bold text-center py-1.5 px-3 rounded bg-amber-900/40 text-amber-300 border border-amber-700 mb-3">
                DEADLOCK — Options {tiedKeys.map(k => `${k} — "${msg.options[k.charCodeAt(0) - 65]}"`).join(', ')} tied with {tally[tiedKeys[0]]} vote{tally[tiedKeys[0]] !== 1 ? 's' : ''} each
              </div>
            )}
            {msg.options.map((opt, i) => {
              const key = String.fromCharCode(65 + i);
              const count = tally[key] || 0;
              const pct = msg.details.length > 0 ? Math.round((count / msg.details.length) * 100) : 0;
              const isTiedOption = isTie && tiedKeys.includes(key);
              const isWinner = !isTie && key === winnerKey;
              return (
                <div key={i}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className={isWinner ? 'text-white font-bold' : isTiedOption ? 'text-amber-300 font-bold' : 'text-gray-400'}>
                      <span className="font-bold mr-1">{key}.</span>{opt}
                      {isWinner && <span className="ml-2 text-green-400 text-[9px]">✓ WINNER</span>}
                      {isTiedOption && <span className="ml-2 text-amber-400 text-[9px]">⚖ TIED</span>}
                    </span>
                    <span className={isWinner ? 'text-green-400 font-bold' : isTiedOption ? 'text-amber-400 font-bold' : 'text-gray-400'}>{count} vote{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isWinner ? 'bg-green-500' : isTiedOption ? 'bg-amber-500' : optionColors[i % optionColors.length]}`} style={{ width: barsRevealed ? `${pct}%` : '0%', transitionDelay: `${i * 90}ms` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Per-member breakdown */}
        <div className="space-y-2">
          {msg.details.map((vote, i) => {
            const isYes = vote.vote === 'YES';
            const isNo = vote.vote === 'NO';
            const isTiedVote = isTie && tiedKeys.includes(vote.vote);
            const voteColor = isMulti
              ? (isTiedVote ? 'bg-amber-900 text-amber-300' : vote.vote === winnerKey ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400')
              : (isYes ? 'bg-green-900 text-green-300' : isNo ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-400');
            return (
              <div key={i} className="flex items-center justify-between text-sm"
                style={{
                  opacity: detailsRevealed ? 1 : 0,
                  transform: detailsRevealed ? 'translateX(0)' : 'translateX(-10px)',
                  transition: `opacity 0.2s ease-out ${i * 80}ms, transform 0.2s ease-out ${i * 80}ms`,
                }}>
                <span className="text-gray-400 w-24">{vote.member}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold w-12 text-center ${voteColor}`}>{vote.vote}</span>
                <span className="text-gray-400 italic flex-1 ml-4 truncate">"{vote.reason}"</span>
              </div>
            );
          })}
        </div>

        {msg.resolution && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="text-xs font-bold text-indigo-400 uppercase mb-1">Official Resolution</div>
            <div className="text-xs text-gray-300 italic bg-gray-900 p-2 rounded border border-gray-700">{msg.resolution}</div>
          </div>
        )}
      </div>
    );
  }

  // Standard chat bubble (user or assistant)
  const isUser = msg.role === 'user';
  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end msg-slide-right' : 'justify-start msg-slide-left'}`}>
      {!isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 shadow-lg flex-shrink-0 ${msg.avatar || 'bg-gray-600'}${isSpeaking ? ' speaking-ripple' : ''}`}>{msg.sender[0]}</div>
      )}
      <div className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-lg text-sm shadow-md transition-colors ${isUser ? 'bg-blue-600 text-white rounded-br-none' : `bg-gray-800 border text-gray-200 rounded-bl-none ${isSpeaking ? 'border-violet-500/60 bg-gray-800/80 shadow-violet-900/30 shadow-lg' : 'border-gray-700'}`}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-bold text-gray-400">{msg.sender}{msg.senderRole && <span className="font-normal opacity-75"> · {msg.senderRole}</span>}</div>
          <button
            onClick={() => onSpeak(idx)}
            className="opacity-50 hover:opacity-100 transition-opacity p-1 hover:text-indigo-300"
            title="Read aloud from here"
          >
            <Volume2 size={12} />
          </button>
        </div>
        {msg.text}
      </div>
    </div>
  );
}
