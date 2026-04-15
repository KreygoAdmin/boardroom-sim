import React, { useState, useEffect, useRef, useCallback } from 'react';

const PADDING = 8;

export default function TutorialOverlay({
  showPromptModal,
  isActive,
  currentStep,
  stepIndex,
  totalSteps,
  isLastStep,
  onStart,
  onSkip,
  onNext,
  onPrev,
}) {
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);
  const skipTimerRef = useRef(null);

  const measure = useCallback(() => {
    if (!isActive || !currentStep) return;
    const el = document.getElementById(currentStep.targetId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
      bottom: r.bottom + PADDING,
      right: r.right + PADDING,
      elCenterX: r.left + r.width / 2,
      elCenterY: r.top + r.height / 2,
    });
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) {
      setRect(null);
      return;
    }
    setRect(null);
    rafRef.current = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);

    // Auto-advance if target element is missing after 400ms
    clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => {
      const el = currentStep && document.getElementById(currentStep.targetId);
      if (!el) onNext();
    }, 400);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', measure);
      clearTimeout(skipTimerRef.current);
    };
  }, [isActive, measure, currentStep, onNext]);

  // --- Prompt Modal ---
  if (showPromptModal) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
          <div className="text-lg font-bold text-white mb-2">Quick Walkthrough?</div>
          <p className="text-sm text-gray-400 mb-5">
            Want a quick tour of all the key controls before you start?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onStart}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              Yes, show me
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-2.5 rounded-lg text-sm transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Spotlight Overlay ---
  if (!isActive || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const tooltipWidth = 300;
  const isInBottomHalf = rect.elCenterY > vh / 2;
  let tooltipLeft = rect.elCenterX - tooltipWidth / 2;
  tooltipLeft = Math.max(12, Math.min(vw - tooltipWidth - 12, tooltipLeft));
  const tooltipTop = isInBottomHalf
    ? Math.max(8, rect.top - 170)
    : rect.bottom + 12;

  return (
    <>
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="fixed top-4 right-4 z-[10001] text-xs text-gray-400 hover:text-white bg-gray-900/90 border border-gray-700 px-3 py-1.5 rounded transition-colors"
      >
        Skip tour
      </button>

      {/* Four dark overlay panels */}
      <div
        className="fixed z-[9998] bg-black/75 pointer-events-none"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }}
      />
      <div
        className="fixed z-[9998] bg-black/75 pointer-events-none"
        style={{ top: rect.bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className="fixed z-[9998] bg-black/75 pointer-events-none"
        style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }}
      />
      <div
        className="fixed z-[9998] bg-black/75 pointer-events-none"
        style={{ top: rect.top, left: rect.right, right: 0, height: rect.height }}
      />

      {/* Tooltip card */}
      <div
        className="fixed z-[10000] bg-gray-900 border border-indigo-700 rounded-xl shadow-2xl p-4"
        style={{ width: tooltipWidth, top: tooltipTop, left: tooltipLeft }}
      >
        <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">
          Step {stepIndex + 1} of {totalSteps}
        </div>
        <div className="text-sm font-bold text-white mb-1">{currentStep.title}</div>
        <p className="text-xs text-gray-400 mb-4">{currentStep.text}</p>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === stepIndex ? 'bg-indigo-400 w-4' : 'bg-gray-700 w-1.5'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onPrev}
            disabled={stepIndex === 0}
            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors"
          >
            {isLastStep ? 'Done' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
