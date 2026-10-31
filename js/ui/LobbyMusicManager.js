// Central background-music system: one track per casino section, but only ONE
// shared Audio instance for the whole session. Game sound effects
// (SoundManager) are a completely separate system and stay untouched.
import { STORAGE_KEYS } from '../utils/constants.js';
import { storageManager } from '../core/StorageManager.js';

const TRACKS = Object.freeze({
  lobby: 'assets/casino-music.mp3',
  lobbyZakaria: 'assets/zakaria-music.mp3',
  blackjack: 'assets/blackjack-music.mp3',
  roulette: 'assets/roulette-music.mp3',
  slots: 'assets/slots-music.mp3',
  baccarat: 'assets/baccarat-music.mp3'
});

const MUSIC_ROUTES = new Set(['lobby', 'blackjack', 'roulette', 'slots', 'baccarat']);
const DEFAULT_VOLUME = 0.50; // 50%: present but never overpowering

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, n));
}

class BackgroundMusicManager {
  constructor() {
    this.audio = null;
    this.currentTrack = '';
    this.username = 'guest';
    this.volume = this.loadVolume();
    this.entranceReady = false; // true only after intro video + welcome (or returning member)
    this.unlockAttached = false;
    this.lastRoute = 'lobby';
  }

  loadVolume() {
    const settings = storageManager.loadJSON(STORAGE_KEYS.settings, {}, (v) => v && typeof v === 'object');
    return clampVolume(settings && settings.musicVolume !== undefined ? settings.musicVolume : DEFAULT_VOLUME);
  }

  persistVolume() {
    const settings = storageManager.loadJSON(STORAGE_KEYS.settings, {}, (v) => v && typeof v === 'object') || {};
    settings.musicVolume = this.volume;
    storageManager.saveJSON(STORAGE_KEYS.settings, settings);
  }

  getVolume() {
    return this.volume;
  }

  /** Single volume control for ALL background music. Game effects are unaffected. */
  setVolume(value) {
    this.volume = clampVolume(value);
    if (this.audio) this.audio.volume = this.volume;
    this.persistVolume();
  }

  resetVolume() {
    this.setVolume(DEFAULT_VOLUME);
  }

  /** Username matching is trim + lowercase, so any Zakaria variation matches. */
  trackFor(route) {
    if (route === 'lobby') {
      const normalized = String(this.username || '').trim().toLowerCase();
      return normalized === 'zakaria' ? TRACKS.lobbyZakaria : TRACKS.lobby;
    }
    return TRACKS[route] || '';
  }

  /** Lazily creates the ONE audio instance. */
  ensureAudio() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.volume = this.volume;
      this.audio.preload = 'auto';
      this.audio.src = this.trackFor('lobby');
      this.currentTrack = this.trackFor('lobby');
    }
    return this.audio;
  }

setUser(username) {
  this.username = String(username || 'guest');
}

  setEntranceReady() {
    this.entranceReady = true;
  }

  signOut() {
    this.stop();
    this.entranceReady = false;
  }

  async playRoute(route) {
    const wanted = this.trackFor(route);
    if (!wanted) return;
    const audio = this.ensureAudio();
    if (this.currentTrack !== wanted) {
      // Clean switch: stop the old track before starting the new one.
      audio.pause();
      audio.src = wanted;
      this.currentTrack = wanted;
    }
    audio.volume = this.volume;
    if (!audio.paused) return; // already playing: never stack a duplicate
    try {
      await audio.play();
    } catch {
      // Autoplay blocked before first gesture: retry once the user interacts.
      this.waitForGesture();
    }
  }

  waitForGesture() {
    if (this.unlockAttached) return;
    this.unlockAttached = true;
    const retry = () => {
      this.unlockAttached = false;
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
      if (this.entranceReady && MUSIC_ROUTES.has(this.lastRoute)) void this.playRoute(this.lastRoute);
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
  }

  /** Follows the actual route: section music plays, anything else stops. */
  sync(route) {
    this.lastRoute = route;
    if (this.entranceReady && MUSIC_ROUTES.has(route)) {
      void this.playRoute(route);
    } else {
      this.stop();
    }
  }

  playLobby() {
    void this.playRoute('lobby');
  }

  stop() {
    if (this.audio && !this.audio.paused) this.audio.pause();
  }
}

export const LobbyMusic = new BackgroundMusicManager();
