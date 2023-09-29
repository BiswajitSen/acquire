export default class Stocks {
  #stockQntElements;
  #onRender;
  #stocks;

  constructor(stockQntElements, onRender, stocks = {}) {
    this.#stockQntElements = stockQntElements;
    this.#onRender = onRender;
    this.#stocks = stocks;
    this.#renderAll();
  }

  #render(corp) {
    this.#stockQntElements[corp].quantity.innerText = this.#stocks[corp];
    this.#onRender(corp);
  }

  #renderAll() {
    Object.keys(this.#stocks).forEach(corp => this.#render(corp));
  }

  update(stocks) {
    Object.entries(stocks).forEach(([corp, qnt]) => {
      if (this.#stocks[corp] === qnt) return;
      this.#stocks[corp] = qnt;
      this.#render(corp);
    });
  }
}
