class Lobby {
  #hasExpired;
  #players;
  #size;
  #createdAt;
  #lastActivityAt;

  constructor(size) {
    this.#players = [];
    this.#hasExpired = false;
    this.#size = size;
    this.#createdAt = Date.now();
    this.#lastActivityAt = Date.now();
  }

  addPlayer(player) {
    this.#players.push(player);
    this.#updateActivity();
  }

  removePlayer(username) {
    const index = this.#players.findIndex(p => p.username === username);
    if (index !== -1) {
      this.#players.splice(index, 1);
      this.#updateActivity();
      return true;
    }
    return false;
  }

  #updateActivity() {
    this.#lastActivityAt = Date.now();
  }

  #isPossibleToStartGame() {
    return this.#players.length >= this.#size.lowerLimit;
  }

  isFull() {
    return this.#players.length === this.#size.upperLimit;
  }

  isEmpty() {
    return this.#players.length === 0;
  }

  expire() {
    this.#hasExpired = true;
  }

  #getSelf(username) {
    return this.#players.filter(player => player.username === username).pop();
  }

  get createdAt() {
    return this.#createdAt;
  }

  get lastActivityAt() {
    return this.#lastActivityAt;
  }

  get playerCount() {
    return this.#players.length;
  }

  status(username) {
    return {
      players: this.#players.map(player => ({ ...player })),
      isFull: this.isFull(),
      hasExpired: this.#hasExpired,
      isPossibleToStartGame: this.#isPossibleToStartGame(),
      host: this.#players[0],
      self: this.#getSelf(username),
    };
  }
}

module.exports = Lobby;
