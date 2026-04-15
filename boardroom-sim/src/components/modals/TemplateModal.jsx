import React from 'react';
import { Sparkles, X, BrainCircuit, Loader2, ChevronRight, Plus, Pencil, Check, Trash2 } from 'lucide-react';
import { BOARD_TEMPLATES, formatCST } from '../../lib/constants.js';
import AIBuilderMessage from '../AIBuilderMessage.jsx';

export default function TemplateModal({
  // Template / board setup state
  selectedTemplateId, setSelectedTemplateId,
  pendingBoardName, setPendingBoardName,
  pendingMembers, setPendingMembers,
  pendingWhiteboard, setPendingWhiteboard,
  setupPurpose, setSetupPurpose,
  setupBudget, setSetupBudget,
  setupTimeline, setSetupTimeline,
  // AI Builder state
  aiBuilderMessages, setAIBuilderMessages,
  aiBuilderInput, setAIBuilderInput,
  isAIBuilderLoading, setIsAIBuilderLoading,
  addedSuggestionIds,
  aiBuilderEndRef,
  // Handlers
  runAIBuilderAgent,
  handleAIBuilderSend,
  addSuggestedMember,
  handleCreateFromTemplate,
  isFirstTime = false,
  onClose,
}) {
  const [mobileTab, setMobileTab] = React.useState('setup');
  const [templateApplied, setTemplateApplied] = React.useState(null);
  const templateAppliedTimerRef = React.useRef(null);

  const AVATAR_COLORS = ['bg-blue-600','bg-purple-600','bg-red-600','bg-green-600','bg-pink-600','bg-yellow-600','bg-orange-600'];
  const emptyForm = { open: false, editingId: null, name: '', role: '', avatar: 'bg-blue-600', description: '' };
  const [customForm, setCustomForm] = React.useState(emptyForm);

  const openAddForm = () => setCustomForm({ ...emptyForm, open: true });
  const openEditForm = (m) => setCustomForm({ open: true, editingId: m.id, name: m.name, role: m.role, avatar: m.avatar, description: m.description || '' });
  const closeForm = () => setCustomForm(emptyForm);

  const submitCustomMember = () => {
    if (!customForm.name.trim() || !customForm.role.trim()) return;
    if (customForm.editingId) {
      setPendingMembers(prev => prev.map(m => m.id === customForm.editingId
        ? { ...m, name: customForm.name.trim(), role: customForm.role.trim(), avatar: customForm.avatar, description: customForm.description.trim() }
        : m
      ));
    } else {
      setPendingMembers(prev => [...prev, {
        id: `custom_${Date.now()}`,
        name: customForm.name.trim(),
        role: customForm.role.trim(),
        avatar: customForm.avatar,
        description: customForm.description.trim() || `${customForm.role.trim()} on the board.`,
        stats: { agreement: 50, aggression: 30 },
        model: 'gemini-2.0-flash',
      }]);
    }
    closeForm();
  };

  const handleTemplateSelect = (t) => {
    const timeStr = formatCST();
    setSelectedTemplateId(t.id);
    setPendingBoardName(t.id === 'blank' ? 'New Boardroom' : t.name);
    setPendingMembers([...t.members]);
    setPendingWhiteboard(t.whiteboard(timeStr));
    if (t.suggestedPurpose) {
      setSetupPurpose(t.suggestedPurpose);
    }
    if (t.id !== 'blank') {
      setTemplateApplied(t.name);
      if (templateAppliedTimerRef.current) clearTimeout(templateAppliedTimerRef.current);
      templateAppliedTimerRef.current = setTimeout(() => setTemplateApplied(null), 3000);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="vote-modal-pop bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              {isFirstTime ? 'Welcome to Boardroom Sim' : 'New Boardroom'}
            </h2>
            {isFirstTime && (
              <p className="text-gray-400 text-xs mt-0.5">Simulate a board meeting with AI executives to pressure-test your ideas. Set up your first boardroom below.</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Mobile tab bar */}
        <div className="flex md:hidden border-b border-gray-700 flex-shrink-0">
          <button
            onClick={() => setMobileTab('setup')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${mobileTab === 'setup' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500'}`}
          >
            Setup
          </button>
          <button
            onClick={() => setMobileTab('ai')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-1 ${mobileTab === 'ai' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-gray-500'}`}
          >
            <BrainCircuit size={11} /> AI Builder
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

          {/* LEFT: template + name + members */}
          <div className={`${mobileTab === 'setup' ? 'flex' : 'hidden'} md:flex w-full md:w-72 md:flex-shrink-0 md:border-r border-gray-700 flex-col overflow-y-auto p-4 space-y-4 flex-1 md:flex-none`}>

            {/* Template grid - compact 2-col */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Starting Template</label>
              <div className="grid grid-cols-2 gap-2">
                {BOARD_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t)}
                    className={`text-left p-2.5 rounded-lg border transition-all ${
                      selectedTemplateId === t.id
                        ? 'bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-lg mb-1">{t.icon}</div>
                    <div className="text-xs font-bold text-white leading-tight">{t.name}</div>
                  </button>
                ))}
              </div>
              {templateApplied && (
                <div className="bg-green-900/50 border border-green-700/50 text-green-300 text-xs px-3 py-1.5 rounded mt-2">
                  ✓ {templateApplied} template applied — {pendingMembers.length} members selected
                </div>
              )}
            </div>

            {/* Board Name */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Board Name</label>
              <input
                type="text"
                value={pendingBoardName}
                onChange={(e) => setPendingBoardName(e.target.value)}
                placeholder="Name this boardroom..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            {/* Meeting Context */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Meeting Purpose</label>
                <button
                  onClick={async () => {
                    if (!setupPurpose.trim() || isAIBuilderLoading) return;
                    const parts = [setupPurpose.trim(), setupBudget.trim() && `Budget: ${setupBudget.trim()}`, setupTimeline.trim() && `Timeline: ${setupTimeline.trim()}`].filter(Boolean);
                    const userText = parts.join('. ');
                    const userMsg = { role: 'user', type: 'user-chat', text: userText };
                    const updatedHistory = [...aiBuilderMessages, userMsg];
                    setAIBuilderMessages(updatedHistory);
                    setIsAIBuilderLoading(true);
                    const wb = [pendingWhiteboard, `Meeting Purpose: ${setupPurpose.trim()}`, setupBudget.trim() && `Budget: ${setupBudget.trim()}`, setupTimeline.trim() && `Timeline: ${setupTimeline.trim()}`].filter(Boolean).join('\n');
                    const response = await runAIBuilderAgent(updatedHistory, { members: pendingMembers, whiteboard: wb });
                    setIsAIBuilderLoading(false);
                    if (!response) {
                      setAIBuilderMessages(prev => [...prev, { role: 'assistant', type: 'ai-chat', text: "Something went wrong. Please try again." }]);
                    } else if (response.type === 'message') {
                      setAIBuilderMessages(prev => [...prev, { role: 'assistant', type: 'ai-chat', text: response.text }]);
                    } else if (response.type === 'suggestions') {
                      const sid = Date.now().toString();
                      setAIBuilderMessages(prev => [...prev, { role: 'assistant', type: 'suggestions', text: response.intro || "Here are my recommendations:", members: response.members.map((m, i) => ({ ...m, id: `sugg_${sid}_${i}` })) }]);
                    }
                  }}
                  disabled={!setupPurpose.trim() || isAIBuilderLoading}
                  className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold"
                  title="Send this context to the AI builder"
                >
                  <Sparkles size={10} /> Ask AI
                </button>
              </div>
              <textarea
                value={setupPurpose}
                onChange={e => setSetupPurpose(e.target.value)}
                rows={3}
                placeholder="e.g. We need to decide whether to launch in Q2 or delay to Q4..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none resize-none transition-colors placeholder-gray-600"
              />
              <div className="flex gap-2">
                <input
                  value={setupBudget}
                  onChange={e => setSetupBudget(e.target.value)}
                  placeholder="Budget (optional)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none transition-colors placeholder-gray-600"
                />
                <input
                  value={setupTimeline}
                  onChange={e => setSetupTimeline(e.target.value)}
                  placeholder="Timeline (optional)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none transition-colors placeholder-gray-600"
                />
              </div>
            </div>

            {/* Current Members list */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Board Members <span className="text-gray-600 font-normal normal-case">({pendingMembers.length})</span>
                </label>
                {pendingMembers.length > 0 && (
                  <button
                    onClick={() => { setPendingMembers([]); closeForm(); }}
                    className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 font-bold transition-colors"
                    title="Remove all members"
                  >
                    <Trash2 size={10} /> Clear Board
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {pendingMembers.map(m => (
                  <div key={m.id} className={`flex items-center gap-2 bg-gray-800 border rounded px-2 py-1.5 group cursor-pointer transition-colors ${customForm.editingId === m.id ? 'border-indigo-500' : 'border-gray-700 hover:border-gray-500'}`}
                    onClick={() => customForm.editingId === m.id ? closeForm() : openEditForm(m)}>
                    <div className={`w-6 h-6 rounded-full ${m.avatar} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                      {m.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{m.role}</div>
                      <div className="text-[10px] text-gray-500 truncate">{m.name}</div>
                    </div>
                    <Pencil size={11} className="text-gray-600 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity hidden md:block" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingMembers(prev => prev.filter(p => p.id !== m.id)); if (customForm.editingId === m.id) closeForm(); }}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {pendingMembers.length === 0 && (
                  <p className="text-xs text-gray-600 italic px-1">No members yet. Use the AI to generate some →</p>
                )}
              </div>

              {/* Inline custom member form */}
              {customForm.open && (
                <div className="mt-2 bg-gray-800/80 border border-indigo-500/50 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={customForm.name}
                      onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Name"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                    <input
                      value={customForm.role}
                      onChange={e => setCustomForm(f => ({ ...f, role: e.target.value }))}
                      placeholder="Role / Title"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <input
                    value={customForm.description}
                    onChange={e => setCustomForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional — AI will fill in gaps)"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-wrap flex-1">
                      {AVATAR_COLORS.map(c => (
                        <button key={c} onClick={() => setCustomForm(f => ({ ...f, avatar: c }))}
                          className={`w-5 h-5 rounded-full ${c} transition-transform ${customForm.avatar === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`} />
                      ))}
                    </div>
                    <button onClick={closeForm} className="text-gray-500 hover:text-white transition-colors"><X size={14} /></button>
                    <button
                      onClick={submitCustomMember}
                      disabled={!customForm.name.trim() || !customForm.role.trim()}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                    >
                      <Check size={12} /> {customForm.editingId ? 'Save' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {/* Add custom button */}
              {!customForm.open && (
                <button onClick={openAddForm} className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 hover:border-gray-500 rounded text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                  <Plus size={11} /> Add Custom Member
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: AI Builder */}
          <div className={`${mobileTab === 'ai' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden bg-gray-950/40`}>
            <div className="px-4 pt-3 pb-2 border-b border-gray-700/60 flex-shrink-0 flex items-center gap-2">
              <BrainCircuit size={13} className="text-purple-400 flex-shrink-0" />
              <p className="text-xs text-gray-400">Use AI to suggest members for your scenario, or refine the template roster — then click <span className="text-white font-medium">Add to Board</span> on any card.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {aiBuilderMessages.length === 0 && !isAIBuilderLoading && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-12">
                  <Sparkles size={28} className="mb-2" />
                  <p className="text-xs text-center">Analyzing your scenario...</p>
                </div>
              )}
              {aiBuilderMessages.map((msg, idx) => (
                <AIBuilderMessage
                  key={idx}
                  msg={msg}
                  idx={idx}
                  addedSuggestionIds={addedSuggestionIds}
                  conflictList={pendingMembers}
                  onAddMember={addSuggestedMember}
                />
              ))}
              {isAIBuilderLoading && (
                <div className="flex items-center gap-2 text-xs text-purple-400 animate-pulse pl-9 mt-2">
                  <Loader2 size={14} className="animate-spin" /> Thinking about your board...
                </div>
              )}
              <div ref={aiBuilderEndRef} />
            </div>
            <div className="p-3 border-t border-gray-700/60 flex-shrink-0 bg-gray-900/60">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiBuilderInput}
                  onChange={(e) => setAIBuilderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAIBuilderSend()}
                  placeholder="Describe your project, request roles, or refine suggestions..."
                  disabled={isAIBuilderLoading}
                  className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50"
                />
                <button
                  onClick={handleAIBuilderSend}
                  disabled={isAIBuilderLoading || !aiBuilderInput.trim()}
                  className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isAIBuilderLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateFromTemplate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded text-sm font-bold transition-colors"
          >
            <Sparkles size={14} /> Start Meeting ({pendingMembers.length} members)
          </button>
        </div>
      </div>
    </div>
  );
}
