import React from 'react';
import { X, Sparkles, Check, Minus } from 'lucide-react';
import {
  STRIPE_BASE_URL,
  STRIPE_PRO_URL,
  WEBHOOK_SERVER_URL,
  FREE_PLAN_CREDIT_LIMIT,
  PRO_PLAN_CREDIT_LIMIT,
  FREE_PLAN_MEMBER_LIMIT,
  PRO_PLAN_MEMBER_LIMIT,
  FREE_PLAN_LIBRARY_LIMIT,
  PRO_PLAN_LIBRARY_LIMIT,
  PRO_PLAN_BOARDROOM_LIMIT,
} from '../../lib/constants.js';

const FEATURES = [
  { label: 'Credits / month',   free: `${FREE_PLAN_CREDIT_LIMIT}`,   pro: `${PRO_PLAN_CREDIT_LIMIT}`,    pioneer: 'Unlimited' },
  { label: 'Boardrooms',        free: '1',                            pro: `${PRO_PLAN_BOARDROOM_LIMIT}`, pioneer: 'Unlimited' },
  { label: 'Board members',     free: `${FREE_PLAN_MEMBER_LIMIT}`,   pro: `${PRO_PLAN_MEMBER_LIMIT}`,    pioneer: 'Unlimited' },
  { label: 'Saved agents',      free: `${FREE_PLAN_LIBRARY_LIMIT}`,  pro: `${PRO_PLAN_LIBRARY_LIMIT}`,   pioneer: 'Unlimited' },
  { label: 'Board templates',   free: false,                          pro: true,                           pioneer: true },
  { label: 'ElevenLabs voices', free: true,                           pro: true,                           pioneer: true },
];

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    accent: 'border-gray-700',
    headerBg: 'bg-gray-800/60',
    badge: null,
    badgeClass: '',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$15/mo',
    accent: 'border-indigo-500',
    headerBg: 'bg-indigo-900/30',
    badge: 'Most Popular',
    badgeClass: 'bg-indigo-600 text-white',
  },
  {
    id: 'pioneer',
    name: 'Pioneer',
    price: '$50/mo',
    accent: 'border-yellow-600/60',
    headerBg: 'bg-yellow-900/20',
    badge: 'All-Access',
    badgeClass: 'bg-yellow-600 text-black',
  },
];

function Cell({ value }) {
  if (value === true)  return <Check size={14} className="mx-auto text-green-400" />;
  if (value === false) return <Minus size={14} className="mx-auto text-gray-600" />;
  return <span>{value}</span>;
}

export default function PricingModal({ onClose, userPlan, session }) {
  const handleUpgradePro = () => {
    window.location.href = `${STRIPE_PRO_URL}?client_reference_id=${session.user.id}`;
  };

  const handleUpgradePioneer = () => {
    window.location.href = `${STRIPE_BASE_URL}?client_reference_id=${session.user.id}`;
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch(`${WEBHOOK_SERVER_URL}/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        alert(`Could not open billing portal: ${body.detail || 'Unknown error'}\n\nEmail us at support@kreygo.com if this persists.`);
        return;
      }
      window.location.href = body.url;
    } catch (e) {
      alert('Could not reach billing server. Please try again or email support@kreygo.com.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="vote-modal-pop bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h2 className="text-white font-bold text-base">Choose Your Plan</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">

          {/* Tier columns header */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div /> {/* feature label column */}
            {TIERS.map(tier => {
              const isCurrent = userPlan === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`rounded-lg border-2 ${isCurrent ? tier.accent : 'border-gray-700'} ${tier.headerBg} p-3 text-center relative`}
                >
                  {tier.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full ${tier.badgeClass}`}>
                      {tier.badge}
                    </span>
                  )}
                  <div className={`font-bold text-sm ${tier.id === 'pioneer' ? 'text-yellow-400' : tier.id === 'pro' ? 'text-indigo-300' : 'text-gray-300'}`}>
                    {tier.name}
                  </div>
                  <div className={`text-base font-bold mt-1 ${tier.id === 'pioneer' ? 'text-yellow-300' : tier.id === 'pro' ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {tier.price}
                  </div>
                  {isCurrent && (
                    <div className="text-[9px] text-green-400 font-bold mt-0.5 uppercase tracking-wide">
                      Current
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feature rows */}
          <div className="space-y-1 mb-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={`grid grid-cols-4 gap-3 items-center py-2 px-1 rounded text-xs ${i % 2 === 0 ? 'bg-gray-800/30' : ''}`}
              >
                <div className="text-gray-400">{f.label}</div>
                {TIERS.map(tier => (
                  <div
                    key={tier.id}
                    className={`text-center font-mono ${
                      userPlan === tier.id ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    <Cell value={f[tier.id]} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="grid grid-cols-4 gap-3">
            <div />

            {/* Free CTA */}
            <div className="flex flex-col items-center gap-1">
              {userPlan === 'free' ? (
                <div className="w-full py-2 rounded border border-gray-700 text-gray-500 text-xs text-center">
                  Current Plan
                </div>
              ) : (
                <div className="w-full py-2 rounded border border-gray-800 text-gray-600 text-xs text-center cursor-default">
                  Free
                </div>
              )}
            </div>

            {/* Pro CTA */}
            <div className="flex flex-col items-center gap-1">
              {userPlan === 'pro' ? (
                <button
                  onClick={handleManageBilling}
                  className="w-full py-2 rounded border border-indigo-600/40 text-indigo-400 font-bold text-xs text-center hover:border-indigo-500/70 transition-colors"
                >
                  Manage Billing
                </button>
              ) : userPlan === 'pioneer' ? (
                <div className="w-full py-2 rounded border border-gray-800 text-gray-600 text-xs text-center cursor-default">
                  —
                </div>
              ) : (
                <button
                  onClick={handleUpgradePro}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded text-xs shadow transition-all hover:scale-105"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>

            {/* Pioneer CTA */}
            <div className="flex flex-col items-center gap-1">
              {userPlan === 'pioneer' ? (
                <button
                  onClick={handleManageBilling}
                  className="w-full py-2 rounded border border-yellow-600/40 text-yellow-500 font-bold text-xs text-center hover:border-yellow-500/70 hover:text-yellow-400 transition-colors"
                >
                  Manage Billing
                </button>
              ) : (
                <button
                  onClick={handleUpgradePioneer}
                  className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 text-yellow-400 font-bold rounded text-xs transition-colors"
                >
                  Upgrade to Pioneer
                </button>
              )}
            </div>
          </div>

          {/* Manage / cancel link for paid users */}
          {(userPlan === 'pro' || userPlan === 'pioneer') && (
            <p className="text-center text-[10px] text-gray-600 mt-4">
              To cancel or change your subscription,{' '}
              <button
                onClick={handleManageBilling}
                className="text-gray-400 hover:text-white underline transition-colors"
              >
                manage billing here
              </button>
              .
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
