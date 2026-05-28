import { useEffect, useState, useRef } from 'react';
import './PresenceBeacon.css';

// Tiny sound generator using Web Audio API
const playTone = (frequency, duration, type = 'sine', volume = 0.15) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
};

const playJoinSound = () => playTone(880, 0.3, 'sine', 0.12);   // gentle high beep
const playLeaveSound = () => playTone(440, 0.4, 'sine', 0.08);  // lower, softer

export default function PresenceBeacon({ name = 'Subash', initiallyVisible = true }) {
  const [visible, setVisible] = useState(initiallyVisible);

  // Simulate arrival/departure when toggled
  useEffect(() => {
    if (visible) {
      playJoinSound();
    } else {
      playLeaveSound();
    }
  }, [visible]);

  return (
    <div className={`presence-beacon ${visible ? 'beacon-enter' : 'beacon-exit'}`}>
      <div className="user-cursor-dot" />
      <span className="presence-text">{name} is here</span>

      {/* Demo toggle – remove when real presence is wired up */}
      <button
        className="demo-toggle"
        onClick={() => setVisible(v => !v)}
        title="Simulate arrival/departure"
      >
        {visible ? '✕' : '◀'}
      </button>
    </div>
  );
}