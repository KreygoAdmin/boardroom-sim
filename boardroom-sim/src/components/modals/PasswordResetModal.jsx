import React from 'react';
import { Key, Loader2 } from 'lucide-react';

export default function PasswordResetModal({ newPassword, setNewPassword, resetLoading, handlePasswordUpdate, onClose }) {
  return (
    <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="vote-modal-pop bg-gray-900 border border-gray-700 w-full max-w-md p-6 rounded-lg shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Key size={20} className="text-indigo-400"/> Update Password
        </h2>
        <p className="text-sm text-gray-400 mb-6">Enter your new password below.</p>

        <div className="space-y-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-sm text-white focus:border-indigo-500 outline-none"
            placeholder="New Password"
          />

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handlePasswordUpdate}
              disabled={resetLoading || !newPassword}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {resetLoading ? <Loader2 size={16} className="animate-spin"/> : "Save Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
