import { useEffect, useRef, useCallback, useState } from 'react';
import { DEFAULT_MINUTES, WEBHOOK_SERVER_URL } from '../lib/constants.js';

/**
 * Connects to the webhook-server WebSocket and handles all agent control commands.
 * The agent can reset the session, set whiteboard/members, start/stop automode,
 * and trigger votes — all reflected live in the boardroom UI.
 */
export function useAgentControl({
  setWhiteboardFacts,
  setBoardMembers,
  setMessages,
  setMinutes,
  setDocuments,
  setAutoMode,
  autoModeRef,
  onTriggerVote,   // (motion: string) => void — opens vote modal with agent's motion
  onRunAIBuilder,  // async (prompt: string, count: number) => void — runs AI Builder and auto-selects members
}) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  // Keep a ref so the stable ws.onmessage closure always calls the latest callback
  const onRunAIBuilderRef = useRef(onRunAIBuilder);
  useEffect(() => { onRunAIBuilderRef.current = onRunAIBuilder; });
  const [isConnected, setIsConnected] = useState(false);
  const [queue, setQueue] = useState([]);
  const [streamOnline, setStreamOnline] = useState(false);
  const [automationPaused, setAutomationPaused] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [timerExtendedBy, setTimerExtendedBy] = useState(null); // seconds, shown briefly
  const [agentStatus, setAgentStatus] = useState(null);
  const [sessionRemaining, setSessionRemaining] = useState(null);
  const [sessionTotal, setSessionTotal] = useState(null);
  const [pendingTopic, setPendingTopic] = useState(null); // { viewer_name, request_text } for TopicTitleCard
  const [activeSessionTopic, setActiveSessionTopic] = useState(null); // persists during the whole discussion
  const [breakRemaining, setBreakRemaining] = useState(null); // { remaining_seconds, total_seconds } during inter-session break
  const [newsScan, setNewsScan] = useState(null); // { stories, selected_index, selected_topic, selected_reason }
  const sessionActiveRef = useRef(false);

  // Token is entered at runtime via the streamer panel and stored in sessionStorage.
  // It is never compiled into the JS bundle.
  const getStreamerToken = () => sessionStorage.getItem('streamer_token') || '';
  const WS_URL = (() => {
    const base = import.meta.env.VITE_WEBHOOK_WS_URL || WEBHOOK_SERVER_URL;
    return base.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://') + '/ws/boardroom-control';
  })();

  const connect = useCallback(() => {
    // Don't reconnect if already open
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    console.log('[AgentControl] Connecting to', WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[AgentControl] Connected');
      setIsConnected(true);
      clearTimeout(reconnectTimerRef.current);
      ws.send(JSON.stringify({ event: 'READY' }));
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      const { cmd, payload } = msg;

      switch (cmd) {
        case 'RESET_SESSION':
          // Clear all session state for a fresh discussion
          setMessages([]);
          setDocuments([]);
          setMinutes(DEFAULT_MINUTES);
          setAutoMode(false);
          if (autoModeRef) autoModeRef.current = false;
          setAgentStatus(null);
          setSessionRemaining(null);
          setSessionTotal(null);
          setNewsScan(null);
          setActiveSessionTopic(null);
          setBreakRemaining(null);
          break;

        case 'SET_WHITEBOARD':
          setWhiteboardFacts(payload.content);
          break;

        case 'SET_MEMBERS':
          setBoardMembers(payload.members);
          break;

        case 'SET_INITIAL_MESSAGE':
          setMessages(prev => [...prev, {
            role: 'system',
            sender: 'System',
            type: 'alert',
            text: `New topic from ${payload.viewer_name}: "${payload.request_text}"\n\n${payload.message}`,
            avatar: 'bg-gray-600',
          }]);
          setPendingTopic({ viewer_name: payload.viewer_name, request_text: payload.request_text });
          setActiveSessionTopic({ viewer_name: payload.viewer_name, request_text: payload.request_text });
          setBreakRemaining(null);
          break;

        case 'START_AUTOMODE':
          setAutoMode(true);
          if (autoModeRef) autoModeRef.current = true;
          break;

        case 'STOP_AUTOMODE':
          setAutoMode(false);
          if (autoModeRef) autoModeRef.current = false;
          setSessionRemaining(null);
          setActiveSessionTopic(null);
          break;

        case 'BREAK_COUNTDOWN':
          if (payload.remaining_seconds > 0) {
            setBreakRemaining({ remaining_seconds: payload.remaining_seconds, total_seconds: payload.total_seconds });
          } else {
            setBreakRemaining(null);
          }
          break;

        case 'TRIGGER_VOTE':
          onTriggerVote(payload.motion);
          break;

        case 'EXTEND_TIMER':
          setTimerExtendedBy(payload.seconds);
          setTimeout(() => setTimerExtendedBy(null), 4000);
          break;

        case 'NEWS_SCAN':
          setNewsScan(payload);
          break;

        case 'AGENT_STATUS':
          setAgentStatus(payload.text || null);
          break;

        case 'SESSION_TIMER':
          setSessionRemaining(payload.remaining_seconds ?? null);
          setSessionTotal(payload.total_seconds ?? null);
          break;

        case 'RUN_AI_BUILDER':
          if (onRunAIBuilderRef.current) {
            onRunAIBuilderRef.current(payload.prompt, payload.auto_select_count ?? 5)
              .then(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ event: 'AI_BUILDER_COMPLETED' }));
                }
              })
              .catch((err) => {
                console.error('[AgentControl] AI Builder error:', err);
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ event: 'AI_BUILDER_COMPLETED' }));
                }
              });
          }
          break;

        case 'QUEUE_UPDATE':
          setQueue(payload.queue || []);
          setStreamOnline(payload.stream_online || false);
          setAutomationPaused(payload.paused || false);
          sessionActiveRef.current = !!payload.current_request_id;
          setSessionActive(!!payload.current_request_id);
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      console.log('[AgentControl] Disconnected — reconnecting in 3s');
      setIsConnected(false);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      // onclose fires after onerror, which handles reconnect
    };
  }, [WS_URL]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Call this after a vote triggered by the agent completes
  const sendVoteCompleted = useCallback((result) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'VOTE_COMPLETED', payload: { result } }));
    }
  }, []);

  // Streamer control helpers — call the server's /streamer/* endpoints
  const streamerFetch = useCallback(async (path, body = {}) => {
    try {
      const res = await fetch(`${WEBHOOK_SERVER_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Streamer-Token': getStreamerToken(),
        },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (e) {
      console.error('[AgentControl] Streamer fetch error:', e);
      return { error: e.message };
    }
  }, []);

  return {
    isConnected,
    queue,
    streamOnline,
    automationPaused,
    sessionActive,
    sessionActiveRef,
    timerExtendedBy,
    agentStatus,
    newsScan,
    sessionRemaining,
    sessionTotal,
    pendingTopic,
    activeSessionTopic,
    breakRemaining,
    clearPendingTopic: () => setPendingTopic(null),
    sendVoteCompleted,
    skipSession:      () => streamerFetch('/streamer/skip'),
    endNow:           () => streamerFetch('/streamer/end-now'),
    extend:           (seconds = 300) => streamerFetch('/streamer/extend', { seconds }),
    pauseAutomation:  () => streamerFetch('/streamer/pause'),
    resumeAutomation: () => streamerFetch('/streamer/resume'),
  };
}
