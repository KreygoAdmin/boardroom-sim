import React, { useState } from 'react';
import { Vote, Search, HelpCircle, X, Check } from 'lucide-react';

/**
 * Displayed when an AI board member requests a vote, research, or asks the user a question.
 * pendingMemberAction shape:
 *   { type: 'vote'|'research'|'question', member: memberObj, proposal?: string, query?: string, question?: string }
 */
export default function MemberActionRequest({ pendingMemberAction, onAccept, onDeny }) {
  const [answerText, setAnswerText] = useState('');

  if (!pendingMemberAction) return null;

  const { type, member, proposal, query, question } = pendingMemberAction;
  const isVote = type === 'vote';
  const isQuestion = type === 'question';

  const accentColor = isVote ? 'indigo' : isQuestion ? 'amber' : 'emerald';
  const Icon = isVote ? Vote : isQuestion ? HelpCircle : Search;
  const heading = isVote ? 'Calling for a Vote' : isQuestion ? 'Has a Question' : 'Requesting Research';
  const body = isVote ? proposal : isQuestion ? question : query;
  const bodyLabel = isVote ? 'Proposed motion:' : isQuestion ? 'Question:' : 'Research query:';
  const acceptLabel = isVote ? 'Open Vote' : isQuestion ? 'Answer' : 'Run Research';

  const handleAccept = () => {
    if (isQuestion) {
      if (!answerText.trim()) return;
      onAccept(answerText.trim());
    } else {
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDeny}
      />

      {/* Card */}
      <div className="vote-modal-pop relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">

        {/* Header strip */}
        <div className={`px-5 py-3 bg-${accentColor}-900/40 border-b border-${accentColor}-800/50 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2">
            <Icon size={15} className={`text-${accentColor}-400 flex-shrink-0`} />
            <span className={`text-${accentColor}-300 text-xs font-bold uppercase tracking-wider`}>{heading}</span>
          </div>
          <button
            onClick={onDeny}
            className="text-gray-500 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Who is requesting */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-9 h-9 rounded-full ${member.avatar} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
              {member.name[0]}
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{member.name}</p>
              <p className="text-gray-400 text-xs">{member.role}</p>
            </div>
          </div>

          {/* The request */}
          <div className={`bg-gray-800 border border-${accentColor}-900/50 rounded-lg p-3 mb-4`}>
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">{bodyLabel}</p>
            <p className="text-gray-200 text-sm leading-relaxed">{body}</p>
          </div>

          {/* Answer input for questions */}
          {isQuestion && (
            <textarea
              className="w-full bg-gray-800 border border-gray-600 focus:border-amber-500 rounded-lg px-3 py-2 text-gray-200 text-sm resize-none outline-none transition-colors mb-4"
              rows={3}
              placeholder="Type your answer..."
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAccept(); } }}
              autoFocus
            />
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={isQuestion && !answerText.trim()}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-${accentColor}-600 hover:bg-${accentColor}-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors`}
            >
              <Check size={14} />
              {acceptLabel}
            </button>
            <button
              onClick={onDeny}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-sm font-semibold transition-colors"
            >
              <X size={14} />
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
