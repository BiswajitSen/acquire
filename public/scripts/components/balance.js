export default class Balance {
  #balance;
  #element;
  #onRender;

  constructor(element, onRender, balance = 0) {
    this.#balance = balance;
    this.#element = element;
    this.#onRender = onRender;
    this.#render();
  }

  #render() {
    this.#element.innerText = this.#balance;
    this.#onRender();
  }

  update(balance) {
    if (this.#balance === balance) return;
    this.#balance = balance;
    this.#render();
  }
}
