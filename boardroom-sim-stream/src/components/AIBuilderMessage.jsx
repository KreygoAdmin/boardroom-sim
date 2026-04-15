import React from 'react';
import { Sparkles, Plus } from 'lucide-react';

// Renders a single message in the AI Builder chat panel.
// Handles three variants: user-chat, ai-chat, and suggestions (member cards).
export default function AIBuilderMessage({ msg, idx, addedSuggestionIds, conflictList, onAddMember }) {
  if (msg.type === 'user-chat') {
    return (
      <div className="flex w-full mb-3 justify-end">
        <div className="max-w-[80%] bg-blue-600 text-white p-3 rounded-lg rounded-br-none text-sm">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-chat') {
    return (
      <div className="flex w-full mb-3 justify-start items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={12} className="text-white" />
        </div>
        <div className="max-w-[80%] bg-gray-800 border border-gray-700 p-3 rounded-lg rounded-bl-none text-sm text-gray-200">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.type === 'suggestions') {
    return (
      <div className="w-full mb-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0">
            <Sparkles size={12} className="text-white" />
          </div>
          <div className="max-w-[80%] bg-gray-800 border border-gray-700 p-3 rounded-lg rounded-bl-none text-sm text-gray-200">
            {msg.text}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-9">
          {msg.members.map((member) => {
            const alreadyAdded = addedSuggestionIds.has(member.id);
            const roleConflict = conflictList.some(
              m => m.role.toLowerCase() === member.role.toLowerCase()
            );
            const disabled = alreadyAdded || roleConflict;
            return (
              <div key={member.id} className={`bg-gray-900 border rounded-lg p-3 transition-all ${disabled ? 'border-gray-800 opacity-50' : 'border-gray-700 hover:border-purple-500'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full ${member.avatar} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                    {member.role[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-tight">{member.role}</div>
                    <div className="text-xs text-purple-400">{member.name}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed line-clamp-3">{member.description}</p>
                <div className="flex gap-3 text-[10px] text-gray-500 mb-3">
                  <span>Agreement: <span className="text-green-400">{member.stats?.agreement ?? 50}</span></span>
                  <span>Aggression: <span className="text-red-400">{member.stats?.aggression ?? 30}</span></span>
                </div>
                <button
                  onClick={() => !disabled && onAddMember(member)}
                  disabled={disabled}
                  className={`w-full py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1 ${disabled ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-purple-900/40 hover:bg-purple-600 border border-purple-900/60 hover:border-purple-500 text-purple-300 hover:text-white'}`}
                >
                  {alreadyAdded ? <><span className="text-green-400">✓</span> Added</> : roleConflict ? 'Role Exists' : <><Plus size={12} /> Add to Board</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
