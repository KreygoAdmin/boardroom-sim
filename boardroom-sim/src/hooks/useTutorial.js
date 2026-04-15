import { useState, useCallback } from 'react';

const TUTORIAL_KEY = (userId) => `tutorial_done_${userId}`;

const ALL_STEPS = [
  {
    targetId: 'tutorial-message-input',
    title: 'Drive the discussion',
    text: 'Type your message here to present a case, ask a question, or challenge the board.',
  },
  {
    targetId: 'tutorial-send-button',
    title: 'Send your message',
    text: 'Click the send button to open the send menu. Choose "Auto Convo: On" to send your message and let the board keep debating hands-free, or "Next Speaker" to send and then pick who responds.',
  },
  {
    targetId: 'tutorial-automode-toggle',
    title: 'Auto Mode',
    text: 'Toggle Auto Mode to let the board debate hands-free without sending a message. They keep talking until you intervene or hit the turn limit.',
  },
  {
    targetId: 'tutorial-next-speaker',
    title: 'Next Speaker',
    text: "Prompt the AI to pick the most relevant board member to respond next — without sending a message yourself.",
  },
  {
    targetId: 'tutorial-vote-button',
    title: 'Actions Menu',
    text: 'Tap ⋯ to call a Vote (binary Yes/No or multi-option) or Look something up with a live web search — mid-discussion, whenever you need it.',
  },
  {
    targetId: 'tutorial-auto-research',
    title: 'Auto-Research',
    text: 'When on, the board can look up real-world facts mid-discussion using Google Search — market data, regulations, prices, and more.',
  },
  {
    targetId: 'tutorial-brief-mode',
    title: 'Brief Mode',
    text: 'Caps every board member response to 3 sentences. Great for fast-moving debates where you want punchy, direct takes.',
  },
  {
    targetId: 'tutorial-headphones',
    title: 'Audio Readout',
    text: 'Turn on Audio to auto-read every new message aloud. You can also click the speaker icon on any message to read from that point forward.',
  },
  {
    targetId: 'tutorial-board-members',
    title: 'Your board',
    text: 'Each member has a unique role and an agreement score that shifts as the discussion unfolds. Click the edit icon to configure or swap members.',
    skipOnMobile: true,
  },
  {
    targetId: 'tutorial-whiteboard',
    title: 'The Whiteboard',
    text: 'This is the shared context the whole board reads. Keep it updated with your project name, budget, timeline, and key facts — it shapes every response.',
    skipOnMobile: true,
  },
  {
    targetId: 'tutorial-minutes',
    title: "Secretary's Minutes",
    text: 'The AI automatically tracks consensus, friction, momentum, and action items as the discussion progresses. Review these at any time.',
    skipOnMobile: true,
  },
  {
    targetId: 'tutorial-new-boardroom',
    title: 'Create a New Boardroom',
    text: 'Want to explore a different scenario? Click the board list icon (next to the board name) to switch between boardrooms or start a fresh one — each keeps its own members, whiteboard, and history.',
    skipOnMobile: true,
  },
];

export function useTutorial(userId) {
  const isDone = userId
    ? localStorage.getItem(TUTORIAL_KEY(userId)) === 'true'
    : true;

  const effectiveSteps = ALL_STEPS.filter(
    (s) => !s.skipOnMobile || window.innerWidth >= 768
  );

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const markDone = useCallback(() => {
    if (userId) localStorage.setItem(TUTORIAL_KEY(userId), 'true');
    setShowPromptModal(false);
    setIsActive(false);
  }, [userId]);

  const maybeShowPrompt = useCallback(() => {
    if (!userId || isDone) return;
    setShowPromptModal(true);
  }, [userId, isDone]);

  const startTutorial = useCallback(() => {
    setShowPromptModal(false);
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const skipTutorial = useCallback(() => {
    markDone();
  }, [markDone]);

  const nextStep = useCallback(() => {
    if (stepIndex < effectiveSteps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      markDone();
    }
  }, [stepIndex, effectiveSteps.length, markDone]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  return {
    showPromptModal,
    isActive,
    stepIndex,
    steps: effectiveSteps,
    currentStep: effectiveSteps[stepIndex],
    isLastStep: stepIndex === effectiveSteps.length - 1,
    maybeShowPrompt,
    startTutorial,
    skipTutorial,
    nextStep,
    prevStep,
  };
}
