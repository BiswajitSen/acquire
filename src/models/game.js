const { groupBy, sortBy } = require("lodash");
const { Player } = require("./player");
const { Corporation } = require("./corporation");
const Merger = require("./merger");
const { TurnManager, ACTIVITIES } = require("./turn-manager");
const { Board } = require("./board");
const { TileManager } = require("./tile-manager");
const { GameStateManager, GAME_STATES } = require("./game-state");
const { StockMarket } = require("./stock-market");
const { GAME_CONFIG } = require("./game-config");

/**
 * Game class - Main game orchestrator
 * Delegates to specialized components for different concerns:
 * - Board: tile placement and connectivity
 * - TileManager: tile stack operations
 * - GameStateManager: state machine
 * - StockMarket: stock operations
 * - TurnManager: turn history
 * - Merger: merger logic
 */
class Game {
  #board;
  #tileManager;
  #stateManager;
  #stockMarket;
  #turnManager;
  #corporations;
  #players;
  #setupTiles;
  #connectedTiles;
  #result;
  #merger;
  #turnCount;

  constructor(players, shuffle, corporations) {
    this.#players = players;
    this.#corporations = corporations;
    this.#turnCount = 0;
    this.#setupTiles = [];
    this.#connectedTiles = [];
    this.#result = null;
    this.#merger = null;
    this.#board = new Board(GAME_CONFIG.BOARD_ROWS, GAME_CONFIG.BOARD_COLS);
    this.#tileManager = new TileManager(shuffle, GAME_CONFIG.BOARD_ROWS, GAME_CONFIG.BOARD_COLS);
    this.#stateManager = new GameStateManager(GAME_STATES.SETUP);
    this.#turnManager = new TurnManager();
  }

  setup() {
    this.#tileManager.createTiles().shuffle();
    this.#provideInitialAssets();
    this.#decidePlayingOrder();
    this.#initializeStockMarket();
  }

  start() {
    this.setup();
    this.#stateManager.forceTransition(GAME_STATES.PLACE_TILE);
    this.#currentPlayer().startTurn();
    this.#turnManager.initiateActivity(ACTIVITIES.tilePlace);
  }

  #provideInitialAssets() {
    this.#players.forEach(player => {
      player.addIncome(GAME_CONFIG.INITIAL_BALANCE);
      this.#tileManager.distributeToPlayer(player, GAME_CONFIG.TILES_PER_PLAYER);
    });
  }

  #decidePlayingOrder() {
    this.#setupTiles = this.#players.map(player => [player, this.#tileManager.pickTile()]);

    const sortedTiles = [...this.#setupTiles].sort(([, a], [, b]) => {
      return a.position.x - b.position.x || a.position.y - b.position.y;
    });

    this.#players = sortedTiles.map(([player]) => player);

    sortedTiles.forEach(([, tile]) => {
      this.#board.placeTile(tile.position, "incorporated");
    });
  }

  #initializeStockMarket() {
    this.#stockMarket = new StockMarket(this.#corporations, this.#players);
  }

  #currentPlayer() {
    return this.#players[this.#turnCount % this.#players.length];
  }

  currentPlayerName() {
    return this.#currentPlayer().username;
  }

  changeTurn() {
    if (this.#checkGameEnd()) {
      this.#endGame();
      return;
    }

    this.#refillPlayerTile();
    this.#currentPlayer().endTurn();
    this.#turnCount++;
    this.#currentPlayer().startTurn();

    this.#stateManager.forceTransition(GAME_STATES.PLACE_TILE);
    this.#turnManager.changeTurn();
    this.#turnManager.initiateActivity(ACTIVITIES.tilePlace);
  }

  #refillPlayerTile() {
    const currentPlayer = this.#currentPlayer();
    const newTile = this.#tileManager.pickTile();
    currentPlayer.refillTile(newTile);

    const { tiles } = currentPlayer.portfolio();
    const exchangedTiles = tiles.map(tile => {
      if (tile && tile.exchange === "yes") {
        return this.#tileManager.pickTile();
      }
      return tile;
    });
    currentPlayer.exchangeTiles(exchangedTiles);
  }

  placeTile(username, position) {
    const player = this.#players.find(p => p.username === username);
    const tile = this.#board.placeTile(position, "incorporated");
    this.#turnManager.consolidateActivity(tile);
    this.#connectedTiles = this.#board.findConnectedTiles(position);
    const groupedTiles = this.#board.groupTilesByCorporation(this.#connectedTiles);
    player.placeTile(position);
    this.#handleTilePlacement(groupedTiles);
  }

  #handleTilePlacement(groupedTiles) {
    if (this.#canEstablishCorporation(groupedTiles)) {
      this.#stateManager.forceTransition(GAME_STATES.ESTABLISH_CORPORATION);
      this.#turnManager.initiateActivity(ACTIVITIES.establish);
      return;
    }

    if (this.#canGrowCorporation(groupedTiles)) {
      const corpName = Object.keys(groupedTiles).find(name => name !== "incorporated");
      this.#growCorporation(corpName);
      this.#stateManager.forceTransition(GAME_STATES.BUY_STOCKS);
      this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
      return;
    }

    if (this.#hasMergeConflict(groupedTiles)) {
      this.#handleMergeConflict();
      return;
    }

    if (this.#hasMultipleMerge(groupedTiles)) {
      this.#handleMultipleMerge();
      return;
    }

    if (this.#hasTwoCorpMerge(groupedTiles)) {
      const [acquirer, defunct] = this.#findMergingCorporations();
      this.mergeTwoCorporation({ acquirer: acquirer.name, defunct: defunct.name });
      return;
    }

    this.#stateManager.forceTransition(GAME_STATES.BUY_STOCKS);
    this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
  }

  #canEstablishCorporation(groupedTiles) {
    const hasInactiveCorp = Object.values(this.#corporations).some(corp => !corp.isActive);
    return Object.keys(groupedTiles).length === 1 &&
           groupedTiles.incorporated?.length > 1 &&
           hasInactiveCorp;
  }

  #canGrowCorporation(groupedTiles) {
    return Object.keys(groupedTiles).length === 2 &&
           groupedTiles.incorporated?.length >= 1;
  }

  establishCorporation({ name }) {
    const player = this.#currentPlayer();
    const corporation = this.#corporations[name];

    corporation.establish();
    this.#growCorporation(name);
    player.addStocks(name, 1);
    corporation.decrementStocks(1);

    this.#stateManager.forceTransition(GAME_STATES.BUY_STOCKS);
    this.#turnManager.consolidateActivity({ name });
    this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
  }

  #growCorporation(name) {
    const corporation = this.#corporations[name];
    const incorporatedTiles = this.#connectedTiles.filter(
      ({ belongsTo }) => belongsTo === "incorporated"
    );

    this.#board.assignTilesToCorporation(incorporatedTiles, name);

    if (!this.#stateManager.isMerging) {
      corporation.increaseSize(incorporatedTiles.length);
    }

    if (corporation.stats().size > 10) {
      corporation.markSafe();
      this.#markUnplayableTiles();
    }
  }

  #markUnplayableTiles() {
    this.#players.forEach(player => {
      const { tiles } = player.portfolio();

      tiles.forEach(tile => {
        if (!tile || tile.isPlaced) return;

        const adjacentTiles = this.#board.getAdjacentTiles(tile.position);
        const groupedTiles = this.#board.groupTilesByCorporation(adjacentTiles);
        const adjacentCorps = Object.keys(groupedTiles);
        
        const safeCorporations = adjacentCorps.filter(corp => {
          if (corp === "undefined" || corp === "incorporated") return false;
          return this.#corporations[corp]?.isSafe;
        });

        if (safeCorporations.length > 1) {
          tile.exchange = "yes";
        }
      });
    });
  }

  #findMergingCorporations() {
    const corporatedTiles = this.#connectedTiles.filter(
      ({ belongsTo }) => belongsTo !== "incorporated"
    );
    const groupedTiles = groupBy(corporatedTiles, "belongsTo");
    const corps = Object.keys(groupedTiles).map(name => this.#corporations[name]);
    return sortBy(corps, corp => corp.size).reverse();
  }

  #hasTwoCorpMerge(groupedTiles) {
    return Object.keys(groupedTiles).length === 3;
  }

  #hasMergeConflict(groupedTiles) {
    if (Object.keys(groupedTiles).length !== 3) return false;
    const [corp1, corp2] = this.#findMergingCorporations();
    return corp1.size === corp2.size;
  }

  #hasMultipleMerge(groupedTiles) {
    return Object.keys(groupedTiles).length > 3;
  }

  #handleMergeConflict() {
    this.#stateManager.forceTransition(GAME_STATES.MERGE_CONFLICT);
    const equalCorporations = this.#findMergingCorporations().map(corp => corp.name);

    this.#turnManager.initiateActivity(ACTIVITIES.mergeConflict);
    this.#stateManager.setInfo({ isMergeConflict: true, equalCorporations });
    this.#turnManager.consolidateActivity(equalCorporations);
  }

  #handleMultipleMerge() {
    const mergingCorporations = this.#findMergingCorporations();
    const acquirerSize = mergingCorporations[0].size;
    const potentialAcquirers = mergingCorporations.filter(corp => corp.size === acquirerSize);

    if (potentialAcquirers.length > 1) {
      this.#stateManager.forceTransition(GAME_STATES.ACQUIRER_SELECTION);
      const acquirerNames = potentialAcquirers.map(corp => corp.name);
      this.#turnManager.initiateActivity(ACTIVITIES.acquirerSelection);
      this.#turnManager.consolidateActivity(acquirerNames);
      return;
    }

    const [acquirer] = potentialAcquirers;
    this.#stateManager.setInfo({ acquirer: acquirer.name });

    const potentialDefunct = mergingCorporations.filter(corp => corp.size !== acquirerSize);
    const defunctSize = potentialDefunct[0]?.size;
    const equalDefunct = potentialDefunct.filter(corp => corp.size === defunctSize);

    if (equalDefunct.length > 1) {
      this.#handleMultipleDefunct(equalDefunct);
      return;
    }

    const [defunct] = potentialDefunct;
    this.mergeTwoCorporation({ acquirer: acquirer.name, defunct: defunct.name }, true);
  }

  #handleMultipleDefunct(potentialDefunct) {
    const existingInfo = this.#stateManager.info;
    this.#stateManager.forceTransition(GAME_STATES.DEFUNCT_SELECTION, existingInfo);
    const defunctNames = potentialDefunct.map(corp => corp.name);

    this.#turnManager.initiateActivity(ACTIVITIES.defunctSelection);
    this.#turnManager.consolidateActivity(defunctNames);
  }

  selectAcquirer(acquirerName) {
    this.#stateManager.setInfo({ acquirer: acquirerName });
    const mergingCorporations = this.#findMergingCorporations();
    const otherThanAcquirer = mergingCorporations.filter(corp => corp.name !== acquirerName);

    const defunctSize = otherThanAcquirer[0].size;
    const potentialDefunct = otherThanAcquirer.filter(corp => corp.size === defunctSize);

    if (potentialDefunct.length > 1) {
      return this.#handleMultipleDefunct(potentialDefunct);
    }

    const [defunct] = potentialDefunct;
    this.mergeTwoCorporation({ acquirer: acquirerName, defunct: defunct.name }, true);
  }

  confirmDefunct(defunct) {
    const { acquirer } = this.#stateManager.info;
    this.mergeTwoCorporation({ acquirer, defunct }, true);
  }

  mergeTwoCorporation({ acquirer, defunct }, multipleMerge = false) {
    this.#merger = new Merger(
      this.#players.length,
      this.#corporations,
      this.#connectedTiles,
      multipleMerge
    );
    this.#merger.start(acquirer, defunct);

    const bonusStats = this.#stockMarket.distributeBonuses(defunct);

    this.#stateManager.forceTransition(GAME_STATES.MERGE, {
      acquirer: this.#merger.acquirer,
      defunct: this.#merger.defunct,
    });
    this.#turnManager.initiateActivity(ACTIVITIES.merge);

    this.#consolidateMergeActivity(bonusStats);
  }

  #consolidateMergeActivity(bonusStats) {
    this.#turnManager.consolidateActivity({
      acquirer: this.#merger.acquirer,
      defunct: this.#merger.defunct,
      turns: this.#merger.getTurns(),
      ...bonusStats,
    });
  }

  dealDefunctStocks({ sell, trade }) {
    this.#merger.deal(this.#currentPlayer(), sell, trade);
    this.endMergerTurn();
  }

  endMergerTurn() {
    this.#merger.endTurn();
    this.#currentPlayer().endTurn();
    this.#turnCount++;
    this.#currentPlayer().startTurn();

    const bonusStats = this.#stockMarket.distributeBonuses(this.#merger.defunct);
    this.#consolidateMergeActivity(bonusStats);

    if (this.#merger.hasEnd()) {
      this.#merger.end();
      this.#markUnplayableTiles();

      const groupedTiles = this.#board.groupTilesByCorporation(this.#connectedTiles);
      this.#handleTilePlacement(groupedTiles);
    }
  }

  endMerge() {
    this.#stateManager.forceTransition(GAME_STATES.BUY_STOCKS);
    this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
  }

  buyStocks(stocks) {
    const player = this.#currentPlayer();
    const purchased = this.#stockMarket.buyStocks(player, stocks);

    this.#stateManager.forceTransition(GAME_STATES.TILE_PLACED);
    this.#turnManager.consolidateActivity(purchased);
  }

  #checkGameEnd() {
    const activeCorporations = Object.values(this.#corporations).filter(corp => corp.isActive);

    if (activeCorporations.length === 0) return false;

    const hasLargeCorp = activeCorporations.some(corp => corp.size >= GAME_CONFIG.GAME_END_SIZE);
    const allSafe = activeCorporations.every(corp => corp.isSafe);

    return hasLargeCorp || allSafe;
  }

  #endGame() {
    this.#stateManager.forceTransition(GAME_STATES.GAME_END);
    this.#result = { players: [], bonuses: [] };
    this.#calculateFinalEarnings();
  }

  #calculateFinalEarnings() {
    const activeCorporations = Object.entries(this.#corporations)
      .filter(([, corp]) => corp.isActive);

    activeCorporations.forEach(([name]) => {
      const bonusStats = this.#stockMarket.distributeBonuses(name);
      this.#result.bonuses.push(bonusStats);
      this.#stockMarket.liquidateCorporation(name);
    });

    this.#result.players = this.#players.map(player => {
      const { stocks, balance } = player.portfolio();
      return { stocks, balance, name: player.username };
    });
  }

  status(username) {
    return {
      state: this.#stateManager.state,
      stateInfo: this.#stateManager.info,
      setupTiles: this.#setupTiles.map(([player, tile]) => [player.username, tile]),
      turns: this.#getTurns(username),
      players: this.#getPlayers(username),
      portfolio: this.playerDetails(username),
      corporations: this.#getCorporationStats(),
      placedTiles: this.#board.placedTiles,
    };
  }

  playerDetails(username) {
    const player = this.#players.find(p => p.username === username);
    return player.portfolio();
  }

  #getPlayers(username) {
    return this.#players.map(player => ({
      username: player.username,
      isTakingTurn: player.isTakingTurn,
      you: player.username === username,
    }));
  }

  #getCorporationStats() {
    return Object.fromEntries(
      Object.entries(this.#corporations).map(([name, corporation]) => [
        name,
        corporation.stats(),
      ])
    );
  }

  #getTurns(username) {
    const turns = this.#turnManager.getTurns();
    const player = this.#currentPlayer();
    turns.currentTurn.player = {
      you: player.username === username,
      username: player.username,
    };
    return turns;
  }

  get result() {
    return this.#result;
  }

  findMajorityMinority(corpName) {
    return this.#stockMarket.findShareholderGroups(corpName);
  }

  distributeMajorityMinority(corpName) {
    const stats = this.#stockMarket.distributeBonuses(corpName);
    this.distributeMajorityMinority.stats = stats;
    return stats;
  }

  static fromJSON({ tiles, players, corporations, setupTiles, placedTiles }) {
    const game = new Game(players, () => [], corporations);

    game.#stateManager.forceTransition(GAME_STATES.PLACE_TILE);
    game.#setupTiles = setupTiles;
    game.#turnCount = 0;

    placedTiles.forEach(tile => {
      game.#board.placeTile(tile.position, tile.belongsTo);
    });

    if (tiles && tiles.length > 0) {
      game.#tileManager = TileManager.fromJSON(tiles, () => []);
    }

    game.#initializeStockMarket();
    players[0].startTurn();
    game.#turnManager.initiateActivity(ACTIVITIES.tilePlace);

    return game;
  }
}

const loadGame = gameData => {
  const data = JSON.parse(JSON.stringify(gameData));
  return Game.fromJSON({
    ...data,
    players: gameData.players.map(player => Player.fromJSON(player)),
    corporations: Object.fromEntries(
      Object.entries(gameData.corporations).map(([name, data]) => [
        name,
        Corporation.fromJSON({ ...data, name }),
      ])
    ),
  });
};

module.exports = {
  Game,
  loadGame,
  GAME_STATES: {
    setup: GAME_STATES.SETUP,
    placeTile: GAME_STATES.PLACE_TILE,
    tilePlaced: GAME_STATES.TILE_PLACED,
    establishCorporation: GAME_STATES.ESTABLISH_CORPORATION,
    buyStocks: GAME_STATES.BUY_STOCKS,
    gameEnd: GAME_STATES.GAME_END,
    merge: GAME_STATES.MERGE,
    mergeConflict: GAME_STATES.MERGE_CONFLICT,
    acquirerSelection: GAME_STATES.ACQUIRER_SELECTION,
    multipleDefunct: GAME_STATES.DEFUNCT_SELECTION,
    defunctSelection: GAME_STATES.DEFUNCT_SELECTION,
  },
};
