class Player {
  #username;
  #tiles;
  #stocks;
  #balance;
  #isTakingTurn;
  #newTile;

  constructor(username, balance = 0, stocks = {}, tiles = []) {
    this.#username = username;
    this.#tiles = tiles;
    this.#stocks = stocks;
    this.#balance = balance;
    this.#isTakingTurn = false;
    this.#newTile = undefined;
  }

  get username() {
    return this.#username;
  }

  get isTakingTurn() {
    return this.#isTakingTurn;
  }

  get balance() {
    return this.#balance;
  }

  portfolio() {
    return {
      newTile: this.#newTile,
      tiles: [...this.#tiles],
      stocks: { ...this.#stocks },
      balance: this.#balance,
    };
  }

  addIncome(amount) {
    this.#balance += amount;
  }

  addExpense(amount) {
    this.#balance -= amount;
  }

  addTile(tile) {
    this.#tiles.push(tile);
  }

  exchangeTiles(tiles) {
    this.#tiles = tiles;
  }

  #replaceWithUsedTile() {
    for (let tileID = 0; tileID < this.#tiles.length; tileID++) {
      const tile = this.#tiles[tileID];
      if (tile && tile.isPlaced) {
        this.#tiles[tileID] = this.#newTile;
      }
    }
  }

  refillTile(newTile) {
    this.#newTile = newTile;
    this.#replaceWithUsedTile();
  }

  placeTile(position) {
    const targetTile = this.#tiles.find(
      tile =>
        tile && tile.position.x === position.x && tile.position.y === position.y
    );

    targetTile.isPlaced = true;
  }

  addStocks(corp, quantity) {
    this.#stocks[corp] += quantity;
  }

  startTurn() {
    this.#isTakingTurn = true;
  }

  sellStocks(corp, quantity) {
    this.#stocks[corp] -= quantity;
  }

  endTurn() {
    this.#isTakingTurn = false;
  }

  static fromJSON({ username, portfolio }) {
    const player = new Player();

    player.#username = username;
    player.#tiles = portfolio.tiles;
    player.#stocks = portfolio.stocks;
    player.#balance = portfolio.balance;

    return player;
  }
}

const initializeAccountStocks = () => {
  return {
    "phoenix": 0,
    "quantum": 0,
    "hydra": 0,
    "fusion": 0,
    "america": 0,
    "sackson": 0,
    "zeta": 0,
  };
};

const createPlayers = players => {
  const balance = 0;
  return players.map(
    player => new Player(player.username, balance, initializeAccountStocks())
  );
};

module.exports = { createPlayers, Player };
