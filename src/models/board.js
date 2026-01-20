const { groupBy } = require("lodash");

class Board {
  #placedTiles;
  #rows;
  #cols;

  constructor(rows = 9, cols = 12) {
    this.#placedTiles = [];
    this.#rows = rows;
    this.#cols = cols;
  }

  placeTile(position, belongsTo = "incorporated") {
    const tile = {
      position,
      isPlaced: true,
      belongsTo,
    };
    this.#placedTiles.push(tile);
    return tile;
  }

  getTileAt(x, y) {
    return this.#placedTiles.find(
      ({ position }) => position.x === x && position.y === y
    );
  }

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

  groupTilesByCorporation(connectedTiles) {
    return groupBy(connectedTiles, "belongsTo");
  }

  assignTilesToCorporation(tiles, corporationName) {
    tiles.forEach(tile => {
      tile.belongsTo = corporationName;
    });
  }

  filterTilesByCorporation(tiles, corporationName) {
    return tiles.filter(({ belongsTo }) => belongsTo === corporationName);
  }

  get placedTiles() {
    return [...this.#placedTiles];
  }

  get dimensions() {
    return { rows: this.#rows, cols: this.#cols };
  }

  isValidPosition(x, y) {
    return x >= 0 && x < this.#rows && y >= 0 && y < this.#cols;
  }

  isOccupied(x, y) {
    return this.getTileAt(x, y) !== undefined;
  }

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

  static fromJSON(placedTiles) {
    const board = new Board();
    board.#placedTiles = placedTiles;
    return board;
  }
}

module.exports = { Board };
