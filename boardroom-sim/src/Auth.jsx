import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Lock, Mail, Loader2, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { FREE_PLAN_MEMBER_LIMIT, FREE_PLAN_CREDIT_LIMIT, FREE_PLAN_LIBRARY_LIMIT } from './lib/constants';
import kreygoLogo from './assets/kreygo-logo.png';

const FEATURES = [
  { label: 'Multi-agent orchestration', desc: 'AI executives debate, disagree, and challenge each other in real time.' },
  { label: 'Action Tag Protocol', desc: 'Agents autonomously request votes, trigger research, and draft documents.' },
  { label: 'Formal vote system', desc: 'Call motions to a vote and get a per-member breakdown with reasoning.' },
];

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
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
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col lg:flex-row">

      {/* ── Left: Product teaser (hidden on small screens, shown on lg+) ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 border-r border-gray-800/60 bg-gray-950">
        {/* Logo */}
        <a href="https://boardroom.kreygo.com" className="flex items-center gap-2 group w-fit">
          <div className="bg-indigo-600 rounded-md p-1.5">
            <img src={kreygoLogo} alt="Kreygo" className="h-6 w-auto" />
          </div>
          <span className="text-sm font-semibold text-gray-400 group-hover:text-white transition-colors">Boardroom AI</span>
        </a>

        {/* Hero copy */}
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Multi-Agent Boardroom Simulator</p>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Your AI board meets,<br />debates, and decides.
            </h2>
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              Assemble a team of AI executives with distinct personalities and models. Run strategy sessions, stress-test decisions, and call formal votes — all without scheduling a meeting.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-4">
            {FEATURES.map(f => (
              <li key={f.label} className="flex gap-3">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{f.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* CTA to real landing page */}
          <a
            href="https://boardroom.kreygo.com"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-3 rounded-lg transition-colors"
          >
            See it in action <ArrowRight size={15} />
          </a>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-600">
          Built on FastAPI &amp; Gemini 2.0 Flash.{' '}
          <a href="https://github.com/superbop09" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 inline-flex items-center gap-1">
            GitHub <ExternalLink size={10} />
          </a>
        </p>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12">
        {/* Mobile-only logo */}
        <a href="https://boardroom.kreygo.com" className="flex lg:hidden items-center gap-2 mb-8">
          <div className="bg-indigo-600 rounded-md p-1.5">
            <img src={kreygoLogo} alt="Kreygo" className="h-6 w-auto" />
          </div>
          <span className="text-sm font-semibold text-gray-300">Boardroom AI</span>
        </a>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-1">
            {isResetting ? "Reset Password" : isSigningUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-gray-400 mb-8 text-sm">
            {isResetting
              ? "We'll send a recovery link to your email"
              : isSigningUp
              ? "Free plan — no credit card required"
              : "Sign in to access your Boardroom"}
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
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">What you get on the free plan</p>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li className="flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span><span>{FREE_PLAN_MEMBER_LIMIT} board members</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span><span>{FREE_PLAN_CREDIT_LIMIT} message credits</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span><span>{FREE_PLAN_LIBRARY_LIMIT} saved boards</span></li>
              </ul>
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

          {/* Mobile-only "not sure?" nudge */}
          {!isSigningUp && !isResetting && (
            <div className="mt-8 pt-6 border-t border-gray-800 lg:hidden text-center">
              <p className="text-xs text-gray-500 mb-2">Not sure what this is?</p>
              <a
                href="https://boardroom.kreygo.com"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                See the full demo <ArrowRight size={13} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}