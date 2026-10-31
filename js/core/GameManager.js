// Game registry: new games plug in here without touching existing code.
class GameManager {
  constructor() {
    this.games = new Map();
  }

  register(id, { name, description, route, controller }) {
    if (this.games.has(id)) throw new Error(`Game "${id}" already registered`);
    this.games.set(id, { id, name, description, route, controller });
  }

  get(id) {
    return this.games.get(id);
  }

  list() {
    return [...this.games.values()];
  }
}

export const gameManager = new GameManager();
export { GameManager };
