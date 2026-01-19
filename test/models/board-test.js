const assert = require("assert");
const { describe, it } = require("node:test");
const { Board } = require("../../src/models/board");

describe("Board", () => {
  describe("constructor", () => {
    it("should create an empty board with default dimensions", () => {
      const board = new Board();
      
      assert.deepStrictEqual(board.placedTiles, []);
      assert.deepStrictEqual(board.dimensions, { rows: 9, cols: 12 });
    });

    it("should create a board with custom dimensions", () => {
      const board = new Board(5, 8);
      
      assert.deepStrictEqual(board.dimensions, { rows: 5, cols: 8 });
    });
  });

  describe("placeTile", () => {
    it("should place a tile on the board", () => {
      const board = new Board();
      const position = { x: 3, y: 5 };
      
      const tile = board.placeTile(position);
      
      assert.deepStrictEqual(tile, {
        position: { x: 3, y: 5 },
        isPlaced: true,
        belongsTo: "incorporated",
      });
      assert.strictEqual(board.placedTiles.length, 1);
    });

    it("should place a tile with a specific corporation", () => {
      const board = new Board();
      const position = { x: 2, y: 4 };
      
      const tile = board.placeTile(position, "phoenix");
      
      assert.strictEqual(tile.belongsTo, "phoenix");
    });

    it("should place multiple tiles", () => {
      const board = new Board();
      
      board.placeTile({ x: 0, y: 0 });
      board.placeTile({ x: 0, y: 1 });
      board.placeTile({ x: 1, y: 0 });
      
      assert.strictEqual(board.placedTiles.length, 3);
    });
  });

  describe("getTileAt", () => {
    it("should return the tile at a specific position", () => {
      const board = new Board();
      board.placeTile({ x: 3, y: 5 }, "quantum");
      
      const tile = board.getTileAt(3, 5);
      
      assert.strictEqual(tile.belongsTo, "quantum");
    });

    it("should return undefined for empty position", () => {
      const board = new Board();
      
      const tile = board.getTileAt(0, 0);
      
      assert.strictEqual(tile, undefined);
    });
  });

  describe("findConnectedTiles", () => {
    it("should find a single tile", () => {
      const board = new Board();
      board.placeTile({ x: 2, y: 3 });
      
      const connected = board.findConnectedTiles({ x: 2, y: 3 });
      
      assert.strictEqual(connected.length, 1);
    });

    it("should find horizontally connected tiles", () => {
      const board = new Board();
      board.placeTile({ x: 0, y: 0 });
      board.placeTile({ x: 0, y: 1 });
      board.placeTile({ x: 0, y: 2 });
      
      const connected = board.findConnectedTiles({ x: 0, y: 0 });
      
      assert.strictEqual(connected.length, 3);
    });

    it("should find vertically connected tiles", () => {
      const board = new Board();
      board.placeTile({ x: 0, y: 0 });
      board.placeTile({ x: 1, y: 0 });
      board.placeTile({ x: 2, y: 0 });
      
      const connected = board.findConnectedTiles({ x: 0, y: 0 });
      
      assert.strictEqual(connected.length, 3);
    });

    it("should find L-shaped connected tiles", () => {
      const board = new Board();
      board.placeTile({ x: 0, y: 0 });
      board.placeTile({ x: 0, y: 1 });
      board.placeTile({ x: 1, y: 1 });
      
      const connected = board.findConnectedTiles({ x: 0, y: 0 });
      
      assert.strictEqual(connected.length, 3);
    });

    it("should not include disconnected tiles", () => {
      const board = new Board();
      board.placeTile({ x: 0, y: 0 });
      board.placeTile({ x: 5, y: 5 });

      const connected = board.findConnectedTiles({ x: 0, y: 0 });
      
      assert.strictEqual(connected.length, 1);
    });

    it("should return empty array for non-existent position", () => {
      const board = new Board();
      
      const connected = board.findConnectedTiles({ x: 0, y: 0 });
      
      assert.strictEqual(connected.length, 0);
    });
  });

  describe("getAdjacentTiles", () => {
    it("should return empty array when no adjacent tiles", () => {
      const board = new Board();
      board.placeTile({ x: 0, y: 0 });
      
      const adjacent = board.getAdjacentTiles({ x: 5, y: 5 });
      
      assert.strictEqual(adjacent.length, 0);
    });

    it("should find tiles adjacent to a position", () => {
      const board = new Board();
      board.placeTile({ x: 0, y: 0 });
      board.placeTile({ x: 2, y: 1 });
      board.placeTile({ x: 1, y: 2 });
      
      const adjacent = board.getAdjacentTiles({ x: 1, y: 1 });

      assert.strictEqual(adjacent.length, 2);
    });

    it("should not require a tile at the target position", () => {
      const board = new Board();
      board.placeTile({ x: 1, y: 0 });
      board.placeTile({ x: 0, y: 1 });

      const adjacent = board.getAdjacentTiles({ x: 0, y: 0 });
      
      assert.strictEqual(adjacent.length, 2);
    });
  });

  describe("groupTilesByCorporation", () => {
    it("should group tiles by their corporation", () => {
      const tiles = [
        { belongsTo: "phoenix" },
        { belongsTo: "phoenix" },
        { belongsTo: "quantum" },
        { belongsTo: "incorporated" },
      ];
      
      const board = new Board();
      const grouped = board.groupTilesByCorporation(tiles);
      
      assert.strictEqual(grouped.phoenix.length, 2);
      assert.strictEqual(grouped.quantum.length, 1);
      assert.strictEqual(grouped.incorporated.length, 1);
    });

    it("should handle empty array", () => {
      const board = new Board();
      const grouped = board.groupTilesByCorporation([]);
      
      assert.deepStrictEqual(grouped, {});
    });
  });

  describe("assignTilesToCorporation", () => {
    it("should update tile ownership", () => {
      const board = new Board();
      const tile1 = board.placeTile({ x: 0, y: 0 });
      const tile2 = board.placeTile({ x: 0, y: 1 });
      
      board.assignTilesToCorporation([tile1, tile2], "hydra");
      
      assert.strictEqual(tile1.belongsTo, "hydra");
      assert.strictEqual(tile2.belongsTo, "hydra");
    });
  });

  describe("filterTilesByCorporation", () => {
    it("should filter tiles by corporation", () => {
      const tiles = [
        { belongsTo: "phoenix" },
        { belongsTo: "quantum" },
        { belongsTo: "phoenix" },
      ];
      
      const board = new Board();
      const filtered = board.filterTilesByCorporation(tiles, "phoenix");
      
      assert.strictEqual(filtered.length, 2);
    });
  });

  describe("isValidPosition", () => {
    it("should return true for valid positions", () => {
      const board = new Board();
      
      assert.ok(board.isValidPosition(0, 0));
      assert.ok(board.isValidPosition(8, 11));
      assert.ok(board.isValidPosition(4, 6));
    });

    it("should return false for invalid positions", () => {
      const board = new Board();
      
      assert.ok(!board.isValidPosition(-1, 0));
      assert.ok(!board.isValidPosition(0, -1));
      assert.ok(!board.isValidPosition(9, 0));
      assert.ok(!board.isValidPosition(0, 12));
    });
  });

  describe("isOccupied", () => {
    it("should return true for occupied position", () => {
      const board = new Board();
      board.placeTile({ x: 3, y: 4 });
      
      assert.ok(board.isOccupied(3, 4));
    });

    it("should return false for unoccupied position", () => {
      const board = new Board();
      
      assert.ok(!board.isOccupied(0, 0));
    });
  });

  describe("fromJSON", () => {
    it("should restore board from placed tiles", () => {
      const placedTiles = [
        { position: { x: 0, y: 0 }, isPlaced: true, belongsTo: "phoenix" },
        { position: { x: 0, y: 1 }, isPlaced: true, belongsTo: "phoenix" },
      ];
      
      const board = Board.fromJSON(placedTiles);
      
      assert.strictEqual(board.placedTiles.length, 2);
      assert.strictEqual(board.getTileAt(0, 0).belongsTo, "phoenix");
    });
  });
});
