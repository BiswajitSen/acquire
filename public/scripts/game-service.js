export default class GameService {
  #gameGateway;
  #components;

  constructor(gameGateway, components) {
    this.#gameGateway = gameGateway;
    this.#components = components;
  }

  async render() {
    const gameStatus = await this.#gameGateway.getStatus();

    this.#components.balance.update(gameStatus.portfolio.balance);
    this.#components.stocks.update(gameStatus.portfolio.stocks);
    this.#components.players.update(gameStatus.players);
    this.#components.displayPanel.update(gameStatus);
  }
}
