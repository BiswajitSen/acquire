import { createCard } from "./game.js";

const endMergerTurn = () => {
  fetch("/game/merger/end-turn", { method: "POST" });
};

export const renderMerge = (
  { turns, portfolio, corporations },
  activityConsole
) => {
  const lastActivity = turns.currentTurn.activities.at(-1);
  const { acquirer: acquirerName, defunct: defunctName } = lastActivity.data;
  const acquirer = corporations[acquirerName];
  const defunctStocks = portfolio.stocks[defunctName];

  const merger = new Merger({ defunctStocks, acquirer }, activityConsole);
  merger.render();
};

class Merger {
  #cart;
  #acquirer;
  #defunctStocks;
  #activityConsole;

  constructor({ defunctStocks, acquirer }, activityConsole) {
    this.#cart = { sell: 0, trade: 0 };
    this.#acquirer = acquirer;
    this.#defunctStocks = defunctStocks;
    this.#activityConsole = activityConsole;
  }

  #confirmDeal() {
    fetch("/game/merger/deal", {
      method: "POST",
      body: JSON.stringify(this.#cart),
      headers: {
        "content-type": "application/json",
      },
    });
  }

  #getHeldStocks() {
    return this.#defunctStocks - this.#cart.sell - this.#cart.trade;
  }

  #createBtn(symbol) {
    return generateComponent(["button", symbol, { class: "tile stock-btn" }]);
  }

  #incrementSellCount() {
    if (this.#getHeldStocks() > 0) this.#cart.sell += 1;
  }

  #decrementSellCount() {
    if (this.#cart.sell > 0) this.#cart.sell -= 1;
  }

  #createHoldBox() {
    return createCard(
      "Hold",
      [["div", this.#getHeldStocks(), { class: "tile" }]],
      "done"
    );
  }

  #incrementTradeCount() {
    const canTrade =
      this.#getHeldStocks() >= 2 &&
      this.#acquirer.stocks > this.#cart.trade / 2;

    if (canTrade) {
      this.#cart.trade += 2;
    }
  }

  #decrementTradeCount() {
    if (this.#cart.trade > 0) this.#cart.trade -= 2;
  }

  #createTradeBox() {
    const tradeCard = createCard("trade (2:1)", "", "done");
    const addBtn = this.#createBtn("＋");
    const subBtn = this.#createBtn("－");
    const tradeBox = generateComponent(["div", "", { class: "sell-box" }]);
    const tradeCount = generateComponent([
      "div",
      `${this.#cart.trade} : ${this.#cart.trade / 2}`,
      { class: "tile" },
    ]);

    addBtn.onclick = () => {
      this.#incrementTradeCount();
      this.render();
    };

    subBtn.onclick = () => {
      this.#decrementTradeCount();
      this.render();
    };

    tradeBox.append(subBtn, tradeCount, addBtn);
    tradeCard.lastChild.append(tradeBox);

    return tradeCard;
  }

  #createSellBox() {
    const sellCard = createCard("sell", "", "done");
    const addBtn = this.#createBtn("＋");
    const subBtn = this.#createBtn("－");
    const sellBox = generateComponent(["div", "", { class: "sell-box" }]);
    const stockCount = generateComponent([
      "div",
      this.#cart.sell,
      { class: "tile" },
    ]);

    addBtn.onclick = () => {
      this.#incrementSellCount();
      this.render();
    };

    subBtn.onclick = () => {
      this.#decrementSellCount();
      this.render();
    };

    sellBox.append(subBtn, stockCount, addBtn);
    sellCard.lastChild.append(sellBox);

    return sellCard;
  }

  #createDealOptions() {
    const dealOptions = generateComponent([
      "div",
      "",
      { class: "flex deal-options" },
    ]);

    dealOptions.append(
      this.#createHoldBox(),
      this.#createTradeBox(),
      this.#createSellBox()
    );
    return dealOptions;
  }

  #createButtonSection() {
    const buttonSection = generateComponent(["div", "", { class: "flex" }]);
    const confirmBtn = generateComponent(["button", "Confirm"]);
    const clearBtn = generateComponent(["button", "Reset"]);

    confirmBtn.onclick = () => {
      if (this.#cart.sell === 0 && this.#cart.trade === 0) {
        endMergerTurn();
        return;
      }

      this.#confirmDeal();
    };
    clearBtn.onclick = () => {
      this.#cart = { sell: 0, trade: 0 };
      this.render();
    };

    buttonSection.append(confirmBtn, clearBtn);

    return buttonSection;
  }

  render() {
    const transactionSection = generateComponent([
      "div",
      "",
      { class: "flex deal-defunct-stocks" },
    ]);

    transactionSection.append(
      this.#createDealOptions(),
      this.#createButtonSection()
    );

    this.#activityConsole.innerHTML = "";
    this.#activityConsole.append(transactionSection);
  }
}
