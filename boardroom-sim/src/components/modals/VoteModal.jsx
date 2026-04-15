import React from 'react';
import { Vote, X, Plus, Sparkles, Loader2 } from 'lucide-react';

export default function VoteModal({ pendingVote, setPendingVote, runVote, onAISuggest, isLoadingAI = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="vote-modal-pop bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Vote size={18} className="text-indigo-400" />
            <h2 className="text-white font-bold text-base">Call a Vote</h2>
          </div>
          <button onClick={() => setPendingVote(null)} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {/* Motion */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Motion / Question</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-sm text-white focus:border-indigo-500 outline-none leading-relaxed resize-none"
              rows={3}
              value={pendingVote.proposal}
              onChange={(e) => setPendingVote({ ...pendingVote, proposal: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">Phrase it as a clear decision — e.g. <em>Should we approve the Q3 budget increase?</em></p>
          </div>

          {/* Vote Type Toggle */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Vote Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingVote({ ...pendingVote, options: [] })}
                className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${pendingVote.options.length === 0 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
              >
                Binary (Yes / No)
              </button>
              <button
                onClick={() => { if (pendingVote.options.length < 2) setPendingVote({ ...pendingVote, options: ['', ''] }); }}
                className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${pendingVote.options.length >= 2 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
              >
                Multi-Option
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {pendingVote.options.length === 0
                ? 'Simple yes/no — best for approve/reject decisions.'
                : 'Each member picks one option — best for choosing between distinct paths.'}
            </p>
          </div>

          {/* Options (multi-option mode) */}
          {pendingVote.options.length >= 2 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Options</label>
                <button
                  onClick={() => onAISuggest(pendingVote.proposal)}
                  disabled={isLoadingAI || !pendingVote.proposal.trim()}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
                  title="Let AI suggest options based on the discussion"
                >
                  {isLoadingAI ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  AI Suggest
                </button>
              </div>
              <p className="text-xs text-indigo-400/70 bg-indigo-950/30 border border-indigo-900/40 rounded px-3 py-2 mb-3">
                <Sparkles size={10} className="inline mr-1 opacity-70" />
                <strong>AI Suggest</strong> reads the last 15 messages and proposes options that fit the discussion — type a motion first, then click it.
              </p>
              <div className="space-y-2">
                {pendingVote.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                    <input
                      type="text"
                      placeholder={`Option ${String.fromCharCode(65 + i)}...`}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...pendingVote.options];
                        updated[i] = e.target.value;
                        setPendingVote({ ...pendingVote, options: updated });
                      }}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                    {pendingVote.options.length > 2 && (
                      <button
                        onClick={() => setPendingVote({ ...pendingVote, options: pendingVote.options.filter((_, j) => j !== i) })}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      ><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
              {pendingVote.options.length < 4 && (
                <button
                  onClick={() => setPendingVote({ ...pendingVote, options: [...pendingVote.options, ''] })}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> Add Option
                </button>
              )}
            </div>
          )}

          {/* Clarification */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Clarification note for the board <span className="text-gray-600 normal-case">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Focus on short-term cost implications..."
              value={pendingVote.clarification}
              onChange={(e) => setPendingVote({ ...pendingVote, clarification: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <button onClick={() => setPendingVote(null)} className="text-gray-500 hover:text-white text-sm font-bold transition-colors">Cancel</button>
          <button
            onClick={() => runVote(pendingVote)}
            disabled={pendingVote.options.length >= 2 && pendingVote.options.some(o => !o.trim())}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white px-6 py-2 rounded text-sm font-bold transition-colors"
          >
            <Vote size={14} /> Run Vote
          </button>
        </div>
      </div>
    </div>
  );
}
