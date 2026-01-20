const GAME_STATES = {
  SETUP: "setup",
  PLACE_TILE: "place-tile",
  TILE_PLACED: "tile-placed",
  ESTABLISH_CORPORATION: "establish-corporation",
  BUY_STOCKS: "buy-stocks",
  GAME_END: "game-end",
  MERGE: "merge",
  MERGE_CONFLICT: "merge-conflict",
  ACQUIRER_SELECTION: "acquirer-selection",
  DEFUNCT_SELECTION: "defunct-selection",
};

const STATE_TRANSITIONS = {
  [GAME_STATES.SETUP]: [GAME_STATES.PLACE_TILE],
  [GAME_STATES.PLACE_TILE]: [
    GAME_STATES.TILE_PLACED,
    GAME_STATES.ESTABLISH_CORPORATION,
    GAME_STATES.BUY_STOCKS,
    GAME_STATES.MERGE,
    GAME_STATES.MERGE_CONFLICT,
    GAME_STATES.ACQUIRER_SELECTION,
  ],
  [GAME_STATES.TILE_PLACED]: [GAME_STATES.PLACE_TILE, GAME_STATES.GAME_END],
  [GAME_STATES.ESTABLISH_CORPORATION]: [GAME_STATES.BUY_STOCKS],
  [GAME_STATES.BUY_STOCKS]: [GAME_STATES.TILE_PLACED],
  [GAME_STATES.MERGE]: [
    GAME_STATES.BUY_STOCKS,
    GAME_STATES.MERGE,
    GAME_STATES.ACQUIRER_SELECTION,
    GAME_STATES.DEFUNCT_SELECTION,
  ],
  [GAME_STATES.MERGE_CONFLICT]: [GAME_STATES.MERGE],
  [GAME_STATES.ACQUIRER_SELECTION]: [GAME_STATES.MERGE, GAME_STATES.DEFUNCT_SELECTION],
  [GAME_STATES.DEFUNCT_SELECTION]: [GAME_STATES.MERGE],
  [GAME_STATES.GAME_END]: [],
};

class GameStateManager {
  #currentState;
  #stateInfo;
  #stateHistory;

  constructor(initialState = GAME_STATES.SETUP) {
    this.#currentState = initialState;
    this.#stateInfo = {};
    this.#stateHistory = [{ state: initialState, timestamp: Date.now() }];
  }

  get state() {
    return this.#currentState;
  }

  get info() {
    return { ...this.#stateInfo };
  }

  setInfo(info) {
    this.#stateInfo = { ...this.#stateInfo, ...info };
  }

  clearInfo() {
    this.#stateInfo = {};
  }

  transitionTo(newState, info = {}) {
    if (!this.canTransitionTo(newState)) {
      throw new Error(
        `Invalid state transition: ${this.#currentState} -> ${newState}`
      );
    }

    this.#currentState = newState;
    this.#stateInfo = info;
    this.#stateHistory.push({
      state: newState,
      timestamp: Date.now(),
      info,
    });

    return this;
  }

  forceTransition(newState, info = {}) {
    this.#currentState = newState;
    this.#stateInfo = info;
    return this;
  }

  canTransitionTo(newState) {
    const validTransitions = STATE_TRANSITIONS[this.#currentState] || [];
    return validTransitions.includes(newState);
  }

  isIn(state) {
    return this.#currentState === state;
  }

  isInAny(...states) {
    return states.includes(this.#currentState);
  }

  get isGameOver() {
    return this.#currentState === GAME_STATES.GAME_END;
  }

  get isMerging() {
    return this.isInAny(
      GAME_STATES.MERGE,
      GAME_STATES.MERGE_CONFLICT,
      GAME_STATES.ACQUIRER_SELECTION,
      GAME_STATES.DEFUNCT_SELECTION
    );
  }

  get history() {
    return [...this.#stateHistory];
  }

  toJSON() {
    return {
      currentState: this.#currentState,
      stateInfo: this.#stateInfo,
    };
  }

  static fromJSON({ currentState, stateInfo }) {
    const manager = new GameStateManager(currentState);
    manager.#stateInfo = stateInfo || {};
    return manager;
  }
}

module.exports = { GameStateManager, GAME_STATES, STATE_TRANSITIONS };
