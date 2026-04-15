import React, { useState, useRef, useEffect } from 'react';
import { Menu, Square, Play, Globe, ChevronRight, ShieldAlert, BrainCircuit, Sparkles, X, Search, Vote, RotateCcw, Users, Headphones, VolumeX, Minimize2, Volume2, MoreHorizontal, Settings, Plus } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import PasswordResetModal from './modals/PasswordResetModal.jsx';
import MemberConfigModal from './modals/MemberConfigModal.jsx';
import SettingsModal from './modals/SettingsModal.jsx';
import { BOARD_TEMPLATES } from '../lib/constants.js';

export default function ChatStage({
  // Toolbar
  setIsSidebarOpen,
  handleContinue, autoMode, setAutoMode, autoModeRef, autoTurnCountRef, lastAutoSpeakerRef,
  setIsProcessing, setProcessingStage, setRetryStatus,
  autoResearch, setAutoResearch,
  // Messages area
  messages, setMessages, isProcessing, processingStage, retryStatus,
  boardMembers, speakText, stopAudio, messagesEndRef,
  headphonesMode, setHeadphonesMode, isPlayingAudio, headphonesTip, setHeadphonesTip, briefMode, setBriefMode, speakingMsgIndex,
  preferredName, setPreferredName,
  // Setup screen
  boardName, meetingSetupDone, setMeetingSetupDone,
  setupPurpose, setSetupPurpose, setupBudget, setSetupBudget, setupTimeline, setSetupTimeline,
  setWhiteboardFacts, userInput, setUserInput,
  // Speaker picker
  speakerPickState, setSpeakerPickState, handlePickSpeaker,
  // Input bar
  handleUserTurn, handleManualResearch, openVoteModal, sounds,
  // Password Reset Modal
  showResetModal, setShowResetModal, newPassword, setNewPassword, resetLoading, handlePasswordUpdate,
  // Member Config Modal
  showMemberConfig, setShowMemberConfig,
  showMarketplace, setShowMarketplace, showAIBuilder, setShowAIBuilder, showLibrary, setShowLibrary,
  loadMarketplace, loadLibrary, handleOpenAIBuilder,
  aiBuilderMessages, isAIBuilderLoading, addedSuggestionIds, aiBuilderEndRef,
  aiBuilderInput, setAIBuilderInput, handleAIBuilderSend, addSuggestedMember, pendingMembers,
  marketAgents, isLoadingMarket, marketSearch, setMarketSearch, marketSort, setMarketSort,
  handleDownloadAgent,
  libraryAgents, isLoadingLibrary, editingLibraryAgent, setEditingLibraryAgent,
  handleEditLibraryAgent, handleLoadFromLibrary, handleDeleteLibraryAgent, handleSaveLibraryAgent,
  editingMember, setEditingMember, handleEditMember, handleCreateMember,
  handleDeleteMember, handleSaveMember, handleSaveToLibrary, handlePublishMember, setBoardMembers,
  userId,
  showSettingsModal, setShowSettingsModal, darkMode, setDarkMode,
  showActionNudge, onDismissNudge, onNudgeNewBoard, userPlan, onOpenPricing,
  agentStatus, sessionRemaining, sessionTotal,
}) {
  // Speak from a given message index forward, using the voice_id stored on each message.
  const handleSpeak = (startIdx) => {
    stopAudio();
    for (let i = startIdx; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'assistant' && m.text) {
        speakText(m.text, m.voice_id || "", i);
      }
    }
  };

  const formatCountdown = (secs) => {
    if (secs == null || secs < 0) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);
  const [showResearchInput, setShowResearchInput] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const researchInputRef = useRef(null);
  const [showSendMenu, setShowSendMenu] = useState(false);
  const sendMenuRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [userInput]);

  useEffect(() => {
    if (showResearchInput && researchInputRef.current) {
      researchInputRef.current.focus();
    }
  }, [showResearchInput]);
  useEffect(() => {
    const onClickOutside = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setShowActionsMenu(false);
      }
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target)) {
        setShowSendMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
  <div className="flex-1 flex flex-col bg-gray-950 relative w-full min-h-0">
    <div className="h-14 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm z-10 flex-shrink-0 flex items-center px-4 sm:px-6">
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
      <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-400 mr-2"><Menu size={20} /></button>
          {isPlayingAudio && headphonesMode && (
            <div className="hidden sm:flex items-center gap-1.5 text-violet-400 text-[11px] font-medium">
              <Volume2 size={13} className="flex-shrink-0" />
              <span>Live</span>
              <span className="flex items-end gap-px" style={{height:'12px'}}>
                <span className="w-0.5 bg-violet-400 rounded-sm origin-bottom" style={{height:'5px',animation:'audiobar 0.8s ease-in-out infinite'}}></span>
                <span className="w-0.5 bg-violet-400 rounded-sm origin-bottom" style={{height:'12px',animation:'audiobar 0.8s ease-in-out 0.15s infinite'}}></span>
                <span className="w-0.5 bg-violet-400 rounded-sm origin-bottom" style={{height:'8px',animation:'audiobar 0.8s ease-in-out 0.3s infinite'}}></span>
                <span className="w-0.5 bg-violet-400 rounded-sm origin-bottom" style={{height:'10px',animation:'audiobar 0.8s ease-in-out 0.45s infinite'}}></span>
              </span>
            </div>
          )}
      </div>
      <div className="flex gap-2 overflow-x-auto min-w-0 pb-0.5 items-center">
         <button
           id="tutorial-headphones"
           onClick={() => { sounds?.click(); setHeadphonesMode(prev => !prev); }}
           className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs transition-colors ${headphonesMode ? 'bg-violet-900/30 text-violet-400 border-violet-900 hover:bg-violet-900/50' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'}`}
           title={headphonesMode ? "Headphones Mode ON — new messages are auto-spoken" : "Headphones Mode OFF"}
         >
           <span className="flex items-center gap-0.5"><Headphones size={14} />{headphonesMode ? <Square size={10} className="fill-current" /> : <Play size={10} />}</span>
           <span className="hidden sm:inline">{headphonesMode ? 'Audio: On' : 'Audio: Off'}</span>
         </button>
         <button
           id="tutorial-brief-mode"
           onClick={() => { sounds?.click(); setBriefMode(prev => !prev); }}
           className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs transition-colors ${briefMode ? 'bg-orange-900/30 text-orange-400 border-orange-900 hover:bg-orange-900/50' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'}`}
           title={briefMode ? "Brief Mode ON — responses are 3 sentences max" : "Brief Mode OFF — verbose responses"}
         >
           <Minimize2 size={14} /> <span className="hidden sm:inline">{briefMode ? 'Brief: On' : 'Brief: Off'}</span>
         </button>
         <button
           onClick={() => { sounds?.click(); setShowSettingsModal(true); }}
           className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded text-xs transition-colors bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300"
           title="Settings"
         >
           <Settings size={14} />
         </button>
      </div>
      </div>
    </div>


    <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-gray-800 relative">
      {retryStatus && (
         <div className="sticky top-0 z-50 w-full bg-yellow-900/90 text-yellow-200 text-xs font-bold p-2 text-center border-b border-yellow-700 backdrop-blur animate-pulse flex items-center justify-center gap-2">
           <ShieldAlert size={14}/> {retryStatus}
         </div>
      )}
      {headphonesTip && (
        <div className="sticky top-0 z-50 w-full bg-blue-900/90 text-blue-200 text-xs p-2 border-b border-blue-700 backdrop-blur flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Headphones size={13}/> <strong>Audio + Auto Mode:</strong> Browsers require a click before audio autoplays. If silent, click ▶ on any message to unlock.</span>
          <button onClick={() => setHeadphonesTip(false)} className="shrink-0 text-blue-400 hover:text-white"><X size={14}/></button>
        </div>
      )}
      {messages.length === 0 && !meetingSetupDone && (
        <div className="h-full flex flex-col items-center justify-center px-4 py-8">
          <Users size={36} className="mb-3 text-gray-600" />
          <p className="text-sm text-gray-500 mb-6 font-medium">The Board is assembled. Set the stage.</p>
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-5 shadow-xl space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">What's this meeting about? <span className="text-red-400">*</span></label>
              <textarea
                value={setupPurpose}
                onChange={e => setSetupPurpose(e.target.value)}
                rows={3}
                placeholder="e.g. We need to decide whether to launch the new product in Q2 or delay to Q4..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Budget (optional)</label>
                <input
                  value={setupBudget}
                  onChange={e => setSetupBudget(e.target.value)}
                  placeholder="e.g. $500k"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Timeline (optional)</label>
                <input
                  value={setupTimeline}
                  onChange={e => setSetupTimeline(e.target.value)}
                  placeholder="e.g. Q2 launch"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Your name (optional)</label>
              <input
                value={preferredName}
                onChange={e => setPreferredName(e.target.value)}
                placeholder="How the board addresses you"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => {
                if (!setupPurpose.trim()) return;
                // Append context to whiteboard
                const additions = [`\nMeeting Purpose: ${setupPurpose.trim()}`];
                if (setupBudget.trim()) additions.push(`Budget: ${setupBudget.trim()}`);
                if (setupTimeline.trim()) additions.push(`Timeline: ${setupTimeline.trim()}`);
                setWhiteboardFacts(prev => prev + '\n' + additions.join('\n'));
                setMeetingSetupDone(true);
              }}
              disabled={!setupPurpose.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <ChevronRight size={16} /> Begin Session
            </button>
            {/* Suggested prompts */}
            {(() => {
              const matchedTemplate = BOARD_TEMPLATES.find(
                t => t.id !== 'blank' && boardName.toLowerCase().includes(t.name.toLowerCase())
              );
              const prompts = matchedTemplate?.suggestedPrompts || BOARD_TEMPLATES[0].suggestedPrompts;
              return (
                <div>
                  <div className="text-[10px] text-gray-600 uppercase font-bold tracking-wider text-center mb-2">— or start with a prompt —</div>
                  <div className="space-y-1.5">
                    {prompts.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setUserInput(p);
                          setMeetingSetupDone(true);
                        }}
                        className="w-full text-left text-xs text-gray-400 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2.5 transition-all hover:text-gray-200"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {messages.length === 0 && meetingSetupDone && boardMembers.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Users size={40} className="text-gray-600" />
          <div>
            <p className="text-gray-400 font-medium mb-1">Your boardroom has no members yet.</p>
            <p className="text-gray-600 text-sm">Add AI members to start a simulation.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMemberConfig(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded text-xs transition-colors"
            >
              <Plus size={12} /> Add Member
            </button>
            <button
              onClick={handleOpenAIBuilder}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-600/40 rounded text-xs transition-colors"
            >
              <Sparkles size={12} /> AI Builder
            </button>
          </div>
        </div>
      )}
      {messages.length === 0 && meetingSetupDone && boardMembers.length > 0 && (
        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-40">
          <Users size={40} className="mb-3" />
          <p className="text-sm">The Board is ready. Say something to begin.</p>
        </div>
      )}
      {messages.map((msg, idx) => (
        <MessageBubble
          key={idx}
          msg={msg}
          idx={idx}
          onDismiss={(i) => setMessages(prev => prev.filter((_, mi) => mi !== i))}
          onSpeak={handleSpeak}
          isSpeaking={idx === speakingMsgIndex}
          onOpenPricing={onOpenPricing}
        />
      ))}
      {isProcessing && !retryStatus && (() => {
        const speakingMember = boardMembers?.find(m =>
          processingStage?.toLowerCase().includes(m.name.toLowerCase()) &&
          processingStage?.toLowerCase().includes('is speaking')
        );
        const isResearch = processingStage?.toLowerCase().includes('looking it up');
        return (
          <div className={`processing-indicator flex items-center gap-3 mt-4 ml-2 px-3 py-2.5 rounded-xl border max-w-fit ${
            speakingMember ? 'bg-violet-950/40 border-violet-800/60'
            : isResearch   ? 'bg-cyan-950/40 border-cyan-800/60'
            :                'bg-gray-800/50 border-gray-700/60'
          }`}>
            {speakingMember ? (
              <>
                <div className={`w-9 h-9 rounded-full ${speakingMember.avatar} flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-lg speaking-ripple`}>
                  {speakingMember.name[0]}
                </div>
                <div>
                  <div className="text-sm font-bold text-white leading-none">{speakingMember.name}</div>
                  <div className="text-xs text-violet-400">{speakingMember.role} is composing...</div>
                </div>
                <div className="flex items-end gap-px ml-1" style={{ height: '18px' }}>
                  {[6, 14, 10, 16, 8, 13, 5].map((h, i) => (
                    <span key={i} className="w-1 bg-violet-400 rounded-sm origin-bottom"
                      style={{ height: `${h}px`, animation: `audiobar 0.6s ease-in-out ${i * 0.09}s infinite` }} />
                  ))}
                </div>
              </>
            ) : isResearch ? (
              <>
                <div className="w-9 h-9 rounded-full bg-cyan-900/60 border border-cyan-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">🔍</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-cyan-300 leading-none">Researching</div>
                  <div className="text-xs text-cyan-600">Looking it up...</div>
                </div>
                <span className="flex gap-1 ml-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-indigo-900/40 border border-indigo-800 flex items-center justify-center flex-shrink-0">
                  <BrainCircuit size={15} className="text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-300 leading-none">{processingStage || 'Processing...'}</div>
                  <div className="text-xs text-gray-600">Board is deliberating</div>
                </div>
                <span className="flex gap-1 ml-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </>
            )}
          </div>
        );
      })()}
      <div ref={messagesEndRef} />
    </div>

    {/* Speaker Picker */}
    {speakerPickState && (
      <div className="px-4 pt-4 pb-2 border-t border-indigo-900/50 bg-gray-900/80">
        <div className="max-w-4xl mx-auto">
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Sparkles size={10} className="text-indigo-400" /> Who speaks next?</span>
            <button onClick={() => setSpeakerPickState(null)} className="text-gray-500 hover:text-white transition-colors" title="Dismiss"><X size={14} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePickSpeaker(speakerPickState.recommendation)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors"
            >
              <Sparkles size={11} />
              AI Pick: {speakerPickState.recommendation.name} ({speakerPickState.recommendation.role})
            </button>
            {boardMembers.map(m => (
              <button
                key={m.id}
                onClick={() => handlePickSpeaker(m)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded text-xs transition-colors ${
                  m.id === speakerPickState.recommendation.id
                    ? 'border-indigo-700 text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40'
                    : 'border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${m.avatar} flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0`}>{m.name[0]}</div>
                {m.name} <span className="text-gray-600 ml-0.5">({m.role})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {showActionNudge && (
      <div className="nudge-slide-up px-4 pt-3 pb-2 bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 rounded-lg px-3 py-2">
          <span className="text-xs text-indigo-300 flex-1 min-w-0">The board's been at it — take a next step:</span>
          <button
            onClick={() => { openVoteModal(); onDismissNudge?.(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-700/30 hover:bg-indigo-700/50 text-indigo-300 border border-indigo-600/40 rounded text-xs transition-colors whitespace-nowrap flex-shrink-0"
          >
            <Vote size={12} /> Call a Vote
          </button>
          <button
            onClick={() => { onNudgeNewBoard?.(); onDismissNudge?.(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 border border-gray-600/40 rounded text-xs transition-colors whitespace-nowrap flex-shrink-0"
          >
            {userPlan === 'free' ? <><RotateCcw size={12} /> Start Fresh</> : <><Plus size={12} /> New Boardroom</>}
          </button>
          <button onClick={onDismissNudge} className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 ml-1">
            <X size={14} />
          </button>
        </div>
      </div>
    )}

    <div className={`p-4 bg-gray-900 safe-area-bottom ${showActionNudge ? '' : 'border-t border-gray-800'}`}>
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Speaking as + Next Speaker + Auto-conversation toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
            <span className="shrink-0">Speaking as:</span>
            <input
              value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
              placeholder="Anonymous"
              className="bg-transparent border-b border-gray-700 focus:border-indigo-500 text-gray-400 focus:text-gray-200 outline-none text-xs w-28 pb-px transition-colors"
            />
          </div>
        <div className="flex gap-2">
          <button
            id="tutorial-next-speaker"
            onClick={() => { sounds?.click(); handleContinue(); }}
            disabled={isProcessing || messages.length === 0 || !!speakerPickState || autoMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900 rounded text-xs transition-colors disabled:opacity-50"
            title="Pick who speaks next without sending a message"
          >
            <Users size={14} /> Next Speaker
          </button>
          <button
            id="tutorial-automode-toggle"
            onClick={() => {
              const newVal = !autoMode;
              if (newVal) sounds?.autoOn(); else sounds?.autoOff();
              setAutoMode(newVal);
              autoModeRef.current = newVal;
              if (newVal) {
                setSpeakerPickState(null);
                autoTurnCountRef.current = 0;
                lastAutoSpeakerRef.current = null;
              } else {
                setIsProcessing(false);
                setProcessingStage("");
                setRetryStatus(null);
                setSpeakerPickState(null);
              }
            }}
            disabled={messages.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs transition-colors ${
              autoMode
                ? 'bg-amber-900/30 text-amber-400 border-amber-900 hover:bg-amber-900/50'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'
            }`}
            title={autoMode ? "Auto-conversation ON — click to stop" : "Auto-conversation OFF — click to start"}
          >
            {autoMode ? <Square size={13} className="fill-current" /> : <Play size={14} />}
            <span>{autoMode ? 'Auto: On' : 'Auto: Off'}</span>
          </button>
        </div>
        </div>
        {/* Input row: Textbox → Send Menu → Stop/Mute → Expand */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            id="tutorial-message-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={speakerPickState ? "Choose who speaks next..." : autoMode ? "Type to interject..." : "Present your case..."}
            rows={1}
            style={{ resize: 'none', overflowY: 'hidden' }}
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 px-4 py-3 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
            disabled={!!speakerPickState}
          />
          <div className="relative flex-shrink-0" ref={sendMenuRef}>
            <button
              id="tutorial-send-button"
              type="button"
              onClick={() => setShowSendMenu(prev => !prev)}
              disabled={isProcessing || !!speakerPickState || !userInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-5 h-11 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center flex-shrink-0 cursor-pointer"
            >
              {isProcessing ? <RotateCcw className="animate-spin" size={18} /> : <ChevronRight size={20} />}
            </button>
            {showSendMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[180px]">
                <button
                  onClick={() => { sounds?.click(); handleUserTurn(); setShowSendMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-900/30 transition-colors whitespace-nowrap"
                >
                  <Play size={14} /> Auto Convo: On
                </button>
                <button
                  onClick={() => { sounds?.click(); handleUserTurn(null, { nextSpeaker: true }); setShowSendMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-900/30 transition-colors whitespace-nowrap"
                >
                  <Users size={14} /> Next Speaker
                </button>
              </div>
            )}
          </div>
          {/* Stop audio */}
          <button
            onClick={stopAudio}
            className="flex items-center justify-center w-11 h-11 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/60 rounded-lg transition-colors flex-shrink-0"
            title="Stop audio playback"
          >
            <VolumeX size={16} />
          </button>
          {/* Actions menu */}
          <div className="relative flex-shrink-0" ref={actionsMenuRef}>
            <button
              id="tutorial-vote-button"
              onClick={() => setShowActionsMenu(prev => !prev)}
              disabled={isProcessing}
              className={`flex items-center justify-center w-11 h-11 border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${showActionsMenu ? 'bg-indigo-900/50 text-indigo-300 border-indigo-700' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white'}`}
              title="Actions"
            >
              <MoreHorizontal size={18} />
            </button>
            {showActionsMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[160px]">
                <button
                  onClick={() => { openVoteModal(); setShowActionsMenu(false); }}
                  disabled={isProcessing}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-900/40 transition-colors disabled:opacity-40"
                >
                  <Vote size={14} /> Call a Vote
                </button>
                <button
                  onClick={() => { setShowResearchInput(true); setResearchQuery(''); setShowActionsMenu(false); }}
                  disabled={isProcessing}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40"
                >
                  <Search size={14} /> Run Research
                </button>
              </div>
            )}
            {showResearchInput && (
              <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-3 w-72">
                <p className="text-xs text-gray-400 mb-2">What do you want to look up?</p>
                <input
                  ref={researchInputRef}
                  type="text"
                  value={researchQuery}
                  onChange={e => setResearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && researchQuery.trim()) {
                      handleManualResearch(researchQuery.trim());
                      setShowResearchInput(false);
                      setResearchQuery('');
                    } else if (e.key === 'Escape') {
                      setShowResearchInput(false);
                    }
                  }}
                  placeholder="e.g. market share of EVs in 2024"
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 mb-2"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowResearchInput(false)}
                    className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (researchQuery.trim()) {
                        handleManualResearch(researchQuery.trim());
                        setShowResearchInput(false);
                        setResearchQuery('');
                      }
                    }}
                    disabled={!researchQuery.trim()}
                    className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-40"
                  >
                    Search
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* --- Settings Modal --- */}
    {showSettingsModal && (
      <SettingsModal
        onClose={() => setShowSettingsModal(false)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    )}

    {/* --- Password Reset Modal --- */}
    {showResetModal && (
      <PasswordResetModal
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        resetLoading={resetLoading}
        handlePasswordUpdate={handlePasswordUpdate}
        onClose={() => setShowResetModal(false)}
      />
    )}

    {/* Member Config Modal */}
    {showMemberConfig && (
      <MemberConfigModal
        showMarketplace={showMarketplace} setShowMarketplace={setShowMarketplace}
        showAIBuilder={showAIBuilder} setShowAIBuilder={setShowAIBuilder}
        showLibrary={showLibrary} setShowLibrary={setShowLibrary}
        setShowMemberConfig={setShowMemberConfig}
        loadMarketplace={loadMarketplace} loadLibrary={loadLibrary} handleOpenAIBuilder={handleOpenAIBuilder}
        aiBuilderMessages={aiBuilderMessages} isAIBuilderLoading={isAIBuilderLoading}
        addedSuggestionIds={addedSuggestionIds} aiBuilderEndRef={aiBuilderEndRef}
        aiBuilderInput={aiBuilderInput} setAIBuilderInput={setAIBuilderInput}
        handleAIBuilderSend={handleAIBuilderSend} addSuggestedMember={addSuggestedMember}
        boardMembers={boardMembers} pendingMembers={pendingMembers}
        marketAgents={marketAgents} isLoadingMarket={isLoadingMarket}
        marketSearch={marketSearch} setMarketSearch={setMarketSearch}
        marketSort={marketSort} setMarketSort={setMarketSort}
        handleDownloadAgent={handleDownloadAgent}
        libraryAgents={libraryAgents} isLoadingLibrary={isLoadingLibrary}
        editingLibraryAgent={editingLibraryAgent} setEditingLibraryAgent={setEditingLibraryAgent}
        handleEditLibraryAgent={handleEditLibraryAgent} handleLoadFromLibrary={handleLoadFromLibrary}
        handleDeleteLibraryAgent={handleDeleteLibraryAgent} handleSaveLibraryAgent={handleSaveLibraryAgent}
        editingMember={editingMember} setEditingMember={setEditingMember}
        handleEditMember={handleEditMember} handleCreateMember={handleCreateMember}
        handleDeleteMember={handleDeleteMember} handleSaveMember={handleSaveMember}
        handleSaveToLibrary={handleSaveToLibrary} handlePublishMember={handlePublishMember}
        setBoardMembers={setBoardMembers} userId={userId}
      />
    )}
  </div>
  );
}
