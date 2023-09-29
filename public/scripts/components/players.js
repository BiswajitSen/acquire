export default class Players {
  #players;
  #playerElements;
  #previousPlayer;
  #currentPlayer;

  constructor(playerElements, players) {
    this.#playerElements = playerElements;
    this.#players = players;
    this.#renderAll();
  }

  #renderAll() {
    this.#players.forEach((player, id) => {
      const { player: playerElement, name, avatar } = this.#playerElements[id];
      name.innerText = player.username;
      avatar.setAttribute("username", player.username);
      
      playerElement.removeAttribute("hidden");
      playerElement.removeAttribute("hidden");

      if (player.you) playerElement.classList.add("self");
      if (player.isTakingTurn) playerElement.classList.add("active");
    });
  }

  #render() {
    const previousPlayerID = this.#players.findIndex(
      player => player.username === this.#previousPlayer
    );

    const currentPlayerID = this.#players.findIndex(
      player => player.username === this.#currentPlayer
    );

    if (previousPlayerID !== -1) {
      this.#playerElements[previousPlayerID].player.classList.remove("active");
    }

    this.#playerElements[currentPlayerID].player.classList.add("active");
  }

  update(players) {
    const currentPlayer = players.find(player => player.isTakingTurn);
    if (this.#currentPlayer === currentPlayer.username) return;
    this.#previousPlayer = this.#currentPlayer;
    this.#currentPlayer = currentPlayer.username;
    this.#players = players;
    this.#render();
  }
}
