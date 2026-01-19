const assert = require("assert");
const { Player, createPlayers } = require("../src/models/player");
const { Game, loadGame, GAME_STATES } = require("../src/models/game");
const { createCorporations } = require("../src/models/corporation");
const { createApp } = require("../src/app");
const { createLobbiesRouter } = require("../src/routers/lobbies-router");
const { createLobbyRouter } = require("../src/routers/lobby-router");
const { createGameRouter } = require("../src/routers/game-router");
const LobbyManager = require("../src/models/lobby-manager");

/**
 * Create a test game with the specified number of players
 * @param {number} playerCount - Number of players
 * @param {Object} options - Options for game creation
 * @param {Function} options.shuffle - Shuffle function (default: identity)
 * @param {boolean} options.start - Whether to start the game (default: true)
 * @returns {Object} - { game, players, corporations }
 */
const createTestGame = (playerCount, options = {}) => {
  const { shuffle = x => x, start = true } = options;
  
  const playerNames = ["Biswa", "Bittu", "Qasim", "Utsab", "Debu", "Swagato"];
  const players = playerNames.slice(0, playerCount).map(name => new Player(name));
  const corporations = createCorporations();
  
  const game = new Game(players, shuffle, corporations);
  
  if (start) {
    game.start();
  }
  
  return { game, players, corporations };
};

/**
 * Create test players
 * @param {number} count - Number of players to create
 * @param {Object} options - Options for player creation
 * @returns {Player[]} - Array of players
 */
const createTestPlayers = (count, options = {}) => {
  const { withStocks = false, balance = 0 } = options;
  const playerNames = ["Biswa", "Bittu", "Qasim", "Utsab", "Debu", "Swagato"];
  
  return playerNames.slice(0, count).map(name => {
    const stocks = withStocks ? {
      phoenix: 0, quantum: 0, hydra: 0,
      fusion: 0, america: 0, sackson: 0, zeta: 0,
    } : {};
    return new Player(name, balance, stocks);
  });
};

/**
 * Create a test Express app with all routers
 * @param {Object} options - Options
 * @returns {Object} - { app, lobbyManager }
 */
const createTestApp = (options = {}) => {
  const { shuffle = x => x } = options;
  
  const lobbyManager = new LobbyManager({
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
  });
  
  const lobbiesRouter = createLobbiesRouter();
  const lobbyRouter = createLobbyRouter();
  const gameRouter = createGameRouter();
  
  const app = createApp(lobbiesRouter, lobbyRouter, gameRouter, { 
    lobbyManager, 
    shuffle 
  });
  
  return { app, lobbyManager };
};

/**
 * Create a lobby and return its ID
 * @param {LobbyManager} lobbyManager 
 * @param {string} hostUsername 
 * @param {Object} size 
 * @returns {string} - Lobby ID
 */
const createTestLobby = (lobbyManager, hostUsername = "host", size = { lowerLimit: 2, upperLimit: 6 }) => {
  return lobbyManager.createLobby(size, hostUsername);
};

/**
 * Assert game is in expected state
 * @param {Game} game 
 * @param {string} expectedState 
 * @param {string} username 
 */
const assertState = (game, expectedState, username) => {
  const { state } = game.status(username);
  assert.strictEqual(state, expectedState, `Expected state ${expectedState} but got ${state}`);
};

/**
 * Assert game is NOT in a specific state
 * @param {Game} game 
 * @param {string} notExpectedState 
 * @param {string} username 
 */
const assertNotState = (game, notExpectedState, username) => {
  const { state } = game.status(username);
  assert.notStrictEqual(state, notExpectedState, `Expected state to NOT be ${notExpectedState}`);
};

/**
 * Get the current player from a game
 * @param {Object} status - Game status object
 * @returns {Object} - Current player info
 */
const getCurrentPlayer = (status) => {
  return status.players.find(p => p.isTakingTurn);
};

/**
 * Identity shuffle function (no shuffling)
 */
const noShuffle = x => x;

/**
 * Reverse shuffle function (for predictable ordering)
 */
const reverseShuffle = arr => [...arr].reverse();

module.exports = {
  createTestGame,
  createTestPlayers,
  createTestApp,
  createTestLobby,
  assertState,
  assertNotState,
  getCurrentPlayer,
  noShuffle,
  reverseShuffle,
  createCorporations,
  createPlayers,
  loadGame,
  GAME_STATES,
  Player,
  Game,
  LobbyManager,
};
