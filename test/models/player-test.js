const assert = require("assert");
const { it, describe } = require("node:test");
const { Player, createPlayers } = require("../../src/models/player");

describe("Player", () => {
  describe("portfolio", () => {
    it("should have an initial amount of 0", () => {
      const player = new Player("Bittu");
      const { balance } = player.portfolio();

      assert.strictEqual(balance, 0);
    });

    it("shouldn't have any tiles initially", () => {
      const player = new Player("Bittu");
      const { tiles } = player.portfolio();

      assert.strictEqual(tiles.length, 0);
    });

    it("shouldn't have any stocks initially", () => {
      const player = new Player("Bittu");
      const { stocks } = player.portfolio();

      assert.deepStrictEqual({}, stocks);
    });

    it("should have zero stocks of each corporation initially", () => {
      const player = new Player("Biswa", 0, { phoenix: 0, hydra: 0 });
      const { stocks } = player.portfolio();
      assert.deepStrictEqual({ phoenix: 0, hydra: 0 }, stocks);
    });

    it("should include an overall player statistic", () => {
      const player = new Player("Bittu");

      assert.deepStrictEqual(player.portfolio(), {
        balance: 0,
        tiles: [],
        stocks: {},
        newTile: undefined,
      });
    });
  });

  describe("addIncome", () => {
    it("should add the specified amount to the player's player balance", () => {
      const player = new Player("Bittu");
      player.addIncome(6000);
      const { balance } = player.portfolio();

      assert.strictEqual(balance, 6000);
    });
  });

  describe("addExpense", () => {
    it("should deduct the specified amount from the player's player balance", () => {
      const player = new Player("Bittu");
      player.addIncome(10000);
      player.addExpense(6000);
      const { balance } = player.portfolio();

      assert.strictEqual(balance, 4000);
    });
  });

  describe("addTile", () => {
    it("should add specified tile in the tile collection", () => {
      const player = new Player("Bittu");
      player.addTile("2A");
      const { tiles } = player.portfolio();

      assert.deepStrictEqual(tiles, ["2A"]);
    });
  });

  describe("placeTile", () => {
    it("should remove a specified tile from the tile collection", () => {
      const player = new Player("Bittu");
      player.addTile({ position: { x: 0, y: 0 }, isPlaced: false });
      player.addTile({ position: { x: 1, y: 1 }, isPlaced: false });
      player.placeTile({ x: 0, y: 0 });
      const { tiles } = player.portfolio();

      const playerTiles = [
        {
          isPlaced: true,
          position: { x: 0, y: 0 },
        },
        {
          isPlaced: false,
          position: { x: 1, y: 1 },
        },
      ];

      assert.deepStrictEqual(tiles, playerTiles);
    });
  });

  describe("refillTile", () => {
    it("should refill the blank tiles space", () => {
      const player = new Player("Bittu");
      player.addTile({ position: { x: 0, y: 0 }, isPlaced: false });
      player.addTile({ position: { x: 1, y: 1 }, isPlaced: false });
      player.placeTile({ x: 0, y: 0 });
      player.refillTile({ position: { x: 2, y: 2 }, isPlaced: false });
      const { tiles } = player.portfolio();

      const playerTiles = [
        {
          isPlaced: false,
          position: { x: 2, y: 2 },
        },
        {
          isPlaced: false,
          position: { x: 1, y: 1 },
        },
      ];

      assert.deepStrictEqual(tiles, playerTiles);
    });
  });

  describe("startTurn", () => {
    it("should start player's turn", () => {
      const player = new Player("Bittu");
      assert.strictEqual(player.isTakingTurn, false);
      player.startTurn();

      assert.ok(player.isTakingTurn);
    });
  });

  describe("endTurn", () => {
    it("should end player's turn", () => {
      const player = new Player("Bittu");

      assert.ok(!player.isTakingTurn);
      player.startTurn();

      assert.ok(player.isTakingTurn);
      player.endTurn();

      assert.ok(!player.isTakingTurn);
    });
  });

  describe("addStocks", () => {
    it("should add stocks to the desired corporation", () => {
      const [player] = createPlayers([{ username: "Bittu" }]);
      player.addStocks("phoenix", 3);
      const { stocks } = player.portfolio();

      assert.deepStrictEqual(stocks, {
        "phoenix": 3,
        "quantum": 0,
        "hydra": 0,
        "fusion": 0,
        "america": 0,
        "sackson": 0,
        "zeta": 0,
      });
    });
  });
});
