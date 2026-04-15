import React, { useState, useEffect } from 'react';
import { Vote, Search, HelpCircle, Check, X } from 'lucide-react';

function TokenGate({ onUnlock }) {
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sessionStorage.setItem('streamer_token', input.trim());
    onUnlock();
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-lg font-bold text-white text-center tracking-wide">Streamer Panel</h1>
        <p className="text-gray-400 text-sm text-center">Enter your streamer token to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Token"
            autoFocus
            className={`w-full bg-gray-800 border ${shake ? 'border-red-500' : 'border-gray-600'} rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500`}
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Unlock
          </button>
        </form>
        <p className="text-xs text-gray-600 text-center">Token is stored in sessionStorage only — never compiled into the app.</p>
      </div>
    </div>
  );
}

function MemberActionBanner({ action, isPending }) {
  const isVote = action.type === 'vote';
  const isQuestion = action.type === 'question';
  const Icon = isVote ? Vote : isQuestion ? HelpCircle : Search;
  const label = isVote ? 'Calling for a vote' : isQuestion ? 'Has a question' : 'Requesting research';
  const body = action.proposal || action.query || action.question || '';
  const handledLabel = action.handled === 'denied' ? 'Auto-denied' : 'Auto-accepted';

  const borderColor = isPending
    ? (isVote ? 'border-indigo-600' : isQuestion ? 'border-amber-600' : 'border-emerald-600')
    : (action.handled === 'denied' ? 'border-gray-700' : 'border-gray-700');

  const accentText = isVote ? 'text-indigo-400' : isQuestion ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className={`bg-gray-900 border ${borderColor} rounded-xl p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={13} className={accentText} />
          <span className={`text-xs font-bold uppercase tracking-wider ${accentText}`}>{label}</span>
        </div>
        {isPending ? (
          <span className="text-xs bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded-full animate-pulse">
            Pending — auto-handling in 1.5s
          </span>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
            action.handled === 'denied'
              ? 'bg-gray-800 text-gray-400'
              : 'bg-green-900/60 text-green-300'
          }`}>
            {action.handled === 'denied' ? <X size={10} /> : <Check size={10} />}
            {handledLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full ${action.member.avatar} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
          {action.member.name[0]}
        </div>
        <div>
          <p className="text-white text-xs font-semibold">{action.member.name}</p>
          <p className="text-gray-500 text-[10px]">{action.member.role}</p>
        </div>
      </div>

      {body && (
        <p className="text-gray-400 text-xs leading-relaxed bg-gray-800 rounded px-3 py-2">
          {body}
        </p>
      )}
    </div>
  );
}

/**
 * Streamer control overlay. Rendered at /streamer route — NOT in the OBS-captured main view.
 * Shows queue, timer, auto-handled member actions, and manual override controls.
 */
export default function StreamerPanel({
  isConnected,
  queue,
  streamOnline,
  automationPaused,
  sessionActive,
  timerExtendedBy,
  sessionRemaining = null,
  sessionTotal = null,
  agentStatus = null,
  pendingMemberAction = null,
  lastAutoAction = null,
  sessionDurationSeconds = 900,
  onSkip,
  onEndNow,
  onExtend,
  onPause,
  onResume,
}) {
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem('streamer_token'));
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [extending, setExtending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [visibleAutoAction, setVisibleAutoAction] = useState(null);

  // Defined before early return so useEffect closures always have it in scope
  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  // Show timer extended notification
  useEffect(() => {
    if (unlocked && timerExtendedBy) {
      showFeedback(`+${Math.round(timerExtendedBy / 60)} min added`);
    }
  }, [unlocked, timerExtendedBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep last auto action visible for 8 seconds after it's handled
  useEffect(() => {
    if (!lastAutoAction) return;
    setVisibleAutoAction(lastAutoAction);
    const timer = setTimeout(() => setVisibleAutoAction(null), 8000);
    return () => clearTimeout(timer);
  }, [lastAutoAction]);

  if (!unlocked) return <TokenGate onUnlock={() => setUnlocked(true)} />;

  const handleSkip = async () => {
    if (!confirmSkip) { setConfirmSkip(true); return; }
    setConfirmSkip(false);
    const result = await onSkip();
    showFeedback(result?.refunded ? 'Skipped + refunded' : 'Skipped');
  };

  const handleEndNow = async () => {
    await onEndNow();
    showFeedback('Ending session...');
  };

  const handleExtend = async (mins) => {
    setExtending(true);
    await onExtend(mins * 60);
    setExtending(false);
    showFeedback(`+${mins} min`);
  };

  const handlePauseResume = async () => {
    if (automationPaused) {
      await onResume();
      showFeedback('Automation resumed');
    } else {
      await onPause();
      showFeedback('Automation paused');
    }
  };

  const total = sessionTotal ?? sessionDurationSeconds;
  const remaining = sessionRemaining !== null ? Math.max(0, sessionRemaining) : total;
  const remainingMins = Math.floor(remaining / 60);
  const remainingSecs = remaining % 60;
  const timerPct = Math.min(100, ((total - remaining) / total) * 100);

  const statusDot = isConnected
    ? (streamOnline ? 'bg-green-400' : 'bg-yellow-400')
    : 'bg-red-400';
  const statusLabel = isConnected
    ? (streamOnline ? 'Live' : 'Connected, waiting for frontend')
    : 'Disconnected';

  // What to show in the member action area:
  // pendingMemberAction takes priority (it's about to be handled), then fading lastAutoAction
  const actionToShow = pendingMemberAction
    ? { ...pendingMemberAction, handled: null }
    : visibleAutoAction;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-mono">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-wide text-white">Streamer Control</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
            <span className="text-gray-300">{statusLabel}</span>
          </div>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div className="bg-indigo-700 text-white text-sm text-center py-2 px-4 rounded-lg">
            {feedback}
          </div>
        )}

        {/* Agent status */}
        {agentStatus && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 text-xs text-gray-300 text-center">
            {agentStatus}
          </div>
        )}

        {/* Member action (pending or recently auto-handled) */}
        {actionToShow && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              {pendingMemberAction ? 'Board Member Request' : 'Last Auto-Handled'}
            </p>
            <MemberActionBanner
              action={actionToShow}
              isPending={!!pendingMemberAction}
            />
          </div>
        )}

        {/* Current session */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Current Session</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${sessionActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
              {sessionActive ? 'Active' : 'Idle'}
            </span>
          </div>

          {sessionActive ? (
            <>
              {/* Timer */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Time remaining</span>
                  <span className={remaining < 120 ? 'text-red-400 font-bold' : 'text-white'}>
                    {remainingMins}:{String(remainingSecs).padStart(2, '0')}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${timerPct > 80 ? 'bg-red-500' : timerPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${timerPct}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleEndNow}
                  className="py-2 px-3 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-sm font-medium transition-colors"
                >
                  End Now → Vote
                </button>

                <button
                  onClick={() => handleExtend(5)}
                  disabled={extending}
                  className="py-2 px-3 bg-blue-800 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  +5 min
                </button>

                <button
                  onClick={() => handleExtend(10)}
                  disabled={extending}
                  className="py-2 px-3 bg-blue-900 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  +10 min
                </button>

                <button
                  onClick={handleSkip}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    confirmSkip
                      ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {confirmSkip ? 'Confirm Skip + Refund' : 'Skip + Refund'}
                </button>
              </div>

              {confirmSkip && (
                <button
                  onClick={() => setConfirmSkip(false)}
                  className="w-full text-xs text-gray-400 hover:text-gray-200 py-1"
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-sm">
              {automationPaused
                ? 'Automation paused. Resume to process queue.'
                : queue.length > 0
                ? 'Processing next request shortly...'
                : 'No requests in queue. Waiting for viewer submissions.'}
            </p>
          )}
        </div>

        {/* Automation toggle */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Automation</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {automationPaused ? 'Queue is paused — new sessions won\'t start' : 'Queue processes automatically'}
            </p>
          </div>
          <button
            onClick={handlePauseResume}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              automationPaused
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {automationPaused ? 'Resume' : 'Pause'}
          </button>
        </div>

        {/* Queue */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Queue</h2>
            <span className="text-xs text-gray-500">{queue.length} pending</span>
          </div>

          {queue.length === 0 ? (
            <p className="text-gray-600 text-sm">Empty</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => (
                <div key={item.position} className="flex gap-3 bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-500 text-xs font-bold w-4 shrink-0 pt-0.5">#{item.position}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-medium">{item.viewer_name || 'Anonymous'}</p>
                    <p className="text-sm text-gray-200 truncate">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-700">
          <span>This panel is not visible on stream.</span>
          <button
            onClick={() => { sessionStorage.removeItem('streamer_token'); setUnlocked(false); }}
            className="text-gray-600 hover:text-gray-400 transition-colors"
          >
            Change token
          </button>
        </div>
      </div>
    </div>
  );
}
