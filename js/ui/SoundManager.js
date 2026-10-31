// Optional WebAudio bleeps. No assets required; silent when muted/unavailable.
import { STORAGE_KEYS } from '../utils/constants.js';
import { storageManager } from '../core/StorageManager.js';

let audioContext = null;
let muted = false;

function context() {
  if (muted) return null;
  try {
    if (!audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioContext = new AC();
    }
    if (audioContext.state === 'suspended') void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function tone(frequency, durationMs = 120, type = 'sine', gain = 0.06) {
  const ctx = context();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch { /* sound is decorative; never break gameplay */ }
}

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

export function loadMutePreference() {
  const settings = storageManager.loadJSON(STORAGE_KEYS.settings, {}, (v) => v && typeof v === 'object');
  muted = settings && settings.sound === 'off';
  return muted;
}

export const SoundManager = {
  setMuted, isMuted, loadMutePreference,
  click: () => tone(620, 60, 'triangle'),
  deal: () => tone(440, 90, 'sine'),
  win: () => { tone(523, 120); setTimeout(() => tone(784, 160), 110); },
  lose: () => tone(196, 220, 'sawtooth', 0.04),
  spin: () => tone(330, 200, 'sine', 0.04)
};
