const assert = require("assert");
const { describe, it } = require("node:test");
const { TileManager } = require("../../src/models/tile-manager");
const { Player } = require("../../src/models/player");

describe("TileManager", () => {
  describe("constructor", () => {
    it("should create an empty tile manager", () => {
      const manager = new TileManager(x => x);
      
      assert.strictEqual(manager.remainingCount, 0);
      assert.ok(!manager.hasTiles);
    });
  });

  describe("createTiles", () => {
    it("should create tiles for default 9x12 board", () => {
      const manager = new TileManager(x => x);
      
      manager.createTiles();

      assert.strictEqual(manager.remainingCount, 108);
    });

    it("should create tiles for custom board size", () => {
      const manager = new TileManager(x => x, 5, 5);
      
      manager.createTiles();
      
      assert.strictEqual(manager.remainingCount, 25);
    });

    it("should create tiles with correct structure", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      
      const tile = manager.pickTile();
      
      assert.ok(tile.position);
      assert.strictEqual(typeof tile.position.x, "number");
      assert.strictEqual(typeof tile.position.y, "number");
      assert.strictEqual(tile.isPlaced, false);
    });

    it("should return self for chaining", () => {
      const manager = new TileManager(x => x);
      
      const result = manager.createTiles();
      
      assert.strictEqual(result, manager);
    });
  });

  describe("shuffle", () => {
    it("should shuffle tiles using provided function", () => {
      const reverseShffle = arr => [...arr].reverse();
      const manager = new TileManager(reverseShffle);
      manager.createTiles();
      
      const manager2 = new TileManager(reverseShffle);
      manager2.createTiles().shuffle();
      const firstTileAfter = manager2.pickTile();

      assert.strictEqual(firstTileAfter.position.x, 8);
      assert.strictEqual(firstTileAfter.position.y, 11);
    });

    it("should return self for chaining", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      
      const result = manager.shuffle();
      
      assert.strictEqual(result, manager);
    });
  });

  describe("pickTile", () => {
    it("should pick a tile from the stack", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      const initialCount = manager.remainingCount;
      
      const tile = manager.pickTile();
      
      assert.ok(tile);
      assert.strictEqual(manager.remainingCount, initialCount - 1);
    });

    it("should pick tiles in order (FIFO)", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      
      const tile1 = manager.pickTile();
      const tile2 = manager.pickTile();
      
      assert.deepStrictEqual(tile1.position, { x: 0, y: 0 });
      assert.deepStrictEqual(tile2.position, { x: 0, y: 1 });
    });

    it("should return undefined when no tiles left", () => {
      const manager = new TileManager(x => x, 1, 1);
      manager.createTiles();
      manager.pickTile();
      
      const tile = manager.pickTile();
      
      assert.strictEqual(tile, undefined);
    });
  });

  describe("pickTiles", () => {
    it("should pick multiple tiles at once", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      const initialCount = manager.remainingCount;
      
      const tiles = manager.pickTiles(6);
      
      assert.strictEqual(tiles.length, 6);
      assert.strictEqual(manager.remainingCount, initialCount - 6);
    });

    it("should pick tiles in order", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      
      const tiles = manager.pickTiles(3);
      
      assert.deepStrictEqual(tiles[0].position, { x: 0, y: 0 });
      assert.deepStrictEqual(tiles[1].position, { x: 0, y: 1 });
      assert.deepStrictEqual(tiles[2].position, { x: 0, y: 2 });
    });

    it("should return fewer tiles if not enough remaining", () => {
      const manager = new TileManager(x => x, 1, 2);
      manager.createTiles();
      
      const tiles = manager.pickTiles(5);
      
      assert.strictEqual(tiles.length, 2);
    });
  });

  describe("remainingCount", () => {
    it("should return correct count", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      
      assert.strictEqual(manager.remainingCount, 108);
      
      manager.pickTile();
      assert.strictEqual(manager.remainingCount, 107);
      
      manager.pickTiles(5);
      assert.strictEqual(manager.remainingCount, 102);
    });
  });

  describe("hasTiles", () => {
    it("should return true when tiles exist", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      
      assert.ok(manager.hasTiles);
    });

    it("should return false when no tiles", () => {
      const manager = new TileManager(x => x);
      
      assert.ok(!manager.hasTiles);
    });

    it("should return false after all tiles picked", () => {
      const manager = new TileManager(x => x, 1, 2);
      manager.createTiles();
      manager.pickTiles(2);
      
      assert.ok(!manager.hasTiles);
    });
  });

  describe("distributeToPlayer", () => {
    it("should distribute 6 tiles by default", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      const player = new Player("test");
      
      manager.distributeToPlayer(player);
      
      const { tiles } = player.portfolio();
      assert.strictEqual(tiles.length, 6);
    });

    it("should distribute custom number of tiles", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      const player = new Player("test");
      
      manager.distributeToPlayer(player, 4);
      
      const { tiles } = player.portfolio();
      assert.strictEqual(tiles.length, 4);
    });

    it("should reduce tile count", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      const initialCount = manager.remainingCount;
      const player = new Player("test");
      
      manager.distributeToPlayer(player, 6);
      
      assert.strictEqual(manager.remainingCount, initialCount - 6);
    });

    it("should distribute unique tiles to different players", () => {
      const manager = new TileManager(x => x);
      manager.createTiles();
      const player1 = new Player("test1");
      const player2 = new Player("test2");
      
      manager.distributeToPlayer(player1, 3);
      manager.distributeToPlayer(player2, 3);
      
      const tiles1 = player1.portfolio().tiles;
      const tiles2 = player2.portfolio().tiles;

      const allPositions = [...tiles1, ...tiles2].map(
        t => `${t.position.x},${t.position.y}`
      );
      const uniquePositions = new Set(allPositions);
      assert.strictEqual(uniquePositions.size, 6);
    });
  });

  describe("fromJSON", () => {
    it("should restore tile manager from tiles", () => {
      const tiles = [
        { position: { x: 5, y: 5 }, isPlaced: false },
        { position: { x: 6, y: 6 }, isPlaced: false },
      ];
      
      const manager = TileManager.fromJSON(tiles, x => x);
      
      assert.strictEqual(manager.remainingCount, 2);
      assert.deepStrictEqual(manager.pickTile().position, { x: 5, y: 5 });
    });

    it("should work with empty tiles", () => {
      const manager = TileManager.fromJSON([], x => x);
      
      assert.strictEqual(manager.remainingCount, 0);
      assert.ok(!manager.hasTiles);
    });
  });
});
