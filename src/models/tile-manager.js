const { range } = require("lodash");

/**
 * TileManager handles the tile stack and tile distribution.
 * Responsibilities:
 * - Create and shuffle tiles
 * - Pick tiles from the stack
 * - Distribute tiles to players
 */
class TileManager {
  #tiles;
  #shuffleFn;
  #rows;
  #cols;

  constructor(shuffleFn, rows = 9, cols = 12) {
    this.#shuffleFn = shuffleFn;
    this.#rows = rows;
    this.#cols = cols;
    this.#tiles = [];
  }

  /**
   * Create all tiles for the board
   */
  createTiles() {
    this.#tiles = range(this.#rows).flatMap(x =>
      range(this.#cols).map(y => ({
        position: { x, y },
        isPlaced: false,
      }))
    );
    return this;
  }

  /**
   * Shuffle the tile stack
   */
  shuffle() {
    this.#tiles = this.#shuffleFn(this.#tiles);
    return this;
  }

  /**
   * Pick a tile from the top of the stack
   */
  pickTile() {
    return this.#tiles.shift();
  }

  /**
   * Pick multiple tiles from the stack
   */
  pickTiles(count) {
    return this.#tiles.splice(0, count);
  }

  /**
   * Get the number of remaining tiles
   */
  get remainingCount() {
    return this.#tiles.length;
  }

  /**
   * Check if there are tiles remaining
   */
  get hasTiles() {
    return this.#tiles.length > 0;
  }

  /**
   * Distribute initial tiles to a player
   */
  distributeToPlayer(player, count = 6) {
    const tiles = this.pickTiles(count);
    tiles.forEach(tile => player.addTile(tile));
  }

  /**
   * Restore from saved state
   */
  static fromJSON(tiles, shuffleFn) {
    const manager = new TileManager(shuffleFn);
    manager.#tiles = tiles;
    return manager;
  }
}

module.exports = { TileManager };
