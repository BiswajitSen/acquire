const { range } = require("lodash");

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

  createTiles() {
    this.#tiles = range(this.#rows).flatMap(x =>
      range(this.#cols).map(y => ({
        position: { x, y },
        isPlaced: false,
      }))
    );
    return this;
  }

  shuffle() {
    this.#tiles = this.#shuffleFn(this.#tiles);
    return this;
  }

  pickTile() {
    return this.#tiles.shift();
  }

  pickTiles(count) {
    return this.#tiles.splice(0, count);
  }

  get remainingCount() {
    return this.#tiles.length;
  }

  get hasTiles() {
    return this.#tiles.length > 0;
  }

  distributeToPlayer(player, count = 6) {
    const tiles = this.pickTiles(count);
    tiles.forEach(tile => player.addTile(tile));
  }

  static fromJSON(tiles, shuffleFn) {
    const manager = new TileManager(shuffleFn);
    manager.#tiles = tiles;
    return manager;
  }
}

module.exports = { TileManager };
