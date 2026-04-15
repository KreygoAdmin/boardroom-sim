import React, { useState } from 'react';
import {
  Users, Globe, BookMarked, BrainCircuit, X,
  Sparkles, Loader2, ChevronRight, Search,
  Plus, Trash2, Save, Volume2,
} from 'lucide-react';
import { MEMBER_MODELS, MEMBER_VOICES, WEBHOOK_SERVER_URL } from '../../lib/constants.js';
import AIBuilderMessage from '../AIBuilderMessage.jsx';

export default function MemberConfigModal({
  // Tab visibility
  showMarketplace, setShowMarketplace,
  showAIBuilder, setShowAIBuilder,
  showLibrary, setShowLibrary,
  // Modal close
  setShowMemberConfig,
  setEditingLibraryAgent,
  // Tab handlers
  loadMarketplace, loadLibrary, handleOpenAIBuilder,
  // AI Builder
  aiBuilderMessages, isAIBuilderLoading,
  addedSuggestionIds, aiBuilderEndRef,
  aiBuilderInput, setAIBuilderInput,
  handleAIBuilderSend, addSuggestedMember,
  boardMembers, pendingMembers,
  // Marketplace
  marketAgents, isLoadingMarket,
  marketSearch, setMarketSearch,
  marketSort, setMarketSort,
  handleDownloadAgent,
  // Library
  libraryAgents, isLoadingLibrary,
  editingLibraryAgent,
  handleEditLibraryAgent, handleLoadFromLibrary,
  handleDeleteLibraryAgent, handleSaveLibraryAgent,
  // Your Board
  editingMember, setEditingMember,
  handleEditMember, handleCreateMember,
  handleDeleteMember, handleSaveMember,
  handleSaveToLibrary, handlePublishMember,
  setBoardMembers,
  userId,
}) {
  const closeAll = () => {
    setShowMemberConfig(false);
    setShowMarketplace(false);
    setShowAIBuilder(false);
    setShowLibrary(false);
    setEditingLibraryAgent(null);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
      <div className="vote-modal-pop bg-gray-900 border border-gray-700 w-full md:max-w-4xl h-[90vh] md:h-[600px] rounded-lg shadow-2xl flex flex-col overflow-hidden">

        {/* MODAL HEADER WITH TABS */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
          <div className="flex gap-4 items-center overflow-x-auto min-w-0">
            <button
              onClick={() => { setShowMarketplace(false); setShowAIBuilder(false); setShowLibrary(false); setEditingLibraryAgent(null); }}
              className={`text-sm font-bold flex items-center gap-2 whitespace-nowrap ${!showMarketplace && !showAIBuilder && !showLibrary ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Users size={18} /> Your Board
            </button>
            <div className="w-px h-5 bg-gray-700"></div>
            <button
              onClick={handleOpenAIBuilder}
              className={`text-sm font-bold flex items-center gap-2 whitespace-nowrap ${showAIBuilder ? 'text-purple-400' : 'text-gray-500 hover:text-purple-300'}`}
            >
              <BrainCircuit size={18} /> AI Builder
            </button>
            <div className="w-px h-5 bg-gray-700"></div>
            <button
              onClick={loadLibrary}
              className={`text-sm font-bold flex items-center gap-2 whitespace-nowrap ${showLibrary ? 'text-amber-400' : 'text-gray-500 hover:text-amber-300'}`}
            >
              <BookMarked size={18} /> Library
            </button>
            <div className="w-px h-5 bg-gray-700"></div>
            <button
              onClick={loadMarketplace}
              className={`text-sm font-bold flex items-center gap-2 whitespace-nowrap ${showMarketplace ? 'text-indigo-400' : 'text-gray-500 hover:text-indigo-300'}`}
            >
              <Globe size={18} /> Marketplace
            </button>
          </div>
          <button onClick={closeAll} className="flex-shrink-0 ml-2 text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {showAIBuilder ? (
          // --- AI BUILDER VIEW ---
          <div className="flex flex-col flex-1 overflow-hidden bg-gray-950">
            <div className="flex-1 overflow-y-auto p-4">
              {aiBuilderMessages.length === 0 && !isAIBuilderLoading && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-16">
                  <Sparkles size={36} className="mb-3" />
                  <p className="text-sm text-center">Analyzing your whiteboard...</p>
                </div>
              )}
              {aiBuilderMessages.map((msg, idx) => (
                <AIBuilderMessage
                  key={idx}
                  msg={msg}
                  idx={idx}
                  addedSuggestionIds={addedSuggestionIds}
                  conflictList={boardMembers}
                  onAddMember={addSuggestedMember}
                />
              ))}
              {isAIBuilderLoading && (
                <div className="flex items-center gap-2 text-xs text-purple-400 animate-pulse pl-9 mt-2">
                  <Loader2 size={14} className="animate-spin" /> Analyzing your project...
                </div>
              )}
              <div ref={aiBuilderEndRef} />
            </div>
            <div className="p-3 border-t border-gray-800 bg-gray-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiBuilderInput}
                  onChange={(e) => setAIBuilderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAIBuilderSend()}
                  placeholder="Reply to the AI..."
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
              <p className="text-[10px] text-gray-600 mt-1.5 text-center">Answer the AI's questions, then click "Add to Board" on any suggestions above.</p>
            </div>
          </div>
        ) : showMarketplace ? (
          // --- MARKETPLACE VIEW ---
          <div className="flex flex-col bg-gray-950 flex-1 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name or role..."
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <select
                value={marketSort}
                onChange={(e) => setMarketSort(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="most_downloaded">Most Downloaded</option>
                <option value="name_az">Name A–Z</option>
                <option value="name_za">Name Z–A</option>
                <option value="role_az">Role A–Z</option>
              </select>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingMarket && <div className="text-center text-gray-500 py-10">Loading agents...</div>}
              {(() => {
                const query = marketSearch.toLowerCase().trim();
                const filtered = query
                  ? marketAgents.filter(a => a.name.toLowerCase().includes(query) || a.role.toLowerCase().includes(query) || (a.description && a.description.toLowerCase().includes(query)))
                  : marketAgents;
                const sorted = [...filtered].sort((a, b) => {
                  switch (marketSort) {
                    case 'oldest': return new Date(a.created_at) - new Date(b.created_at);
                    case 'most_downloaded': return (b.downloads || 0) - (a.downloads || 0);
                    case 'name_az': return a.name.localeCompare(b.name);
                    case 'name_za': return b.name.localeCompare(a.name);
                    case 'role_az': return a.role.localeCompare(b.role);
                    default: return new Date(b.created_at) - new Date(a.created_at);
                  }
                });
                if (!isLoadingMarket && sorted.length === 0 && query) {
                  return <div className="text-center text-gray-500 py-10">No agents match "{marketSearch}"</div>;
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sorted.map(agent => (
                      <div key={agent.id} className="bg-gray-900 border border-gray-800 p-4 rounded hover:border-indigo-500 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className={`w-8 h-8 rounded-full ${agent.avatar} flex items-center justify-center text-xs font-bold text-white`}>{agent.role[0]}</div>
                          <div className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400">Downloads: {agent.downloads || 0}</div>
                        </div>
                        <h3 className="font-bold text-white text-sm">{agent.role}</h3>
                        <div className="text-xs text-indigo-400 mb-2">{agent.name}</div>
                        <p className="text-xs text-gray-400 h-16 overflow-hidden mb-4">{agent.description}</p>
                        <button
                          onClick={() => handleDownloadAgent(agent)}
                          className="w-full py-2 bg-indigo-900/30 hover:bg-indigo-600 border border-indigo-900/50 hover:border-indigo-500 text-indigo-200 hover:text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={14}/> Add to Board
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : showLibrary ? (
          // --- MY LIBRARY VIEW ---
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <div className={`${editingLibraryAgent ? 'w-full md:w-1/3 h-48 md:h-auto border-b md:border-b-0 md:border-r border-gray-800' : 'w-full'} bg-gray-900/50 flex flex-col`}>
              <div className="p-4 overflow-y-auto flex-1">
                {isLoadingLibrary && (
                  <div className="text-center text-gray-500 py-10">Loading your library...</div>
                )}
                {!isLoadingLibrary && libraryAgents.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 py-16">
                    <BookMarked size={48} className="mb-4 opacity-50" />
                    <p className="text-sm">Your library is empty.</p>
                    <p className="text-xs text-gray-700 mt-1">Save agents from "Your Board" to build your collection.</p>
                  </div>
                )}
                <div className={`grid ${editingLibraryAgent ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-3`}>
                  {libraryAgents.map(agent => (
                    <div
                      key={agent.id}
                      className={`bg-gray-900 border p-4 rounded transition-colors cursor-pointer ${editingLibraryAgent?.id === agent.id ? 'border-amber-500 bg-amber-900/10' : 'border-gray-800 hover:border-amber-500/50'}`}
                      onClick={() => handleEditLibraryAgent(agent)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className={`w-8 h-8 rounded-full ${agent.avatar} flex items-center justify-center text-xs font-bold text-white`}>
                          {agent.role[0]}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleLoadFromLibrary(agent); }}
                            className="text-[10px] bg-amber-900/30 hover:bg-amber-600 border border-amber-900/50 hover:border-amber-500 text-amber-200 hover:text-white px-2 py-1 rounded font-bold transition-all"
                            title="Add to current board"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteLibraryAgent(agent.id); }}
                            className="text-[10px] bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-900 text-gray-500 hover:text-red-400 px-2 py-1 rounded font-bold transition-all"
                            title="Remove from library"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-white text-sm">{agent.role}</h3>
                      <div className="text-xs text-amber-400 mb-1">{agent.name}</div>
                      <p className="text-xs text-gray-400 h-12 overflow-hidden">{agent.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {editingLibraryAgent && (
              <div className="flex-1 bg-gray-950 p-6 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Name</label>
                      <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-amber-500 outline-none" value={editingLibraryAgent.name} onChange={(e) => setEditingLibraryAgent({...editingLibraryAgent, name: e.target.value})} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Role</label>
                      <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-amber-500 outline-none" value={editingLibraryAgent.role} onChange={(e) => setEditingLibraryAgent({...editingLibraryAgent, role: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Avatar Color</label>
                    <div className="flex gap-2">{['bg-blue-600', 'bg-purple-600', 'bg-yellow-600', 'bg-pink-600', 'bg-green-600', 'bg-red-600', 'bg-gray-600'].map(c => (<button key={c} onClick={() => setEditingLibraryAgent({...editingLibraryAgent, avatar: c})} className={`w-6 h-6 rounded-full ${c} ${editingLibraryAgent.avatar === c ? 'ring-2 ring-white' : ''}`} />))}</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">System Instructions</label>
                    <textarea className="w-full h-40 bg-gray-800 border border-gray-700 rounded p-3 text-sm text-gray-300 focus:border-amber-500 outline-none leading-relaxed" value={editingLibraryAgent.description} onChange={(e) => setEditingLibraryAgent({...editingLibraryAgent, description: e.target.value})} />
                  </div>
                  <div className="pt-4 flex items-center justify-between border-t border-gray-800 mt-8">
                    <button onClick={() => handleDeleteLibraryAgent(editingLibraryAgent.id)} className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    <button onClick={() => setEditingLibraryAgent(null)} className="text-gray-400 hover:text-gray-300 text-xs font-bold">Cancel</button>
                    <button onClick={handleSaveLibraryAgent} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded text-sm font-bold flex items-center gap-2"><Save size={16} /> Save Changes</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // --- YOUR BOARD VIEW ---
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <div className="w-full md:w-1/3 h-64 md:h-auto border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900/50 flex flex-col">
              <div className="p-2 overflow-y-auto flex-1 space-y-2">
                {boardMembers.map(m => (
                  <div key={m.id} onClick={() => handleEditMember(m)} className={`p-3 rounded cursor-pointer border transition-all ${editingMember?.id === m.id ? 'bg-indigo-900/30 border-indigo-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${m.avatar} flex items-center justify-center text-[10px] font-bold text-white`}>{m.role[0]}</div>
                        <div><div className="text-sm font-bold text-gray-200">{m.role}</div><div className="text-xs text-gray-500">{m.name}</div></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-800 space-y-2">
                <button onClick={handleCreateMember} className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-xs font-bold text-gray-300 flex items-center justify-center gap-2"><Plus size={14} /> Add New Member</button>
                <button onClick={() => { if (window.confirm('Remove all board members? This cannot be undone.')) { setBoardMembers([]); setEditingMember(null); }}} className="w-full py-2 bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-900 rounded text-xs font-bold text-gray-500 hover:text-red-400 flex items-center justify-center gap-2 transition-colors"><Trash2 size={14} /> Clear Board</button>
              </div>
            </div>
            <div className="flex-1 bg-gray-950 p-6 overflow-y-auto">
              {editingMember ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Name</label>
                      <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Role</label>
                      <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" value={editingMember.role} onChange={(e) => setEditingMember({...editingMember, role: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Avatar Color</label>
                    <div className="flex gap-2">{['bg-blue-600', 'bg-purple-600', 'bg-yellow-600', 'bg-pink-600', 'bg-green-600', 'bg-red-600', 'bg-gray-600'].map(c => (<button key={c} onClick={() => setEditingMember({...editingMember, avatar: c})} className={`w-6 h-6 rounded-full ${c} ${editingMember.avatar === c ? 'ring-2 ring-white' : ''}`} />))}</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">AI Model</label>
                    <select
                      value={editingMember.model || "gemini-2.0-flash"}
                      onChange={(e) => setEditingMember({...editingMember, model: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none"
                    >
                      {MEMBER_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <VoiceSelector editingMember={editingMember} setEditingMember={setEditingMember} userId={userId} />
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">System Instructions</label>
                    <textarea className="w-full h-40 bg-gray-800 border border-gray-700 rounded p-3 text-sm text-gray-300 focus:border-indigo-500 outline-none leading-relaxed" value={editingMember.description} onChange={(e) => setEditingMember({...editingMember, description: e.target.value})} />
                  </div>
                  <div className="pt-4 flex items-center justify-between border-t border-gray-800 mt-8">
                    <button onClick={() => handleDeleteMember(editingMember.id)} className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleSaveToLibrary(editingMember)} className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-2">
                        <BookMarked size={14} /> Save to Library
                      </button>
                      <button onClick={handlePublishMember} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-2">
                        <Globe size={14} /> Publish to Market
                      </button>
                    </div>
                    <button onClick={handleSaveMember} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded text-sm font-bold flex items-center gap-2"><Save size={16} /> Save</button>
                  </div>
                </div>
              ) : <div className="h-full flex flex-col items-center justify-center text-gray-600"><Users size={48} className="mb-4 opacity-50" /><p>Select a member.</p></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VoiceSelector({ editingMember, setEditingMember, userId }) {
  const [isSampling, setIsSampling] = useState(false);
  const [sampleError, setSampleError] = useState('');

  const handlePlaySample = async () => {
    const text = `Hello, I'm ${editingMember.name}, the ${editingMember.role}.`;
    const voiceId = editingMember.voice_id;
    setSampleError('');
    if (!voiceId) { setSampleError('Select a voice first.'); return; }
    if (!userId) { setSampleError('Not logged in.'); return; }
    setIsSampling(true);
    try {
      const res = await fetch(`${WEBHOOK_SERVER_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, voice_id: voiceId, text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); setIsSampling(false); };
        audio.onerror = () => { setIsSampling(false); setSampleError('Playback failed.'); };
        audio.play();
      } else {
        const body = await res.json().catch(() => ({}));
        setSampleError(body.detail || `Server error ${res.status}`);
        setIsSampling(false);
      }
    } catch (e) {
      setSampleError('Network error — is the server running?');
      setIsSampling(false);
    }
  };

  return (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">ElevenLabs Voice</label>
      <div className="flex gap-2">
        <select
          value={editingMember.voice_id || ""}
          onChange={(e) => { setEditingMember({ ...editingMember, voice_id: e.target.value }); setSampleError(''); }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none"
        >
          {MEMBER_VOICES.map(v => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <button
          onClick={handlePlaySample}
          disabled={isSampling}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded text-xs transition-colors"
          title="Play sample"
        >
          <Volume2 size={14} /> {isSampling ? '...' : 'Sample'}
        </button>
      </div>
      {sampleError && <p className="mt-1 text-[10px] text-red-400">{sampleError}</p>}
    </div>
  );
}
