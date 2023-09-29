const assert = require("assert");
const { describe, it } = require("node:test");
const Merger = require("../../src/models/merger");
const { createCorporations } = require("../../src/models/corporation");
const { Player } = require("../../src/models/player");

describe("Merger", () => {
  describe("start", () => {
    it("should find the acquirer and defunct corporation", () => {
      const connectedTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 2 }, isPlaced: true, belongsTo: "incorporated" },
        { position: { x: 0, y: 3 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 4 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 5 }, isPlaced: true, belongsTo: "zeta" },
      ];

      const merger = new Merger(2, createCorporations(), connectedTiles);
      merger.start("zeta", "hydra");

      assert.strictEqual(merger.acquirer, "zeta");
      assert.strictEqual(merger.defunct, "hydra");
    });
  });

  describe("hasEnd", () => {
    it("should give true, if all players have dealt with there defunct stocks", () => {
      const merger = new Merger(3, createCorporations(), []);
      merger.endTurn();
      merger.endTurn();
      merger.endTurn();
      assert.ok(merger.hasEnd());
    });

    it("should give false, if all players haven't dealt with there defunct stocks", () => {
      const players = ["a", "b", "c"];
      const merger = new Merger(players, createCorporations(), []);

      merger.endTurn();
      merger.endTurn();
      assert.ok(!merger.hasEnd());
    });
  });

  describe("end", () => {
    it("should end the merger round and defunct corporation should be merged to acquirer corporation", () => {
      const corporations = createCorporations();
      const connectedTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 2 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 3 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 4 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 5 }, isPlaced: true, belongsTo: "zeta" },
      ];
      const acquiredTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 2 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 3 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 4 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 5 }, isPlaced: true, belongsTo: "zeta" },
      ];

      const merger = new Merger(2, corporations, connectedTiles);

      corporations.hydra.establish();
      corporations.hydra.increaseSize(2);
      corporations.zeta.establish();
      corporations.zeta.increaseSize(3);
      merger.start("zeta", "hydra");
      merger.end();

      assert.deepStrictEqual(connectedTiles, acquiredTiles);
      assert.ok(!corporations.hydra.isActive);
      assert.deepStrictEqual(corporations.hydra.size, 0);
      assert.deepStrictEqual(corporations.zeta.size, 6);
    });
  });

  describe("sell", () => {
    it("should sell a given quantity of defunct stocks", () => {
      const corporations = createCorporations();
      const player = new Player("Honu", 0, { "hydra": 5 });
      const connectedTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 2 }, isPlaced: true, belongsTo: "incorporated" },
        { position: { x: 0, y: 3 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 4 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 5 }, isPlaced: true, belongsTo: "zeta" },
      ];

      const merger = new Merger(2, corporations, connectedTiles);

      corporations.hydra.establish();
      corporations.hydra.decrementStocks(5);
      corporations.hydra.increaseSize(2);
      corporations.zeta.establish();
      corporations.zeta.increaseSize(3);
      merger.start("zeta", "hydra");
      merger.sell(player, 5);

      const { balance, stocks } = player.portfolio();

      assert.strictEqual(balance, 1500);
      assert.strictEqual(stocks.hydra, 0);
      assert.strictEqual(corporations.hydra.stocks, 25);
    });

    it("should not sell any stocks if given quantity is greater than total defunct stocks", () => {
      const corporations = createCorporations();
      const player = new Player("Honu", 0, { "hydra": 5 });
      const connectedTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 2 }, isPlaced: true, belongsTo: "incorporated" },
        { position: { x: 0, y: 3 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 4 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 5 }, isPlaced: true, belongsTo: "zeta" },
      ];

      const merger = new Merger(2, corporations, connectedTiles);

      corporations.hydra.establish();
      corporations.hydra.decrementStocks(5);
      corporations.hydra.increaseSize(2);
      corporations.zeta.establish();
      corporations.zeta.increaseSize(3);
      merger.start("zyta", "hydra");
      merger.sell(player, 7);

      const { balance, stocks } = player.portfolio();

      assert.strictEqual(balance, 0);
      assert.strictEqual(stocks.hydra, 5);
      assert.strictEqual(corporations.hydra.stocks, 20);
    });
  });

  describe("trade", () => {
    it("should trade stocks of defunct corporation for 2:1", () => {
      const corporations = createCorporations();
      const player = new Player("Honu", 0, { "hydra": 5, "zeta": 0 });
      const connectedTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "hydra" },
        { position: { x: 0, y: 2 }, isPlaced: true, belongsTo: "incorporated" },
        { position: { x: 0, y: 3 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 4 }, isPlaced: true, belongsTo: "zeta" },
        { position: { x: 0, y: 5 }, isPlaced: true, belongsTo: "zeta" },
      ];

      const merger = new Merger(2, corporations, connectedTiles);

      corporations.hydra.establish();
      corporations.hydra.decrementStocks(5);
      corporations.hydra.increaseSize(2);
      corporations.zeta.establish();
      corporations.zeta.increaseSize(3);
      merger.start("zeta", "hydra");
      merger.trade(player, 4);

      const { balance, stocks } = player.portfolio();

      assert.strictEqual(balance, 0);
      assert.strictEqual(stocks.hydra, 1);
      assert.strictEqual(stocks.zeta, 2);
      assert.strictEqual(corporations.hydra.stocks, 24);
    });
  });
});
