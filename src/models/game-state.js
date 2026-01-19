/**
 * Game States Enum
 */
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

/**
 * Valid state transitions
 */
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

/**
 * GameStateManager handles game state transitions with validation.
 * Implements a state machine pattern for clear game flow control.
 */
class GameStateManager {
  #currentState;
  #stateInfo;
  #stateHistory;

  constructor(initialState = GAME_STATES.SETUP) {
    this.#currentState = initialState;
    this.#stateInfo = {};
    this.#stateHistory = [{ state: initialState, timestamp: Date.now() }];
  }

  /**
   * Get current state
   */
  get state() {
    return this.#currentState;
  }

  /**
   * Get state info/metadata
   */
  get info() {
    return { ...this.#stateInfo };
  }

  /**
   * Set state info/metadata
   */
  setInfo(info) {
    this.#stateInfo = { ...this.#stateInfo, ...info };
  }

  /**
   * Clear state info
   */
  clearInfo() {
    this.#stateInfo = {};
  }

  /**
   * Transition to a new state
   * @throws {Error} if transition is not valid
   */
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

  /**
   * Force transition to a state (bypasses validation)
   * Use sparingly, mainly for loading saved games
   */
  forceTransition(newState, info = {}) {
    this.#currentState = newState;
    this.#stateInfo = info;
    return this;
  }

  /**
   * Check if a transition is valid
   */
  canTransitionTo(newState) {
    const validTransitions = STATE_TRANSITIONS[this.#currentState] || [];
    return validTransitions.includes(newState);
  }

  /**
   * Check if game is in a specific state
   */
  isIn(state) {
    return this.#currentState === state;
  }

  /**
   * Check if game is in any of the given states
   */
  isInAny(...states) {
    return states.includes(this.#currentState);
  }

  /**
   * Check if game has ended
   */
  get isGameOver() {
    return this.#currentState === GAME_STATES.GAME_END;
  }

  /**
   * Check if game is in a merge-related state
   */
  get isMerging() {
    return this.isInAny(
      GAME_STATES.MERGE,
      GAME_STATES.MERGE_CONFLICT,
      GAME_STATES.ACQUIRER_SELECTION,
      GAME_STATES.DEFUNCT_SELECTION
    );
  }

  /**
   * Get state history
   */
  get history() {
    return [...this.#stateHistory];
  }

  /**
   * Serialize state for saving
   */
  toJSON() {
    return {
      currentState: this.#currentState,
      stateInfo: this.#stateInfo,
    };
  }

  /**
   * Restore from saved state
   */
  static fromJSON({ currentState, stateInfo }) {
    const manager = new GameStateManager(currentState);
    manager.#stateInfo = stateInfo || {};
    return manager;
  }
}

module.exports = { GameStateManager, GAME_STATES, STATE_TRANSITIONS };
