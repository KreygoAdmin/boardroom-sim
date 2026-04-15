import React, { useState } from 'react';
import {
  Users, RotateCcw, CloudUpload, X, ListOrdered, Plus, Trash2,
  FileText, Edit, BrainCircuit, ClipboardList, ChevronRight,
  Sparkles, MessageSquare, LogOut, BookMarked, Info, GraduationCap,
  ScrollText, Copy, Check, ChevronDown,
} from 'lucide-react';
import kreygoLogo from '../assets/kreygo-logo.png';
import { MEMBER_MODELS, ROLE_DEFINITIONS, STRIPE_BASE_URL, STRIPE_PRO_URL, WEBHOOK_SERVER_URL } from '../lib/constants.js';
import { supabase } from '../supabaseClient';
import PricingModal from './modals/PricingModal.jsx';

function DocumentCard({ doc, setDocuments }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${doc.title}\n\n${doc.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded text-xs">
      <div className="flex items-center gap-2 p-2">
        <button onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center gap-1.5 text-left min-w-0">
          <ChevronDown size={11} className={`text-gray-500 flex-shrink-0 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
          <span className="text-white font-medium truncate">{doc.title}</span>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {doc.revisions.length > 0 && (
            <span className="text-[9px] bg-indigo-900/50 text-indigo-400 border border-indigo-800 px-1 rounded" title={`${doc.revisions.length} revision(s)`}>
              v{doc.revisions.length + 1}
            </span>
          )}
          <button onClick={handleCopy} className="text-gray-500 hover:text-green-400 transition-colors" title="Copy to clipboard">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-red-400">Delete?</span>
              <button
                onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))}
                className="text-[9px] px-1 py-0.5 bg-red-900/50 hover:bg-red-900 text-red-300 border border-red-800 rounded transition-colors"
              >Yes</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[9px] px-1 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 rounded transition-colors"
              >No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-gray-600 hover:text-red-400 transition-colors" title="Delete document">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-gray-700 pt-2">
          <div className="text-[9px] text-gray-500">By {doc.createdBy} · {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          <div className="bg-gray-900 border border-gray-700 rounded p-2 text-[10px] text-gray-300 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed">
            {doc.content}
          </div>
          {doc.revisions.length > 0 && (
            <div>
              <button onClick={() => setShowRevisions(r => !r)} className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
                <ChevronRight size={9} className={`transition-transform ${showRevisions ? 'rotate-90' : ''}`} />
                {doc.revisions.length} revision{doc.revisions.length > 1 ? 's' : ''}
              </button>
              {showRevisions && doc.revisions.slice().reverse().map((rev, i) => (
                <div key={i} className="mt-1 bg-gray-900/60 border border-gray-800 rounded p-1.5 text-[9px] text-gray-500">
                  <div className="text-gray-400 mb-0.5">{rev.editedBy} · {new Date(rev.editedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {rev.summary}</div>
                  <div className="whitespace-pre-wrap font-mono text-gray-600 max-h-24 overflow-y-auto">{rev.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  onReplayTutorial,
  isSidebarOpen, setIsSidebarOpen,
  handleResetBoard, isProcessing,
  handleSaveBoard, saveStatus,
  boardName, setBoardName,
  showBoardSwitcher, setShowBoardSwitcher, loadBoardList,
  boardList, boardId, loadBoardById, handleCreateBoard, handleDeleteBoard, handleStartFresh,
  whiteboardCollapsed, setWhiteboardCollapsed,
  whiteboardFacts, setWhiteboardFacts,
  showSettings, setShowSettings, whiteboardSnapshot,
  minutesCollapsed, setMinutesCollapsed, minutes,
  alignmentCollapsed, setAlignmentCollapsed,
  boardMembers, setBoardMembers, setShowMemberConfig, setShowLibrary, handleOpenAIBuilder,
  documents, setDocuments, documentsCollapsed, setDocumentsCollapsed,
  userPlan, messagesUsed, session,
  planMessageLimit, planBoardroomLimit,
}) {
  const [tooltipRole, setTooltipRole] = useState(null);
  const [showPricing, setShowPricing] = useState(false);

  const hintKey = session?.user?.id ? `boardHint_dismissed_${session.user.id}` : null;
  const [showBoardHint, setShowBoardHint] = useState(() => {
    if (!hintKey) return false;
    return !localStorage.getItem(hintKey);
  });
  const dismissBoardHint = () => {
    if (hintKey) localStorage.setItem(hintKey, 'true');
    setShowBoardHint(false);
  };
  const shouldShowHint = showBoardHint && (userPlan === 'pro' || userPlan === 'pioneer');
  return (
  <>
  <div className={`fixed inset-y-0 left-0 z-30 w-80 bg-gray-900/95 backdrop-blur shadow-2xl border-r border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center gap-2 justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-indigo-600 rounded flex items-center justify-center p-1"><img src={kreygoLogo} alt="Kreygo" className="h-6 w-auto" /></div>
        <h1 className="font-bold text-white tracking-wider text-sm">BOARDROOM<br/><span className="text-xs text-indigo-400 font-normal">SIMULATOR</span></h1>
      </div>
      {/* Close for mobile, Save for desktop */}
      <div className="flex items-center gap-2">
         {/* --- Reset Button --- */}
         <button 
            onClick={handleResetBoard} 
            disabled={isProcessing} 
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900 rounded text-xs transition-colors disabled:opacity-50 mr-2"
            title="Clear Chat & Restart"
         >
           <RotateCcw size={14} /> <span className="hidden sm:inline">Reset</span>
         </button>
        <button onClick={() => handleSaveBoard()} className="text-gray-400 hover:text-green-400 transition-colors" title="Save Board">
            {saveStatus === "Saving..." ? <RotateCcw size={18} className="animate-spin text-yellow-400"/> : <CloudUpload size={18} />}
        </button>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400"><X size={20} /></button>
      </div>
    </div>

    {/* Board Name Bar */}
    <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex items-center gap-2">
      <span className="text-[10px] text-gray-500 uppercase font-bold">Board:</span>
      <input
        className="flex-1 bg-transparent text-xs text-white font-medium outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
        value={boardName}
        onChange={(e) => setBoardName(e.target.value)}
        placeholder="Board name..."
      />
      <div className="relative">
        <button
          id="tutorial-new-boardroom"
          onClick={() => { setShowBoardSwitcher(!showBoardSwitcher); loadBoardList(); dismissBoardHint(); }}
          className={`transition-colors ${showBoardSwitcher ? 'text-indigo-400' : 'text-gray-400 hover:text-indigo-300'}`}
          title="Switch Boards"
        >
          <ListOrdered size={16} />
        </button>
        {shouldShowHint && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full animate-ping pointer-events-none" />
        )}
      </div>
    </div>

    {/* Board Hint Chip */}
    {shouldShowHint && (
      <div className="px-4 py-1.5 bg-indigo-950/60 border-b border-indigo-900/30 flex items-center justify-between">
        <span className="text-[10px] text-indigo-400 flex items-center gap-1.5">
          <Sparkles size={9} /> Create multiple boardrooms from the list icon
        </span>
        <button onClick={dismissBoardHint} className="text-indigo-700 hover:text-indigo-400 transition-colors ml-2">
          <X size={11} />
        </button>
      </div>
    )}

    {/* Board Switcher Dropdown */}
    {showBoardSwitcher && (
      <div className="border-b border-gray-700 bg-gray-900 p-3 space-y-2">
        {(userPlan === 'pioneer' || userPlan === 'pro') && boardList.length < planBoardroomLimit && (
          <button onClick={handleCreateBoard} className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-600/50 rounded text-xs transition-colors">
            <Plus size={14} /> New Boardroom
          </button>
        )}
        {(userPlan === 'pioneer' || userPlan === 'pro') && boardList.length >= planBoardroomLimit && (
          <button onClick={handleCreateBoard} className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 text-gray-500 border border-gray-700 rounded text-xs cursor-not-allowed">
            <Plus size={14} /> New Boardroom <span className="text-[9px] bg-yellow-600/30 text-yellow-400 px-1 rounded">PIONEER</span>
          </button>
        )}
        {userPlan === 'free' && (
          <div className="space-y-1.5">
            <button onClick={() => alert("Upgrade to Pro to create multiple boardrooms!")} className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 text-gray-500 border border-gray-700 rounded text-xs cursor-not-allowed">
              <Plus size={14} /> New Boardroom <span className="text-[9px] bg-indigo-600/30 text-indigo-400 px-1 rounded">PRO</span>
            </button>
            <button onClick={handleStartFresh} className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded text-xs transition-colors">
              <Trash2 size={13} /> Delete & Start Fresh
            </button>
          </div>
        )}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {boardList.length === 0 && <p className="text-[10px] text-gray-600 text-center py-2">No saved boards yet</p>}
          {boardList.map(b => (
            <div
              key={b.id}
              onClick={() => loadBoardById(b.id)}
              className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer text-xs transition-colors ${
                boardId === b.id ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-300 border border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-[10px] text-gray-500 flex items-center gap-2">
                  <span>{new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {b.members?.length > 0 && (
                    <span className="flex items-center gap-0.5 text-gray-600">
                      <Users size={9} /> {b.members.length}
                    </span>
                  )}
                </div>
              </div>
              {boardId !== b.id && (
                <button onClick={(e) => handleDeleteBoard(b.id, e)} className="ml-2 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {saveStatus === "Saved!" && <div className="bg-green-900/50 text-green-300 text-xs text-center py-1">Session Saved Successfully</div>}
    {saveStatus === "Error!" && <div className="bg-red-900/50 text-red-300 text-xs text-center py-1">Save Failed</div>}

    <div className="flex-1 overflow-y-auto">
      {/* --- Whiteboard (collapsible) --- */}
      <div className="border-b border-gray-800">
        <button id="tutorial-whiteboard" onClick={() => setWhiteboardCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800/50 transition-colors">
          <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2"><FileText size={12} /> The Whiteboard</h2>
          <div className="flex items-center gap-2">
            {showSettings ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={async () => { await handleSaveBoard(); setShowSettings(false); }}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                    title="Save"
                  >
                    {saveStatus === "Saving..." ? <RotateCcw size={12} className="animate-spin" /> : <CloudUpload size={12} />}
                  </button>
                  <button
                    onClick={() => { setWhiteboardFacts(whiteboardSnapshot.current); setShowSettings(false); }}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); whiteboardSnapshot.current = whiteboardFacts; setShowSettings(true); setWhiteboardCollapsed(false); }}
                  className="text-gray-500 hover:text-white transition-colors"
                  title="Edit whiteboard"
                >
                  <Edit size={12} />
                </button>
              )}
            <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${whiteboardCollapsed ? '' : 'rotate-90'}`} />
          </div>
        </button>
        {!whiteboardCollapsed && (
          <div className="px-4 pb-3">
            {showSettings ? (
              <div className="space-y-4">
                <textarea
                  className="w-full h-32 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
                  value={whiteboardFacts}
                  onChange={(e) => setWhiteboardFacts(e.target.value)}
                  placeholder="Enter facts..."
                />
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 p-3 rounded text-xs text-gray-400 whitespace-pre-wrap font-mono">
                {whiteboardFacts}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Secretary's Minutes (collapsible) --- */}
      <div className="border-b border-gray-800">
        <button id="tutorial-minutes" onClick={() => setMinutesCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800/50 transition-colors">
          <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2"><BrainCircuit size={12} /> Secretary's Minutes</h2>
          <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${minutesCollapsed ? '' : 'rotate-90'}`} />
        </button>
        {!minutesCollapsed && (
          <div className="px-4 pb-2 space-y-0.5">
            {[
              { key: 'momentum', label: 'Momentum', color: 'text-green-500', content: minutes.momentum },
              { key: 'consensus', label: 'Consensus', color: 'text-blue-500', content: minutes.consensus },
              { key: 'friction', label: 'Friction Points', color: 'text-red-500', content: minutes.friction },
              { key: 'actions', label: 'Action Items', color: 'text-yellow-500', content: null },
            ].map(item => (
              <details key={item.key} className="group bg-gray-800/30 rounded border border-gray-800">
                <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-800/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <div className={`text-[10px] uppercase font-bold flex items-center gap-1 ${item.color}`}>
                    {item.key === 'actions' && <ClipboardList size={10} />}
                    {item.label}
                  </div>
                  <ChevronRight size={12} className="text-gray-500 transition-transform duration-200 group-open:rotate-90" />
                </summary>
                <div className="px-2 pb-2">
                  {item.key === 'actions' ? (
                    <ul className="text-xs text-gray-400 list-disc list-inside">{minutes.actionItems?.map((ai, i) => <li key={i}>{ai}</li>) || <li className="italic opacity-50">No actions</li>}</ul>
                  ) : (
                    <div className="text-xs text-gray-400">{item.content}</div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>


      {/* --- Documents (collapsible) --- */}
      <div className="border-b border-gray-800">
        <button onClick={() => setDocumentsCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800/50 transition-colors">
          <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
            <ScrollText size={12} /> Documents
            {documents.length > 0 && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 rounded-full font-normal">{documents.length}</span>}
          </h2>
          <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${documentsCollapsed ? '' : 'rotate-90'}`} />
        </button>
        {!documentsCollapsed && (
          <div className="px-4 pb-3 space-y-2">
            {documents.length === 0 ? (
              <p className="text-[10px] text-gray-600 italic text-center py-2">No documents yet. Board members can draft bills and policies during the meeting.</p>
            ) : (
              documents.map(doc => <DocumentCard key={doc.id} doc={doc} setDocuments={setDocuments} />)
            )}
          </div>
        )}
      </div>

      {/* --- Board Alignment (collapsible) --- */}
      <div className="border-b border-gray-800">
        <button id="tutorial-board-members" onClick={() => setAlignmentCollapsed(c => !c)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800/50 transition-colors">
          <h2 className="text-xs font-bold text-gray-400 uppercase">Board Members</h2>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); setShowMemberConfig(true); setShowLibrary(true); }} className="text-gray-500 hover:text-amber-400 transition-colors" title="My Library"><BookMarked size={12} /></button>
            <button onClick={e => { e.stopPropagation(); setShowMemberConfig(true); handleOpenAIBuilder(); }} className="text-gray-500 hover:text-purple-400 transition-colors text-[10px] font-bold leading-none" title="AI Builder">AI</button>
            <button onClick={e => { e.stopPropagation(); setShowMemberConfig(true); }} className="text-gray-500 hover:text-white transition-colors" title="Edit Members"><Edit size={12} /></button>
            <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${alignmentCollapsed ? '' : 'rotate-90'}`} />
          </div>
        </button>
        {!alignmentCollapsed && (
          <div className="px-4 pb-3 space-y-2">
            {tooltipRole && ROLE_DEFINITIONS[tooltipRole] && (
              <div className="mb-2 p-2 bg-gray-800 border border-indigo-900 rounded text-[10px] text-gray-300 leading-relaxed">
                <span className="font-bold text-indigo-400">{tooltipRole}: </span>{ROLE_DEFINITIONS[tooltipRole]}
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-600 uppercase font-bold tracking-wide">Members</span>
              <div className="flex gap-3 pr-0.5">
                <span className="text-[8px] text-gray-600 uppercase font-bold w-5 text-center" title="Can vote in polls">Vote</span>
                <span className="text-[8px] text-amber-700 uppercase font-bold w-5 text-center" title="Can send pop-up requests to you">Reqs</span>
                <span className="text-[8px] text-emerald-700 uppercase font-bold w-5 text-center" title="Can draft and edit documents">Docs</span>
              </div>
            </div>
            {boardMembers.map(m => (
              <div key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-800 rounded transition-colors">
                <div className={`w-4 h-4 rounded-full ${m.avatar} flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0 ${m.canVote === false ? 'opacity-40' : ''}`}>{m.name[0]}</div>
                <div className={`flex-1 ${m.canVote === false ? 'opacity-40' : ''}`}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-white font-medium flex items-center gap-1">
                      {m.role} <span className="text-gray-500">({m.name})</span>
                      {ROLE_DEFINITIONS[m.role] && (
                        <button
                          onClick={() => setTooltipRole(prev => prev === m.role ? null : m.role)}
                          className="text-gray-600 hover:text-indigo-400 transition-colors"
                          title={`What is a ${m.role}?`}
                        ><Info size={9} /></button>
                      )}
                    </span>
                    <span className={m.stats.agreement > 50 ? "text-green-400" : "text-red-400"}>{m.stats.agreement}%</span>
                  </div>
                  <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${m.stats.agreement > 50 ? 'bg-green-600' : 'bg-red-600'}`} style={{ width: `${m.stats.agreement}%` }} />
                  </div>
                  <div className="mt-0.5">
                    <span className={`text-[8px] px-1 rounded ${MEMBER_MODELS.find(md => md.id === (m.model || 'gemini-2.0-flash'))?.provider === 'openrouter' ? 'bg-purple-900/40 text-purple-400' : 'bg-blue-900/40 text-blue-400'}`}>
                      {MEMBER_MODELS.find(md => md.id === (m.model || 'gemini-2.0-flash'))?.label || 'Gemini 2.0 Flash'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 flex-shrink-0 pl-1">
                  <input
                    type="checkbox"
                    checked={m.canVote !== false}
                    onChange={() => setBoardMembers(prev => prev.map(mb => mb.id === m.id ? { ...mb, canVote: m.canVote === false } : mb))}
                    className="w-3 h-3 accent-indigo-500 cursor-pointer"
                    title={m.canVote === false ? "Excluded from votes — click to include" : "Included in votes — click to exclude"}
                  />
                  <input
                    type="checkbox"
                    checked={m.askUser !== false}
                    onChange={() => setBoardMembers(prev => prev.map(mb => mb.id === m.id ? { ...mb, askUser: m.askUser === false } : mb))}
                    className="w-3 h-3 accent-amber-500 cursor-pointer"
                    title={m.askUser === false ? "Pop-ups suppressed — click to allow requests" : "Can send requests — click to suppress pop-ups"}
                  />
                  <input
                    type="checkbox"
                    checked={m.canEditDocs !== false}
                    onChange={() => setBoardMembers(prev => prev.map(mb => mb.id === m.id ? { ...mb, canEditDocs: m.canEditDocs === false } : mb))}
                    className="w-3 h-3 accent-emerald-500 cursor-pointer"
                    title={m.canEditDocs === false ? "Blocked from documents — click to allow" : "Can draft/edit documents — click to block"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    
    {/* User Profile & Sign Out */}
    <div className="p-4 border-t border-gray-800 bg-gray-900 mt-auto">
        {/* --- Plan Status --- */}
        <div className="mb-4">
            {userPlan === 'free' && (
                <button
                    onClick={() => setShowPricing(true)}
                    className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded text-xs shadow-lg transform transition-transform hover:scale-105 flex items-center justify-center gap-2"
                >
                    <Sparkles size={14} fill="white" /> UPGRADE YOUR PLAN
                </button>
            )}
            {userPlan === 'pro' && (
                <div className="space-y-1.5">
                    <button
                        onClick={() => setShowPricing(true)}
                        className="w-full py-1.5 bg-gray-800 border border-indigo-600/30 text-indigo-400 font-bold rounded text-xs flex items-center justify-center gap-2 hover:border-indigo-500/60 transition-colors"
                    >
                        <Sparkles size={13} /> PRO MEMBER
                    </button>
                </div>
            )}
            {userPlan === 'pioneer' && (
                <button
                    onClick={() => setShowPricing(true)}
                    className="w-full py-2 bg-gray-800 border border-yellow-600/30 text-yellow-500 font-bold rounded text-xs flex items-center justify-center gap-2 hover:border-yellow-500/60 hover:text-yellow-400 transition-colors"
                >
                    <Sparkles size={14} /> PIONEER MEMBER
                </button>
            )}
        </div>
        
        {/* Usage counter */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border flex-1 justify-center ${
            userPlan === 'pioneer'
              ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/50'
              : messagesUsed >= planMessageLimit * 0.85
                ? 'bg-red-900/30 text-red-400 border-red-900'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}>
            <MessageSquare size={10} />
            {userPlan === 'pioneer'
              ? <span>{messagesUsed} credits used (unlimited)</span>
              : <span>{messagesUsed} / {planMessageLimit} credits</span>
            }
          </div>
        </div>
        <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400 truncate max-w-[150px]">
                {session?.user?.email}
            </div>
            <div className="flex items-center gap-2">
                {onReplayTutorial && (
                    <button
                        onClick={onReplayTutorial}
                        className="text-gray-500 hover:text-indigo-400 transition-colors"
                        title="Replay tutorial"
                    >
                        <GraduationCap size={16} />
                    </button>
                )}
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Sign Out"
                >
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    </div>
  </div>

  {showPricing && (
    <PricingModal
      onClose={() => setShowPricing(false)}
      userPlan={userPlan}
      session={session}
    />
  )}
  </>
  );
}
