// Namespaced localStorage access with validation. Nothing else touches localStorage directly.
import { safeParse } from '../utils/helpers.js';

class StorageManager {
  getRaw(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn('[Storage] read failed:', key, error);
      return null;
    }
  }

  setRaw(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      console.warn('[Storage] write failed:', key, error);
      return false;
    }
  }

  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn('[Storage] remove failed:', key, error);
    }
  }

  /** Load JSON with a validator; corrupt data is discarded and replaced by fallback. */
  loadJSON(key, fallback, validate) {
    const raw = this.getRaw(key);
    if (raw === null) return structuredFallback(fallback);
    const parsed = safeParse(raw, undefined);
    if (parsed === undefined) {
      console.warn(`[Storage] corrupted data at ${key}; resetting to defaults.`);
      return structuredFallback(fallback);
    }
    if (typeof validate === 'function' && !validate(parsed)) {
      console.warn(`[Storage] invalid shape at ${key}; resetting to defaults.`);
      return structuredFallback(fallback);
    }
    return parsed;
  }

  saveJSON(key, value) {
    try {
      return this.setRaw(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[Storage] serialize failed:', key, error);
      return false;
    }
  }
}

function structuredFallback(fallback) {
  if (Array.isArray(fallback)) return [...fallback];
  if (fallback && typeof fallback === 'object') return { ...fallback };
  return fallback;
}

export const storageManager = new StorageManager();
export { StorageManager };
