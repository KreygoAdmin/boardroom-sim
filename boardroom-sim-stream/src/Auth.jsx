import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { FREE_PLAN_MEMBER_LIMIT, FREE_PLAN_CREDIT_LIMIT, FREE_PLAN_LIBRARY_LIMIT } from './lib/constants';
import kreygoLogo from './assets/kreygo-logo.png';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        setError(error.message);
    } else if (data.user && data.user.identities?.length === 0) {
        setError("An account with this email already exists. Please sign in instead.");
    } else {
        setMessage("Check your email for the confirmation link!");
    }
    setLoading(false);
  };

  // --- NEW: Password Reset Trigger ---
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, // This brings them back to your app to trigger the recovery event
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset link sent! Check your inbox.");
      setIsResetting(false);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-200 font-sans">
      <a
        href="https://boardroom.kreygo.com"
        className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft size={13} /> <img src={kreygoLogo} alt="Kreygo" className="h-4 w-auto bg-indigo-600 rounded px-1.5 py-0.5" />
      </a>
      <div className="w-full max-w-md p-8 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-600 rounded-lg flex items-center justify-center p-2">
            <img src={kreygoLogo} alt="Kreygo" className="h-12 w-auto" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          {isResetting ? "Reset Password" : isSigningUp ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="text-center text-gray-400 mb-8 text-sm">
          {isResetting ? "We'll send a recovery link to your email" : isSigningUp ? "Simulate board meetings with AI executives" : "Sign in to access your Boardroom"}
        </p>

        {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-900/50 rounded flex items-center gap-2 text-red-200 text-sm">
                <AlertCircle size={16} /> {error}
            </div>
        )}

        {message && (
             <div className="mb-4 p-3 bg-green-900/30 border border-green-900/50 rounded flex items-center gap-2 text-green-200 text-sm">
                <Mail size={16} /> {message}
            </div>
        )}

        {isSigningUp && (
          <div className="mb-6 bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">How it works</p>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span><span><span className="font-semibold text-white">Build your board</span> — Assign AI executives with distinct roles and personalities</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span><span><span className="font-semibold text-white">Drive the discussion</span> — Type messages to steer debates and strategy sessions</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span><span><span className="font-semibold text-white">Call a vote</span> — Put motions to a formal vote and get a per-member breakdown</span></li>
            </ul>
            <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-700/50">Free plan includes {FREE_PLAN_MEMBER_LIMIT} board members, {FREE_PLAN_CREDIT_LIMIT} credits, and {FREE_PLAN_LIBRARY_LIMIT} saved boards.</p>
          </div>
        )}

        <form className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-sm focus:border-indigo-500 outline-none transition-colors"
              placeholder="you@company.com"
            />
          </div>

          {!isResetting && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-500 uppercase">Password</label>
                <button 
                  type="button" 
                  onClick={() => setIsResetting(true)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-tighter"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded p-3 text-sm focus:border-indigo-500 outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          {isResetting ? (
            <div className="space-y-3">
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => setIsResetting(false)}
                className="w-full text-gray-500 hover:text-gray-300 text-xs font-bold uppercase"
              >
                Back to Login
              </button>
            </div>
          ) : isSigningUp ? (
            <div className="space-y-3">
              <button
                onClick={handleSignUp}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
              </button>
              <button
                type="button"
                onClick={() => { setIsSigningUp(false); setError(null); }}
                className="w-full text-gray-500 hover:text-gray-300 text-xs font-bold uppercase"
              >
                Already have an account? Sign In
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => { setIsSigningUp(true); setError(null); }}
                className="w-full text-gray-500 hover:text-gray-300 text-xs font-bold uppercase"
              >
                New here? Create an Account
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}