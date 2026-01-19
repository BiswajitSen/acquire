const { groupBy } = require("lodash");

/**
 * Board class handles the game board grid and tile connectivity.
 * Responsibilities:
 * - Track placed tiles on the board
 * - Find connected tile groups
 * - Determine tile adjacency and corporation membership
 */
class Board {
  #placedTiles;
  #rows;
  #cols;

  constructor(rows = 9, cols = 12) {
    this.#placedTiles = [];
    this.#rows = rows;
    this.#cols = cols;
  }

  /**
   * Place a tile on the board
   */
  placeTile(position, belongsTo = "incorporated") {
    const tile = {
      position,
      isPlaced: true,
      belongsTo,
    };
    this.#placedTiles.push(tile);
    return tile;
  }

  /**
   * Get a tile at a specific position
   */
  getTileAt(x, y) {
    return this.#placedTiles.find(
      ({ position }) => position.x === x && position.y === y
    );
  }

  /**
   * Find all tiles connected to a position (flood fill)
   */
  findConnectedTiles(position) {
    const visited = new Set();
    const connected = [];
    
    this.#floodFill(position.x, position.y, visited, connected);
    
    return connected;
  }

  #floodFill(x, y, visited, connected) {
    const key = `${x},${y}`;
    if (visited.has(key)) return;
    
    const tile = this.getTileAt(x, y);
    if (!tile) return;
    
    visited.add(key);
    connected.push(tile);

    this.#floodFill(x + 1, y, visited, connected);
    this.#floodFill(x - 1, y, visited, connected);
    this.#floodFill(x, y + 1, visited, connected);
    this.#floodFill(x, y - 1, visited, connected);
  }

  /**
   * Group connected tiles by their corporation ownership
   */
  groupTilesByCorporation(connectedTiles) {
    return groupBy(connectedTiles, "belongsTo");
  }

  /**
   * Update tile ownership to a corporation
   */
  assignTilesToCorporation(tiles, corporationName) {
    tiles.forEach(tile => {
      tile.belongsTo = corporationName;
    });
  }

  /**
   * Get tiles belonging to a specific corporation from a set of tiles
   */
  filterTilesByCorporation(tiles, corporationName) {
    return tiles.filter(({ belongsTo }) => belongsTo === corporationName);
  }

  /**
   * Get all placed tiles
   */
  get placedTiles() {
    return [...this.#placedTiles];
  }

  /**
   * Get board dimensions
   */
  get dimensions() {
    return { rows: this.#rows, cols: this.#cols };
  }

  /**
   * Check if a position is valid
   */
  isValidPosition(x, y) {
    return x >= 0 && x < this.#rows && y >= 0 && y < this.#cols;
  }

  /**
   * Check if a position is already occupied
   */
  isOccupied(x, y) {
    return this.getTileAt(x, y) !== undefined;
  }

  /**
   * Get tiles adjacent to a position (without requiring a tile at that position)
   */
  getAdjacentTiles(position) {
    const { x, y } = position;
    const adjacentPositions = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];

    return adjacentPositions
      .map(pos => this.getTileAt(pos.x, pos.y))
      .filter(tile => tile !== undefined);
  }

  /**
   * Restore board state from data
   */
  static fromJSON(placedTiles) {
    const board = new Board();
    board.#placedTiles = placedTiles;
    return board;
  }
}

module.exports = { Board };
