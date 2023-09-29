class Lobby {
  #hasExpired;
  #players;
  #size;

  constructor(size) {
    this.#players = [];
    this.#hasExpired = false;
    this.#size = size;
  }

  addPlayer(player) {
    this.#players.push(player);
  }

  #isPossibleToStartGame() {
    return this.#players.length >= this.#size.lowerLimit;
  }

  isFull() {
    return this.#players.length === this.#size.upperLimit;
  }

  expire() {
    this.#hasExpired = true;
  }

  #getSelf(username) {
    return this.#players.filter(player => player.username === username).pop();
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
