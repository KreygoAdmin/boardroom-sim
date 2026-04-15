import { useRef, useCallback, useEffect } from 'react';

/**
 * Procedural UI sound effects using Web Audio API.
 * No audio files required — all tones synthesized on the fly.
 * Silently no-ops if AudioContext is unavailable.
 *
 * OBS / autoplay policy: AudioContext must be resumed after a user gesture.
 * We unlock it on any interaction AND on OBS scene-visibility events so it
 * works in OBS browser sources with no human interaction.
 */
export function useSounds() {
  const ctxRef = useRef(null);

  // Preload audio files so playback is instant.
  // Start muted — unmute on first gesture so OBS allows playback.
  const gavelRef = useRef(null);
  const cheerRef = useRef(null);
  if (!gavelRef.current) {
    const gavel = new Audio('/618138__aerny__gavel-on-wooden-desk.wav');
    gavel.volume = 0.8;
    gavel.muted = true;
    gavel.load();
    gavelRef.current = gavel;
  }
  if (!cheerRef.current) {
    const cheer = new Audio('/480735__craigsmith__r02-03-small-crowd-cheering.wav');
    cheer.volume = 0.6;
    cheer.muted = true;
    cheer.load();
    cheerRef.current = cheer;
  }

  // Unlock AudioContext and HTML5 audio elements.
  // Called on any user gesture AND on OBS scene visibility to cover both cases.
  const unlockAudio = useCallback(() => {
    // Resume AudioContext if suspended
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    // Unmute preloaded audio elements
    if (gavelRef.current) gavelRef.current.muted = false;
    if (cheerRef.current) cheerRef.current.muted = false;
  }, []);

  useEffect(() => {
    // Standard user-gesture listeners (Chrome)
    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach(e => document.addEventListener(e, unlockAudio, { once: true, passive: true }));

    // OBS Browser Source: fires when the scene source becomes visible
    window.addEventListener('obsSceneItemVisibilityChanged', unlockAudio);

    // OBS also fires this on load when the browser source first activates
    window.addEventListener('obsSourceActiveChanged', unlockAudio);

    // Attempt a silent unlock immediately — works in OBS where CEF allows it
    // even before a gesture, but is harmless if it fails in regular Chrome.
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // Play a zero-length silent buffer to prime the audio pipeline
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch (_) {}

    return () => {
      events.forEach(e => document.removeEventListener(e, unlockAudio));
      window.removeEventListener('obsSceneItemVisibilityChanged', unlockAudio);
      window.removeEventListener('obsSourceActiveChanged', unlockAudio);
    };
  }, [unlockAudio]);

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  // Soft UI click — short sine tap for toolbar toggles
  const click = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    } catch (_) {}
  }, []);

  // Send message — subtle upward whoosh
  const send = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(3500, now + 0.12);
      filter.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
    } catch (_) {}
  }, []);

  // AI message received — soft double-chime
  const receive = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [{ f: 880, t: 0 }, { f: 1100, t: 0.13 }].forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.07, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.28);
        osc.start(now + t);
        osc.stop(now + t + 0.3);
      });
    } catch (_) {}
  }, []);

  // Speaker picker appears — rising three-note arpeggio
  const speakerPick = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [440, 550, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.08;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (_) {}
  }, []);

  // Vote called — gavel thud + high ping
  const vote = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      // Low thud
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.type = 'sine';
      thud.frequency.setValueAtTime(200, now);
      thud.frequency.exponentialRampToValueAtTime(55, now + 0.18);
      thudGain.gain.setValueAtTime(0.22, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      thud.start(now);
      thud.stop(now + 0.35);
      // High ping
      const ping = ctx.createOscillator();
      const pingGain = ctx.createGain();
      ping.connect(pingGain);
      pingGain.connect(ctx.destination);
      ping.type = 'sine';
      ping.frequency.value = 1400;
      pingGain.gain.setValueAtTime(0.07, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      ping.start(now);
      ping.stop(now + 0.2);
    } catch (_) {}
  }, []);

  // Auto mode ON — ascending two-tone
  const autoOn = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [520, 780].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.11;
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch (_) {}
  }, []);

  // Auto mode OFF — descending two-tone
  const autoOff = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [780, 520].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.11;
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch (_) {}
  }, []);

  // Member action request — attention knock: two quick low taps + rising ping
  const memberRequest = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      // Two soft knock taps
      [0, 0.12].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now + offset);
        osc.frequency.exponentialRampToValueAtTime(160, now + offset + 0.08);
        gain.gain.setValueAtTime(0.14, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
      // Rising ping after the knock
      const ping = ctx.createOscillator();
      const pingGain = ctx.createGain();
      ping.connect(pingGain);
      pingGain.connect(ctx.destination);
      ping.type = 'sine';
      ping.frequency.setValueAtTime(660, now + 0.28);
      ping.frequency.exponentialRampToValueAtTime(990, now + 0.5);
      pingGain.gain.setValueAtTime(0, now + 0.28);
      pingGain.gain.linearRampToValueAtTime(0.08, now + 0.32);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      ping.start(now + 0.28);
      ping.stop(now + 0.58);
    } catch (_) {}
  }, []);

  // Vote result — gavel strike then crowd cheering (preloaded)
  const voteResult = useCallback(() => {
    try {
      const gavel = gavelRef.current;
      const cheer = cheerRef.current;
      gavel.currentTime = 0;
      cheer.currentTime = 0;
      // Start muted, unmute once playback starts (OBS / autoplay policy)
      gavel.muted = true;
      cheer.muted = true;
      gavel.play().then(() => { gavel.muted = false; }).catch(() => {});
      cheer.play().then(() => { cheer.muted = false; }).catch(() => {});
    } catch (_) {}
  }, []);

  // Research result — upward sparkle arpeggio
  const research = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [1047, 1319, 1568].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.07;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch (_) {}
  }, []);

  return { click, send, receive, speakerPick, vote, autoOn, autoOff, research, memberRequest, voteResult };
}
