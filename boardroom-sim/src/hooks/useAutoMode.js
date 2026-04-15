import { useState, useRef } from 'react';
import { sleep } from '../lib/api.js';
import { AUTO_LOOP_DELAY, FREE_PLAN_CREDIT_LIMIT } from '../lib/constants.js';

// Owns all auto-conversation state and refs.
// runAutoLoop receives all live state values as an options object to avoid stale closures.
export function useAutoMode() {
  const [autoMode, setAutoMode] = useState(false);
  const autoModeRef = useRef(false);
  const autoTurnCountRef = useRef(0);
  const lastAutoSpeakerRef = useRef(null);
  const autoLoopRunningRef = useRef(false); // mutex: prevents concurrent loop instances

  const runAutoLoop = async ({
    messages, minutes, boardMembers, whiteboardFacts, documents,
    userPlan, messagesUsed, autoResearch,
    runOrchestratorAgent, runBoardMemberAgent, runAlignmentAgent, runResearchAgent,
    openVoteModal,
    setMessages, setMinutes, setIsProcessing, setProcessingStage, setRetryStatus,
    headphonesMode, waitForSilence, waitForNearSilence,
    parseActionRequest, setPendingMemberAction, setAutoMode: setAutoModeOuter,
    applyDocumentAction,
    onTurnLimitReached,
  }) => {
    if (!autoModeRef.current || messages.length === 0) return;
    if (autoLoopRunningRef.current) return; // already running, don't stack
    autoLoopRunningRef.current = true;

    try {
    // Free plan limit
    if (userPlan === 'free' && messagesUsed >= FREE_PLAN_CREDIT_LIMIT) {
      setAutoMode(false);
      autoModeRef.current = false;
      return;
    }

    // In headphones mode: wait for the spoken message to finish, then a small buffer.
    // The initial sleep(150) lets React finish running the headphones useEffect (which
    // calls speakText) before we check for silence — otherwise waitForSilence sees an
    // empty queue and resolves immediately, racing ahead of the audio.
    if (headphonesMode && (waitForNearSilence || waitForSilence)) {
      await sleep(150); // yield so speakText gets queued before checking silence
      if (waitForNearSilence) {
        await waitForNearSilence(4000); // start processing 4s before current audio ends
      } else {
        await waitForSilence();
        await sleep(800); // brief pause between speakers
      }
    } else {
      await sleep(AUTO_LOOP_DELAY);
    }
    if (!autoModeRef.current) return;

    setIsProcessing(true);
    setRetryStatus(null);

    try {
      // Step 1: Run orchestrator
      setProcessingStage("The Board is processing...");
      const lastMsg = messages[messages.length - 1];
      let orchestration = await runOrchestratorAgent(messages, lastMsg, minutes, boardMembers, whiteboardFacts, null);

      if (!orchestration || !autoModeRef.current) {
        setIsProcessing(false);
        setProcessingStage("");
        return;
      }

      setMinutes(orchestration.minutes);

      // Step 2: Check if orchestrator wants to call a vote
      if (orchestration.callVote) {
        setIsProcessing(false);
        setProcessingStage("");
        setAutoMode(false);
        autoModeRef.current = false;
        await openVoteModal(orchestration.proposal, true); // wasAutoMode=true so auto resumes after
        return;
      }

      // Step 3: Optional research
      if (autoResearch && orchestration.researchNeeded && orchestration.researchQuery) {
        setProcessingStage("Looking it up...");
        const research = await runResearchAgent(orchestration.researchQuery);
        if (research) {
          setMessages(prev => [...prev, {
            role: 'system',
            sender: 'Research',
            type: 'research',
            query: orchestration.researchQuery,
            ...research,
          }]);
        }
      }

      if (!autoModeRef.current) {
        setIsProcessing(false);
        setProcessingStage("");
        return;
      }

      // Step 4: Auto-pick the recommended speaker (skip speaker picker UI)
      // Never allow the same member twice in a row during auto-mode
      let chosenMember = orchestration.memberObj;
      if (lastAutoSpeakerRef.current === chosenMember.id && boardMembers.length > 1) {
        const others = boardMembers.filter(m => m.id !== chosenMember.id);
        chosenMember = others[Math.floor(Math.random() * others.length)];
        orchestration = {
          ...orchestration,
          memberObj: chosenMember,
          nextSpeaker: chosenMember.role,
          nextSpeakerName: chosenMember.name,
          nextSpeakerAvatar: chosenMember.avatar,
          briefing: `Respond to the ongoing discussion from your perspective as ${chosenMember.role}.`
        };
      }
      lastAutoSpeakerRef.current = chosenMember.id;

      setProcessingStage(`${chosenMember.role} is speaking...`);
      const agentResponse = await runBoardMemberAgent({ ...orchestration, documents: documents || [] });

      if (!agentResponse || !autoModeRef.current) {
        setIsProcessing(false);
        setProcessingStage("");
        return;
      }

      // Parse optional member action request
      const { type: actionType, proposal: actionProposal, query: actionQuery, question: actionQuestion, isEdit, docTitle, docContent, docSummary, cleanText } =
        parseActionRequest ? parseActionRequest(agentResponse) : { type: null, cleanText: agentResponse };

      const agentMsg = {
        role: 'assistant',
        sender: chosenMember.name,
        senderRole: chosenMember.role,
        text: cleanText,
        type: 'chat',
        avatar: chosenMember.avatar,
        voice_id: chosenMember.voice_id || ""
      };
      setMessages(prev => [...prev, agentMsg]);

      // Alignment check every 3 messages
      if (messages.length % 3 === 0) {
        runAlignmentAgent(agentMsg, boardMembers);
      }

      // Auto-apply document actions — no modal, no pause
      if (actionType === 'doc' && applyDocumentAction && chosenMember.canEditDocs !== false) {
        applyDocumentAction({ isEdit, docTitle, docContent, docSummary }, chosenMember.name);
      }

      // If member requested a non-doc action, pause auto-mode and surface the request
      // Suppressed if member has "allow requests" unchecked
      if (actionType && actionType !== 'doc' && setPendingMemberAction && chosenMember.askUser !== false) {
        setAutoMode(false);
        autoModeRef.current = false;
        setPendingMemberAction({
          type: actionType,
          member: chosenMember,
          proposal: actionProposal,
          query: actionQuery,
          question: actionQuestion,
          wasAutoMode: true,
        });
        return;
      }

    } catch (error) {
      console.error("Auto-loop Error:", error);
      setMessages(prev => [...prev, {
        role: 'system',
        text: "Auto-mode paused due to an error. Check API Key in settings.",
        type: 'error'
      }]);
      setAutoMode(false);
      autoModeRef.current = false;
    } finally {
      autoLoopRunningRef.current = false;
      setIsProcessing(false);
      setProcessingStage("");
      setRetryStatus(null);
    }

    } finally {
      // Outer finally: ensures mutex is always released, even on early returns
      // (inner finally handles the normal run path above)
      autoLoopRunningRef.current = false;
    }
  };

  return { autoMode, setAutoMode, autoModeRef, autoTurnCountRef, lastAutoSpeakerRef, autoLoopRunningRef, runAutoLoop };
}
