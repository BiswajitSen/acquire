const { range, groupBy, sortBy } = require("lodash");
const { Player } = require("./player");
const { Corporation } = require("./corporation");
const Merger = require("./merger");
const { TurnManager, ACTIVITIES } = require("./turn-manager");
const GAME_STATES = {
  setup: "setup",
  placeTile: "place-tile",
  tilePlaced: "tile-placed",
  establishCorporation: "establish-corporation",
  buyStocks: "buy-stocks",
  gameEnd: "game-end",
  merge: "merge",
  mergeConflict: "merge-conflict",
  acquirerSelection: "acquirer-selection",
  multipleDefunct: "multiple-defunct",
  defunctSelection: "defunct-selection",
};

class Game {
  #tiles;
  #state;
  #stateInfo; // attach with state
  #corporations;
  #shuffle;
  #players;
  #incorporatedTiles;
  #placedTiles;
  #setupTiles;
  #turnCount;
  #connectedTiles;
  #handlers;
  #result;
  #merger;
  #turnManager;

  constructor(players, shuffle, corporations) {
    this.#tiles = [];
    this.#placedTiles = [];
    this.#incorporatedTiles = [];
    this.#corporations = corporations;
    this.#players = players;
    this.#shuffle = shuffle;
    this.#state = GAME_STATES.setup;
    this.#stateInfo = {};
    this.#turnCount = 0;
    this.#turnManager = new TurnManager();
  }

  #createTilesStack() {
    this.#tiles = range(9).flatMap(x =>
      range(12).map(y => ({ position: { x, y }, isPlaced: false }))
    );
  }

  #pickTile() {
    return this.#tiles.shift();
  }

  #provideInitialTiles(player, quantity = 6) {
    this.#tiles.splice(0, quantity).forEach(tile => player.addTile(tile));
  }

  #provideInitialAsset() {
    const initialAmount = 6000;
    this.#players.forEach(player => {
      player.addIncome(initialAmount);
      this.#provideInitialTiles(player);
    });
  }

  #shuffleTiles() {
    this.#tiles = this.#shuffle(this.#tiles);
  }

  #addToIncorporatedTiles(tile) {
    tile.isPlaced = true;
    this.#incorporatedTiles.push(tile);
  }

  #findConnectedTiles({ x, y }, grid = []) {
    const tile = this.#placedTiles.find(
      ({ position }) => position.x === x && position.y === y
    );

    if (tile && !grid.includes(tile)) {
      grid.push(tile);
      this.#findConnectedTiles({ x: x + 1, y }, grid);
      this.#findConnectedTiles({ x: x - 1, y }, grid);
      this.#findConnectedTiles({ x, y: y + 1 }, grid);
      this.#findConnectedTiles({ x, y: y - 1 }, grid);
    }

    return grid;
  }

  #markUnplayableTiles() {
    this.#players.forEach(player => {
      const { tiles } = player.portfolio();

      tiles.forEach(tile => {
        if (!tile) return;
        this.#placedTiles.push(tile);

        const connectedTiles = this.#findConnectedTiles(tile.position);
        const groupedTiles = groupBy(connectedTiles, "belongsTo");
        const adjacentCorps = Object.keys(groupedTiles);
        const safeCorporations = adjacentCorps.filter(corp => {
          if (corp === "undefined" || corp === "incorporated") return false;
          return this.#corporations[corp].isSafe;
        });

        if (safeCorporations.length > 1) {
          // Todo: Change contract to boolean
          tile.exchange = "yes";
        }

        this.#placedTiles.pop();
      });
    });
  }

  #growCorporation = name => {
    const corporation = this.#corporations[name];

    const connectedIncorporatedTiles = this.#connectedTiles.filter(
      ({ belongsTo }) => belongsTo === "incorporated"
    );

    connectedIncorporatedTiles.forEach(tile => (tile.belongsTo = name));
    const isMerging = this.#state === GAME_STATES.merge;

    if (!isMerging) {
      corporation.increaseSize(connectedIncorporatedTiles.length);
    }
    //TODO: Refactor
    if (corporation.stats().size > 10) {
      corporation.markSafe();
      this.#markUnplayableTiles();
    }
  };

  #consolidateTile(position) {
    const tile = { position, isPlaced: true, belongsTo: "incorporated" };

    this.#turnManager.consolidateActivity(tile);
    this.#placedTiles.push(tile);
    this.#addToIncorporatedTiles(tile);
    this.#connectedTiles = this.#findConnectedTiles(position);

    const groupedTiles = groupBy(this.#connectedTiles, "belongsTo");

    const { handler } = this.#handlers.find(({ match }) => match(groupedTiles));
    handler(groupedTiles);
  }

  establishCorporation({ name }) {
    const player = this.#currentPlayer();
    const corporation = this.#corporations[name];

    corporation.establish();
    this.#growCorporation(name);

    player.addStocks(name, 1);
    corporation.decrementStocks(1);

    this.#state = GAME_STATES.buyStocks;
    this.#turnManager.consolidateActivity({ name });
    this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
  }

  // TODO: Remove username
  placeTile(username, position) {
    // if (!this.#turnManager.isIn(ACTIVITIES.tilePlace)) {
    //   throw new Error("Invalid Move!");
    // }

    const player = this.#players.find(player => player.username === username);
    this.#consolidateTile(position);
    player.placeTile(position);
  }

  #decidePlayingOrder() {
    this.#setupTiles = this.#players.map(player => [player, this.#pickTile()]);

    const firstTiles = this.#setupTiles.toSorted(([, a], [, b]) => {
      return a.position.x - b.position.x || a.position.y - b.position.y;
    });

    this.#players = firstTiles.map(([a]) => a);

    firstTiles.forEach(([, tile]) => {
      this.#placedTiles.push({
        ...tile,
        belongsTo: "incorporated",
        isPlaced: true,
      });

      this.#addToIncorporatedTiles(tile);
    });
  }

  currentPlayerName() {
    const currentPlayer = this.#currentPlayer();
    return currentPlayer.username;
  }

  #currentPlayer() {
    return this.#players[this.#turnCount % this.#players.length];
  }

  mergeTwoCorporation({ acquirer, defunct }, multipleMerge = false) {
    this.#merger = new Merger(
      this.#players.length,
      this.#corporations,
      this.#connectedTiles,
      multipleMerge
    );
    // change
    this.#merger.start(acquirer, defunct);
    this.distributeMajorityMinority(this.#merger.defunct);
    this.#state = GAME_STATES.merge;
    this.#turnManager.initiateActivity(ACTIVITIES.merge);
    this.#stateInfo = {
      acquirer: this.#merger.acquirer,
      defunct: this.#merger.defunct,
    };

    this.#consolidateMergeActivity();
  }

  #handleMultipleDefunct(potentialDefunct) {
    this.#state = GAME_STATES.defunctSelection;
    const defunctNames = potentialDefunct.map(corp => corp.name);

    this.#turnManager.initiateActivity(ACTIVITIES.defunctSelection);
    this.#turnManager.consolidateActivity(defunctNames);
  }

  selectAcquirer(acquirerName) {
    this.#stateInfo.acquirer = acquirerName;
    const mergingCorporations = this.#findMergingCorporations();

    const otherThanAcquirer = mergingCorporations.filter(
      corp => corp.name !== acquirerName
    );

    const defunctSize = otherThanAcquirer[0].size;
    const potentialDefunct = otherThanAcquirer.filter(
      corp => corp.size === defunctSize
    );

    if (potentialDefunct.length > 1) {
      return this.#handleMultipleDefunct(potentialDefunct);
    }

    const [defunct] = potentialDefunct;
    this.mergeTwoCorporation(
      { acquirer: acquirerName, defunct: defunct.name },
      true
    );
  }

  confirmDefunct(defunct) {
    const { acquirer } = this.#stateInfo;
    this.mergeTwoCorporation({ acquirer, defunct }, true);
  }

  #findMergingCorporations() {
    const corporatedTiles = this.#connectedTiles.filter(
      ({ belongsTo }) => belongsTo !== "incorporated"
    );

    const groupedTiles = groupBy(corporatedTiles, "belongsTo");
    const corps = Object.keys(groupedTiles).map(
      name => this.#corporations[name]
    );
    return sortBy(corps, corp => corp.size).reverse();
  }

  #mergeOfTwoEqualCorpHandler() {
    this.#state = GAME_STATES.mergeConflict;
    const equalCorporations = this.#findMergingCorporations().map(
      corp => corp.name
    );

    this.#turnManager.initiateActivity(ACTIVITIES.mergeConflict);
    this.#stateInfo = { isMergeConflict: true, equalCorporations };

    this.#turnManager.consolidateActivity(equalCorporations);
  }

  #findPotentialDefunct(mergingCorporations, predicate) {
    const otherThanAcquirers = mergingCorporations.filter(predicate);
    // corporation => corporation.size !== acquirerSize
    // );

    const defunctSize = otherThanAcquirers[0].size;

    return otherThanAcquirers.filter(
      corporation => corporation.size === defunctSize
    );
  }

  #handleMultipleMerging() {
    const mergingCorporations = this.#findMergingCorporations();
    const acquirerSize = mergingCorporations[0].size;

    const potentialAcquirers = mergingCorporations.filter(
      corporation => corporation.size === acquirerSize
    );

    if (potentialAcquirers.length > 1) {
      this.#state = GAME_STATES.acquirerSelection;
      const acquirerNames = potentialAcquirers.map(corp => corp.name);
      this.#turnManager.initiateActivity(ACTIVITIES.acquirerSelection);
      this.#turnManager.consolidateActivity(acquirerNames);

      return;
    }

    const [acquirer] = potentialAcquirers;
    this.#stateInfo.acquirer = acquirer.name;
    const isValidDefunct = corp => corp.size !== acquirerSize;
    const potentialDefunct = this.#findPotentialDefunct(
      mergingCorporations,
      isValidDefunct
    );

    if (potentialDefunct.length > 1) {
      this.#handleMultipleDefunct(potentialDefunct);
      // this.#handleMultipleDefunct(() =>this.#findPotentialDefunct(mergingCorporations, isValidDefunct)
      // );

      // this.#state = GAME_STATES.defunctSelection;
      // const defunctNames = potentialDefunct.map(corp => corp.name);

      // this.#turnManager.initiateActivity(ACTIVITIES.defunctSelection);
      // this.#turnManager.consolidateActivity(defunctNames);
      return;
    }

    const [defunct] = potentialDefunct;
    this.mergeTwoCorporation(
      {
        acquirer: acquirer.name,
        defunct: defunct.name,
      },
      true
    );
  }

  // TODO: Refactor it
  #setupHandlers() {
    const noActiveCorporation = () =>
      Object.values(this.#corporations).find(corp => !corp.isActive);

    const foundCorporation = groupedTiles =>
      Object.keys(groupedTiles).length === 1 &&
      groupedTiles.incorporated.length > 1 &&
      noActiveCorporation();

    const growCorporation = groupedTiles =>
      Object.keys(groupedTiles).length === 2 &&
      groupedTiles.incorporated.length >= 1;

    const isMergingOfTwo = groupedTiles =>
      Object.keys(groupedTiles).length === 3;

    const isEqualSizeCorp = (corp1, corp2) => corp1.size === corp2.size;

    const isMergeOfTwoEqualCorp = groupedTiles => {
      const [corp1, corp2] = this.#findMergingCorporations();
      return isMergingOfTwo(groupedTiles) && isEqualSizeCorp(corp1, corp2);
    };

    const isMultipleMerge = groupedTiles =>
      Object.keys(groupedTiles).length > 3;

    this.#handlers = [
      {
        match: foundCorporation,
        handler: () => {
          this.#state = GAME_STATES.establishCorporation;
          this.#turnManager.initiateActivity(ACTIVITIES.establish);
        },
      },
      {
        match: growCorporation,
        handler: groupedTiles => {
          const name = Object.keys(groupedTiles).find(
            belongsTo => belongsTo !== "incorporated"
          );

          this.#growCorporation(name);
          this.#state = GAME_STATES.buyStocks;
          this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
        },
      },
      {
        match: isMultipleMerge,
        handler: () => {
          this.#handleMultipleMerging();
        },
      },
      {
        match: isMergeOfTwoEqualCorp,
        handler: () => {
          this.#mergeOfTwoEqualCorpHandler();
        },
      },
      {
        match: isMergingOfTwo,
        handler: () => {
          const [corp1, corp2] = this.#findMergingCorporations();
          const [acquirer, defunct] = [corp1.name, corp2.name];
          this.mergeTwoCorporation({ acquirer, defunct });
        },
      },
      {
        match: () => true,
        handler: () => {
          this.#state = GAME_STATES.buyStocks;
          this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
        },
      },
    ];
  }

  endMerge() {
    this.#state = GAME_STATES.buyStocks;
    this.#turnManager.initiateActivity(ACTIVITIES.buyStocks);
  }

  #consolidateMergeActivity() {
    this.#turnManager.consolidateActivity({
      acquirer: this.#merger.acquirer,
      defunct: this.#merger.defunct,
      turns: this.#merger.getTurns(),
      ...this.distributeMajorityMinority.stats,
    });
  }

  setup() {
    this.#createTilesStack();
    this.#shuffleTiles();
    this.#provideInitialAsset();
    this.#decidePlayingOrder();
    this.#setupHandlers();
  }

  start() {
    this.setup();
    this.#state = GAME_STATES.placeTile;
    this.#currentPlayer().startTurn();
    this.#turnManager.initiateActivity(ACTIVITIES.tilePlace);
  }

  playerDetails(username) {
    // TODO: make it private
    const player = this.#players.find(player => player.username === username);
    return player.portfolio();
  }

  #getPlayers(username) {
    return this.#players.map(player => ({
      username: player.username,
      isTakingTurn: player.isTakingTurn,
      you: player.username === username,
    }));
  }

  #refillTile() {
    const currentPlayer = this.#currentPlayer();
    const newTile = this.#pickTile();
    currentPlayer.refillTile(newTile);

    const { tiles } = currentPlayer.portfolio();
    const exchangedTiles = tiles.map(tile => {
      if (tile && tile.exchange === "yes") return this.#pickTile();
      return tile;
    });

    currentPlayer.exchangeTiles(exchangedTiles);
  }

  #isGameOver() {
    const activeCorporations = Object.entries(this.#corporations).filter(
      ([, { isActive }]) => isActive
    );

    if (activeCorporations.length === 0) return false;

    const hasAcquired41Tiles = activeCorporations.some(
      ([, corp]) => corp.size >= 41
    );

    const isEveryCorpStable = activeCorporations.every(
      ([, corp]) => corp.isSafe
    );

    return hasAcquired41Tiles || isEveryCorpStable;
  }

  #calculateEarnings() {
    const activeCorporations = Object.entries(this.#corporations).filter(
      ([, { isActive }]) => isActive
    );

    activeCorporations.forEach(([name, corporation]) => {
      this.distributeMajorityMinority(name);
      this.#result.bonuses.push(this.distributeMajorityMinority.stats);

      this.#players.forEach(player => {
        const { stocks } = player.portfolio();
        const noOfStocks = stocks[name];
        const { price: currentPrice } = corporation.stats();

        player.sellStocks(name, noOfStocks);
        player.addIncome(noOfStocks * currentPrice);
        corporation.incrementStocks(noOfStocks);
      });
    });

    const players = this.#players.map(player => {
      const { stocks, balance } = player.portfolio();

      return {
        stocks,
        balance,
        name: player.username,
      };
    });

    this.#result.players = players;
  }

  changeTurn() {
    if (this.#isGameOver()) {
      this.#state = GAME_STATES.gameEnd;
      this.#result = { players: [], bonuses: [] };
      this.#calculateEarnings();
      return;
    }

    this.#refillTile();
    this.#currentPlayer().endTurn();
    this.#turnCount++;
    this.#currentPlayer().startTurn();

    this.#state = GAME_STATES.placeTile;
    this.#turnManager.changeTurn();
    this.#turnManager.initiateActivity(ACTIVITIES.tilePlace);
  }

  endMergerTurn() {
    this.#merger.endTurn();
    this.#currentPlayer().endTurn();
    this.#turnCount++;
    this.#currentPlayer().startTurn();

    this.#consolidateMergeActivity();

    // reconsolidate
    if (this.#merger.hasEnd()) {
      this.#merger.end();
      this.#markUnplayableTiles();
      const groupedTiles = groupBy(this.#connectedTiles, "belongsTo");

      const { handler } = this.#handlers.find(({ match }) =>
        match(groupedTiles)
      );
      handler(groupedTiles);
    }
  }

  dealDefunctStocks({ sell, trade }) {
    this.#merger.deal(this.#currentPlayer(), sell, trade);
    this.endMergerTurn();
  }

  buyStocks(stocks) {
    const player = this.#currentPlayer();

    stocks.forEach(({ name }) => {
      const corp = this.#corporations[name];
      const { isActive, stocks, price } = corp.stats();
      if (isActive && stocks >= 1 && player.balance >= price) {
        corp.decrementStocks(1);
        player.addExpense(price);
        player.addStocks(name, 1);
      }
    });

    this.#state = GAME_STATES.tilePlaced;
    this.#turnManager.consolidateActivity(stocks.map(({ name }) => name));
  }

  #getCorporationStats() {
    return Object.fromEntries(
      Object.entries(this.#corporations).map(([name, corporation]) => [
        name,
        corporation.stats(),
      ])
    );
  }

  findMajorityMinority(corpName) {
    const getStocks = player => player.portfolio().stocks[corpName];
    const stockHolders = this.#players.filter(getStocks);
    const [majority, minority] = Object.entries(
      groupBy(stockHolders, getStocks)
    )
      .map(([stock, players]) => ({
        stock: parseInt(stock),
        players: players,
        playerNames: players.map(p => p.username),
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 2);

    return {
      majority: majority || { stock: 0, players: [], playerNames: [] },
      minority: minority || { stock: 0, players: [], playerNames: [] },
    };
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

  distributeMajorityMinority(corpName) {
    // TODO refactor
    const corp = this.#corporations[corpName];
    const { majorityPrice, minorityPrice } = corp.stats();
    const { majority, minority } = this.findMajorityMinority(corpName);

    if (majority.players.length > 1 || minority.players.length === 0) {
      const sharePrice =
        (majorityPrice + minorityPrice) / majority.players.length;
      majority.players.forEach(player => {
        player.addIncome(sharePrice);
      });

      // Refactor
      this.distributeMajorityMinority.stats = {
        corporation: corpName,
        majority: {
          bonus: majorityPrice,
          players: majority.playerNames,
          stocks: majority.stock,
        },
        minority: {
          bonus: minorityPrice,
          players: majority.playerNames,
          stocks: minority.stock,
        },
      };
      return;
    }

    majority.players[0].addIncome(majorityPrice);
    const sharePrice = minorityPrice / minority.players.length;
    minority.players.forEach(player => {
      player.addIncome(sharePrice);
    });

    this.distributeMajorityMinority.stats = {
      corporation: corpName,
      majority: {
        bonus: majorityPrice,
        players: majority.playerNames,
        stocks: majority.stock,
      },
      minority: {
        bonus: minorityPrice,
        players: minority.playerNames,
        stocks: minority.stock,
      },
    };
  }

  status(username) {
    return {
      state: this.#state,
      stateInfo: this.#stateInfo,
      setupTiles: this.#setupTiles.map(([player, tile]) => [
        player.username,
        tile,
      ]),
      turns: this.#getTurns(username),
      players: this.#getPlayers(username),
      portfolio: this.playerDetails(username),
      corporations: this.#getCorporationStats(),
      placedTiles: this.#placedTiles,
    };
  }

  get result() {
    return this.#result;
  }

  static fromJSON({ tiles, players, corporations, setupTiles, placedTiles }) {
    const game = new Game();

    game.#state = GAME_STATES.placeTile;
    game.#tiles = tiles;
    game.#corporations = corporations;
    game.#players = players;
    game.#placedTiles = placedTiles;
    game.#setupTiles = setupTiles;
    game.#turnCount = 0;

    players[0].startTurn();
    game.#setupHandlers();
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
  GAME_STATES,
};
