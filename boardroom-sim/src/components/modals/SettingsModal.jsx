import React from 'react';
import { Settings, X } from 'lucide-react';

export default function SettingsModal({ onClose, darkMode, setDarkMode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="vote-modal-pop bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-indigo-400" />
            <h2 className="text-white font-bold text-base">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Appearance section */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Appearance</p>

            {/* Dark Mode toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-200">Dark Mode</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {darkMode ? 'Dark theme active' : 'Light theme active'}
                </div>
              </div>
              <button
                onClick={() => setDarkMode(prev => !prev)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
                  darkMode ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={darkMode}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    darkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
