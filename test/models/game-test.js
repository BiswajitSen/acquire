const assert = require("assert");
const { it, describe } = require("node:test");
const { reverse } = require("lodash");
const { Player } = require("../../src/models/player");
const { Game, loadGame, GAME_STATES } = require("../../src/models/game");
const { createCorporations } = require("../../src/models/corporation");
const multipleMerge = require("../test-data/merging-three.json");
const multipleMergeTwoAcquirer = require("../test-data/merging-three-two-equal-acquirer.json");
const multipleMergeTwoDefunct = require("../test-data/merging-three-two-equal-defunct.json");
const multipleMergeThreeAllEqual = require("../test-data/merging-three-all-equal.json");
const unplayableTile = require("../test-data/unplayable-tile.json");

describe("Game", () => {
  // TODO: extract constants
  describe("start", () => {
    it("should distribute initial assets to players", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      assert.deepStrictEqual(player1.portfolio(), {
        tiles: [
          { position: { x: 0, y: 0 }, isPlaced: false },
          { position: { x: 0, y: 1 }, isPlaced: false },
          { position: { x: 0, y: 2 }, isPlaced: false },
          { position: { x: 0, y: 3 }, isPlaced: false },
          { position: { x: 0, y: 4 }, isPlaced: false },
          { position: { x: 0, y: 5 }, isPlaced: false },
        ],
        stocks: {},
        balance: 6000,
        newTile: undefined,
      });

      assert.deepStrictEqual(player2.portfolio(), {
        tiles: [
          { position: { x: 0, y: 6 }, isPlaced: false },
          { position: { x: 0, y: 7 }, isPlaced: false },
          { position: { x: 0, y: 8 }, isPlaced: false },
          { position: { x: 0, y: 9 }, isPlaced: false },
          { position: { x: 0, y: 10 }, isPlaced: false },
          { position: { x: 0, y: 11 }, isPlaced: false },
        ],
        stocks: {},
        balance: 6000,
        newTile: undefined,
      });
    });

    it("should decide playing order of the players", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();

      const game = new Game([player1, player2], reverse, corporations);
      game.start();

      const { players } = game.status(player1.username);

      assert.deepStrictEqual(players, [
        { username: player2.username, isTakingTurn: true, you: false },
        { username: player1.username, isTakingTurn: false, you: true },
      ]);
    });
  });

  describe("playerDetails", () => {
    it("should response with player portfolio", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      assert.deepStrictEqual(game.playerDetails("Biswa"), {
        tiles: [
          { position: { x: 0, y: 0 }, isPlaced: false },
          { position: { x: 0, y: 1 }, isPlaced: false },
          { position: { x: 0, y: 2 }, isPlaced: false },
          { position: { x: 0, y: 3 }, isPlaced: false },
          { position: { x: 0, y: 4 }, isPlaced: false },
          { position: { x: 0, y: 5 }, isPlaced: false },
        ],
        stocks: {},
        balance: 6000,
        newTile: undefined,
      });
    });
  });

  describe("status", () => {
    it("should response with current game status", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      const { players, portfolio } = game.status(player1.username);

      assert.deepStrictEqual(players, [
        { username: player1.username, isTakingTurn: true, you: true },
        { username: player2.username, isTakingTurn: false, you: false },
      ]);

      assert.deepStrictEqual(portfolio, player1.portfolio());
      assert.notDeepStrictEqual(portfolio, player2.portfolio());
    });

    it("should find corporation when tile is placed next to incorporated tile", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 4 });
      game.placeTile("Biswa", { x: 0, y: 3 });

      const { state } = game.status(player1.username);

      assert.strictEqual(state, "establish-corporation");
    });

    it("should not be in find corporation state when no adjacent tiles are there", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 3 });

      const { state } = game.status(player1.username);

      assert.strictEqual(state, "buy-stocks");
    });

    it("should not establish if all corporation has been established", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      Object.values(corporations).forEach(corp => corp.establish());

      const game = new Game([player1, player2], shuffle, corporations);

      game.start();

      game.placeTile("Biswa", { x: 0, y: 4 });
      game.placeTile("Biswa", { x: 0, y: 3 });

      const { state } = game.status(player1.username);
      assert.strictEqual(state, "buy-stocks");
    });

    it("should grow a corporation if tile placed next to that corporation", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, createCorporations());
      game.start();

      game.placeTile("Biswa", { x: 0, y: 0 });
      game.establishCorporation({ name: "phoenix" });
      game.placeTile("Biswa", { x: 0, y: 1 });

      const { corporations } = game.status(player1.username);

      assert.strictEqual(corporations.phoenix.price, 600);
      assert.strictEqual(corporations.phoenix.size, 4);
    });

    it("should mark a corporation safe if it has 11 or more size", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const shuffle = x => x;
      const corporations = createCorporations();
      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 0 });
      corporations.phoenix.increaseSize(10);
      game.establishCorporation({ name: "phoenix" });

      assert.ok(corporations.phoenix.stats().isSafe);
    });

    it("should merge with the defunct if tile placed adjacent to two corps", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const shuffle = x => x;
      const corporations = createCorporations();
      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 0 });
      game.placeTile("Biswa", { x: 0, y: 1 });
      game.placeTile("Biswa", { x: 0, y: 2 });
      game.placeTile("Biswa", { x: 0, y: 3 });
      game.establishCorporation({ name: "phoenix" });

      game.changeTurn();

      game.placeTile("Biswa", { x: 0, y: 5 });
      game.placeTile("Bittu", { x: 0, y: 6 });
      game.establishCorporation({ name: "quantum" });

      game.placeTile("Biswa", { x: 0, y: 4 });
      game.endMergerTurn();
      game.endMergerTurn();

      const { placedTiles } = game.status("Biswa");

      placedTiles.forEach(tile => {
        assert.strictEqual(tile.belongsTo, "phoenix");
      });
    });

    it("acquirer should be safe after merging if grows 11 tiles or more", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const shuffle = x => x;
      const corporations = createCorporations();
      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 0 });
      game.placeTile("Biswa", { x: 0, y: 1 });
      game.placeTile("Biswa", { x: 0, y: 2 });
      game.placeTile("Biswa", { x: 0, y: 3 });
      game.establishCorporation({ name: "phoenix" });

      game.changeTurn();

      game.placeTile("Biswa", { x: 0, y: 5 });
      game.placeTile("Bittu", { x: 0, y: 6 });
      game.placeTile("Bittu", { x: 0, y: 7 });
      game.placeTile("Bittu", { x: 0, y: 8 });
      game.placeTile("Bittu", { x: 0, y: 9 });
      // game.placeTile("Bittu", { x: 0, y: 10 });
      game.establishCorporation({ name: "quantum" });

      game.placeTile("Biswa", { x: 0, y: 4 });

      game.endMergerTurn();
      game.endMergerTurn();

      assert.ok(corporations.phoenix.isSafe);
    });

    describe("multiple merge", () => {
      it("should lead the game state to acquirer selection", () => {
        const game = loadGame(multipleMergeTwoAcquirer);
        game.placeTile("Bittu", { x: 4, y: 6 });
        const { state } = game.status("Bittu");

        assert.strictEqual(state, GAME_STATES.acquirerSelection);
      });

      it("should lead the game state to defunct selection, when there are potential defunct corporations following acquirer selection", () => {
        const game = loadGame(multipleMergeThreeAllEqual);
        game.placeTile("Bittu", { x: 4, y: 6 });
        const { state: acquirerSelection } = game.status("Bittu");

        assert.strictEqual(acquirerSelection, GAME_STATES.acquirerSelection);

        game.selectAcquirer("phoenix");
        const { state: defunctSelection } = game.status("Bittu");
        assert.strictEqual(defunctSelection, GAME_STATES.defunctSelection);
      });

      it("should merge all equal corporations", () => {
        const game = loadGame(multipleMergeThreeAllEqual);
        game.placeTile("Bittu", { x: 4, y: 6 });
        const { state: acquirerSelection } = game.status("Bittu");

        assert.strictEqual(acquirerSelection, GAME_STATES.acquirerSelection);

        game.selectAcquirer("phoenix");
        const { state: defunctSelection } = game.status("Bittu");
        assert.strictEqual(defunctSelection, GAME_STATES.defunctSelection);

        game.confirmDefunct("quantum");

        const { state: mergeState } = game.status("Bittu");
        assert.strictEqual(mergeState, GAME_STATES.merge);
        new Array(6).fill().forEach(() => game.endMergerTurn());

        const { state: buyStocks, corporations } = game.status("Bittu");
        assert.strictEqual(buyStocks, GAME_STATES.buyStocks);

        assert.strictEqual(corporations["phoenix"].size, 13);
      });

      it("should lead game state to defunct selection, when there are more multiple deducts", () => {
        const game = loadGame(multipleMergeTwoDefunct);
        game.placeTile("Bittu", { x: 4, y: 6 });
        const { state } = game.status("Bittu");

        assert.strictEqual(state, GAME_STATES.defunctSelection);
      });
    });
  });

  it("should be merge-conflict when two equal size corp are merging", () => {
    const player1 = new Player("Biswa");
    const player2 = new Player("Bittu");
    const shuffle = x => x;
    const corporations = createCorporations();
    const game = new Game([player1, player2], shuffle, corporations);
    game.start();

    game.placeTile("Biswa", { x: 0, y: 0 });
    game.placeTile("Biswa", { x: 0, y: 1 });
    game.placeTile("Biswa", { x: 0, y: 2 });
    game.placeTile("Biswa", { x: 0, y: 3 });
    game.establishCorporation({ name: "phoenix" });

    game.changeTurn();

    game.placeTile("Biswa", { x: 0, y: 5 });
    game.placeTile("Bittu", { x: 0, y: 6 });
    game.placeTile("Bittu", { x: 0, y: 7 });
    game.placeTile("Bittu", { x: 0, y: 8 });
    game.placeTile("Bittu", { x: 0, y: 9 });
    game.placeTile("Bittu", { x: 0, y: 10 });
    game.establishCorporation({ name: "quantum" });

    game.placeTile("Biswa", { x: 0, y: 4 });
    const gameStatus = game.status("Biswa");

    assert.strictEqual(gameStatus.state, "merge-conflict");
  });

  it("should be resolve merge-conflict", () => {
    const player1 = new Player("Biswa");
    const player2 = new Player("Bittu");
    const shuffle = x => x;
    const corporations = createCorporations();
    const game = new Game([player1, player2], shuffle, corporations);
    game.start();

    game.placeTile("Biswa", { x: 0, y: 0 });
    game.placeTile("Biswa", { x: 0, y: 1 });
    game.placeTile("Biswa", { x: 0, y: 2 });
    game.placeTile("Biswa", { x: 0, y: 3 });
    game.establishCorporation({ name: "phoenix" });

    game.changeTurn();

    game.placeTile("Biswa", { x: 0, y: 5 });
    game.placeTile("Bittu", { x: 0, y: 6 });
    game.placeTile("Bittu", { x: 0, y: 7 });
    game.placeTile("Bittu", { x: 0, y: 8 });
    game.placeTile("Bittu", { x: 0, y: 9 });
    game.placeTile("Bittu", { x: 0, y: 10 });
    game.establishCorporation({ name: "quantum" });

    game.placeTile("Biswa", { x: 0, y: 4 });
    const gameStatus = game.status("Biswa");

    assert.strictEqual(gameStatus.state, "merge-conflict");
    game.mergeTwoCorporation({ acquirer: "quantum", defunct: "phoenix" });
    const { acquirer, defunct } = game
      .status("Biswa")
      .turns.currentTurn.activities.at(-1).data;

    assert.deepStrictEqual(
      { acquirer, defunct },
      { acquirer: "quantum", defunct: "phoenix" }
    );
  });

  describe("placeTile", () => {
    it("should remove a tile from the tile stack", () => {
      const player1 = new Player("Biswa");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1], shuffle, corporations);
      game.start();

      const expectedPlayerPortfolio = {
        tiles: [
          { position: { x: 0, y: 0 }, isPlaced: true },
          { position: { x: 0, y: 1 }, isPlaced: false },
          { position: { x: 0, y: 2 }, isPlaced: false },
          { position: { x: 0, y: 3 }, isPlaced: false },
          { position: { x: 0, y: 4 }, isPlaced: false },
          { position: { x: 0, y: 5 }, isPlaced: false },
        ],
        stocks: {},
        balance: 6000,
        newTile: undefined,
      };

      game.placeTile("Biswa", { x: 0, y: 0 });

      assert.deepStrictEqual(player1.portfolio(), expectedPlayerPortfolio);
    });
  });

  describe("changeTurn", () => {
    it("should change the current player", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Honu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      assert.strictEqual(player1.isTakingTurn, true);
      assert.strictEqual(player2.isTakingTurn, false);

      game.changeTurn();

      assert.strictEqual(player1.isTakingTurn, false);
      assert.strictEqual(player2.isTakingTurn, true);
    });

    it("should not change the turn after the game is ended", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Honu");

      const corporations = createCorporations();
      corporations.hydra.establish();
      corporations.hydra.markSafe();

      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      assert.strictEqual(player1.isTakingTurn, true);
      assert.strictEqual(player2.isTakingTurn, false);

      game.changeTurn();

      assert.strictEqual(player1.isTakingTurn, true);
      assert.strictEqual(player2.isTakingTurn, false);
    });
  });

  describe("buyStocks", () => {
    it("should add stocks to current player's portfolio", () => {
      const player1 = new Player("Biswa", 0, { phoenix: 0 });
      const player2 = new Player("Honu", 0, { phoenix: 0 });
      const corporations = createCorporations();
      const shuffle = x => x;
      const game = new Game([player1, player2], shuffle, corporations);
      const transactionDetails = [
        {
          name: "phoenix",
          price: 1000,
        },
      ];

      game.start();
      game.placeTile("Biswa", { x: 0, y: 0 });
      corporations["phoenix"].establish();
      game.buyStocks(transactionDetails);

      const { balance, stocks } = player1.portfolio();

      assert.strictEqual(balance, 6000);
      assert.strictEqual(stocks.phoenix, 1);
      assert.strictEqual(corporations["phoenix"].stocks, 24);
    });

    it("should not add stocks to current player's portfolio when player does not have enough balance", () => {
      const player1 = new Player("Biswa", -6000, { phoenix: 0 });
      const player2 = new Player("Honu", 0, { phoenix: 0 });
      const corporations = createCorporations();
      const shuffle = x => x;
      const game = new Game([player1, player2], shuffle, corporations);
      const transactionDetails = [{ name: "phoenix" }];

      game.start();
      game.placeTile("Biswa", { x: 0, y: 0 });
      game.establishCorporation({ name: "phoenix" });
      game.buyStocks(transactionDetails);

      const { balance, stocks } = player1.portfolio();

      assert.strictEqual(balance, 0);
      assert.strictEqual(stocks.phoenix, 1);
      assert.strictEqual(corporations["phoenix"].stocks, 24);
    });
  });

  describe("establishCorporation", () => {
    it("should establish a corporation", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const corporations = createCorporations();
      const shuffle = x => x;

      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 4 });
      game.placeTile("Biswa", { x: 0, y: 3 });

      assert.ok(!corporations.phoenix.isActive);
      game.establishCorporation({ name: "phoenix" });
      assert.ok(corporations.phoenix.isActive);
    });
  });

  describe("findMajorityMinority", () => {
    it("should find list of majority and minority stock holders in order of their stocks count", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 9 });
      const p3 = new Player("Qasim", 0, { hydra: 10 });
      const p4 = new Player("Utsab", 0, { hydra: 10 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3, p4], shuffle, corporations);

      game.start();

      const { majority, minority } = game.findMajorityMinority("hydra");

      assert.strictEqual(majority.stock, 11);
      assert.strictEqual(minority.stock, 10);
      assert.deepStrictEqual(majority.playerNames, ["Bittu"]);
      assert.deepStrictEqual(minority.playerNames, ["Qasim", "Utsab"]);
    });

    it("should find the unique majority and minority stock holders when everyone have unequal num of stocks", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 9 });
      const p3 = new Player("Qasim", 0, { hydra: 4 });
      const p4 = new Player("Utsab", 0, { hydra: 8 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3, p4], shuffle, corporations);

      game.start();

      const { majority, minority } = game.findMajorityMinority("hydra");

      assert.strictEqual(majority.stock, 11);
      assert.strictEqual(minority.stock, 9);
      assert.deepStrictEqual(majority.playerNames, ["Bittu"]);
      assert.deepStrictEqual(minority.playerNames, ["Biswa"]);
    });

    it("should find zero minority when everyone has equal num of stocks", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 11 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const p3 = new Player("Qasim", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3], shuffle, corporations);

      game.start();

      const { majority, minority } = game.findMajorityMinority("hydra");

      assert.strictEqual(majority.stock, 11);
      assert.strictEqual(minority.stock, 0);
      assert.deepStrictEqual(majority.playerNames, ["Biswa", "Bittu", "Qasim"]);
      assert.deepStrictEqual(minority.playerNames, []);
    });
  });

  describe("endMerge", () => {
    it("should end the merge state", () => {
      const player1 = new Player("Biswa");
      const player2 = new Player("Bittu");
      const shuffle = x => x;
      const corporations = createCorporations();
      const game = new Game([player1, player2], shuffle, corporations);
      game.start();

      game.placeTile("Biswa", { x: 0, y: 0 });
      game.placeTile("Biswa", { x: 0, y: 1 });
      game.placeTile("Biswa", { x: 0, y: 2 });
      game.placeTile("Biswa", { x: 0, y: 3 });
      game.establishCorporation({ name: "phoenix" });

      game.changeTurn();

      game.placeTile("Biswa", { x: 0, y: 5 });
      game.placeTile("Bittu", { x: 0, y: 6 });
      game.establishCorporation({ name: "quantum" });

      game.placeTile("Biswa", { x: 0, y: 4 });

      assert.strictEqual(game.status("Biswa").state, "merge");
      game.endMerge();
      assert.strictEqual(game.status("Biswa").state, "buy-stocks");
    });
  });

  describe("distributeMajorityMinority", () => {
    it("both bonuses to the majority stocks holders when there are more than one majority", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 9 });
      const p3 = new Player("Qasim", 0, { hydra: 10 });
      const p4 = new Player("Utsab", 0, { hydra: 11 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3, p4], shuffle, corporations);

      corporations.hydra.establish();
      corporations.hydra.increaseSize(10);
      game.start();
      game.distributeMajorityMinority("hydra");

      assert.strictEqual(p2.portfolio().balance, 11250);
      assert.strictEqual(p4.portfolio().balance, 11250);
    });

    it("both bonuses to the majority stocks holders when there no minority", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 0 });
      const p3 = new Player("Qasim", 0, { hydra: 0 });
      const p4 = new Player("Utsab", 0, { hydra: 0 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3, p4], shuffle, corporations);

      corporations.hydra.establish();
      corporations.hydra.increaseSize(10);
      game.start();
      game.distributeMajorityMinority("hydra");

      assert.strictEqual(p2.portfolio().balance, 16500);
      assert.strictEqual(p4.portfolio().balance, 6000);
    });

    it("two distinct players when there are only one majority and minority", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 9 });
      const p3 = new Player("Qasim", 0, { hydra: 10 });
      const p4 = new Player("Utsab", 0, { hydra: 8 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3, p4], shuffle, corporations);

      corporations.hydra.establish();
      corporations.hydra.increaseSize(10);
      game.start();
      game.distributeMajorityMinority("hydra");

      assert.strictEqual(p2.portfolio().balance, 13000);
      assert.strictEqual(p3.portfolio().balance, 9500);
    });

    it("share minority bonus to all minority stocks holders", () => {
      const shuffle = x => x;
      const p1 = new Player("Biswa", 0, { hydra: 9 });
      const p3 = new Player("Qasim", 0, { hydra: 10 });
      const p4 = new Player("Utsab", 0, { hydra: 10 });
      const p2 = new Player("Bittu", 0, { hydra: 11 });
      const corporations = createCorporations();
      const game = new Game([p1, p2, p3, p4], shuffle, corporations);

      corporations.hydra.establish();
      corporations.hydra.increaseSize(10);
      game.start();
      game.distributeMajorityMinority("hydra");

      assert.strictEqual(p2.portfolio().balance, 13000);
      assert.strictEqual(p3.portfolio().balance, 7750);
      assert.strictEqual(p4.portfolio().balance, 7750);
      assert.strictEqual(p1.portfolio().balance, 6000);
    });

    it("should start multiple merge", () => {
      const game = loadGame(multipleMerge);
      game.placeTile("Bittu", { x: 4, y: 6 });

      assert.deepStrictEqual(game.status("Bittu").state, "merge");
      [1, 2, 3, 4, 5, 6].forEach(() => game.endMergerTurn());
      assert.deepStrictEqual(game.status("Bittu").state, "buy-stocks");
    });

    it("should select acquirer when there is a tie among acquire", () => {
      const game = loadGame(multipleMergeTwoAcquirer);
      game.placeTile("Bittu", { x: 4, y: 6 });

      assert.strictEqual(game.status("Bittu").state, "acquirer-selection");
      game.selectAcquirer("phoenix");
      assert.strictEqual(game.status("Bittu").state, "merge");
    });

    it("should merge acquirer and defunct after acquirer is selected", () => {
      const game = loadGame(multipleMergeTwoAcquirer);
      game.placeTile("Bittu", { x: 4, y: 6 });

      assert.strictEqual(game.status("Bittu").state, "acquirer-selection");
      game.selectAcquirer("phoenix");
      assert.strictEqual(game.status("Bittu").state, "merge");
      [1, 2, 3].forEach(() => game.endMergerTurn());
      const { phoenix } = game.status("Bittu").corporations;
      assert.strictEqual(game.status("Bittu").state, "merge");
      assert.strictEqual(phoenix.size, 8);
    });

    it("should merge multiple corporations", () => {
      const game = loadGame(multipleMergeTwoAcquirer);
      game.placeTile("Bittu", { x: 4, y: 6 });

      assert.strictEqual(game.status("Bittu").state, "acquirer-selection");
      game.selectAcquirer("phoenix");
      assert.strictEqual(game.status("Bittu").state, "merge");
      game.confirmDefunct("quantum");

      [1, 2, 3, 4, 5, 6].forEach(() => game.endMergerTurn());
      assert.strictEqual(game.status("Bittu").state, "buy-stocks");

      const { phoenix } = game.status("Bittu").corporations;
      assert.strictEqual(phoenix.size, 12);
    });
  });

  describe("exchangeUnplayableTiles", () => {
    it("should mark a tile as unplayable when it connects two safe corporations", () => {
      const game = loadGame(JSON.parse(JSON.stringify(unplayableTile)));

      game.placeTile("Debu", { x: 7, y: 9 });

      const { corporations, portfolio } = game.status("Debu");
      assert.ok(corporations.zeta.isSafe);
      assert.deepStrictEqual(portfolio.tiles[2], {
        "position": {
          "x": 6,
          "y": 6,
        },
        "isPlaced": false,
        "exchange": "yes",
      });
    });

    it("should exchange unplayable tiles", () => {
      const game = loadGame(JSON.parse(JSON.stringify(unplayableTile)));

      game.placeTile("Debu", { x: 7, y: 9 });
      game.changeTurn();

      const { corporations, portfolio } = game.status("Debu");
      assert.ok(corporations.zeta.isSafe);
      assert.deepStrictEqual(portfolio.tiles[2], {
        isPlaced: false,
        position: {
          x: 6,
          y: 11,
        },
      });
    });
  });
});
