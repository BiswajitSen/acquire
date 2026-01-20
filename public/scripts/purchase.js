const getActivityConsole = () => document.querySelector("#activity-console");
const getDisplayPanel = () => document.querySelector("#display-panel");
const getCorporations = () => document.querySelector("#corporations");
const getTileContainer = () => document.querySelector("#tile-container");
const placeNewTile = tileElements => {
  tileElements.forEach(tileElement => {
    tileElement.classList.remove("used-tile");
  });
};

const createBonusTable = (majority, minority) => {
  return [
    "div",
    [
      [
        "div",
        [
          ["h5", "Majority"],
          ["h5", `$${majority.bonus}`],
          ...majority.players.map(name => ["p", name]),
        ],
      ],
      [
        "div",
        [
          ["h5", "Minority"],
          ["h5", `$${minority.bonus}`],
          ...minority.players.map(name => ["p", name]),
        ],
      ],
    ],
    { class: "bonus-table" },
  ];
};

const createRankElement = (player, rank) => {
  return generateComponent([
    "div",
    [
      ["p", rank],
      ["p", player.name],
      ["p", `$${player.balance}`],
    ],
    { class: "line" },
  ]);
};

const generateRankTable = playerRanks => {
  const rankTable = generateComponent([
    "div",
    [
      ["div", "Leader Board", { class: "label rank-card-header" }],
      [
        "div",
        [
          [
            "div",
            [
              ["p", "Rank"],
              ["p", "Name"],
              ["p", "Balance"],
            ],
            { class: "headers" },
          ],
        ],
        { class: "rank-card-body rows" },
      ],
    ],
    { class: "ranks" },
  ]);

  const rankCards = playerRanks.map((player, rank) =>
    createRankElement(player, rank + 1)
  );

  rankTable.querySelector(".rows").append(...rankCards);
  return rankTable;
};

const rankPlayers = players => {
  return [...players].sort((a, b) => b.balance - a.balance);
};

const createBonusCard = ({ corporation, majority, minority }) => {
  const bonusCard = generateComponent(["div", "", { class: "bonus-card" }]);

  const bonusCardHeader = generateComponent([
    "div",
    corporation.toUpperCase(),
    { class: "label bonus-card-header" },
  ]);

  const bonusCardBody = generateComponent([
    "div",
    [createBonusTable(majority, minority)],
    { class: "bonus-card-body" },
  ]);

  bonusCard.append(bonusCardHeader, bonusCardBody);

  return bonusCard;
};

const renderGameResult = ({ players, bonuses }) => {
  const playerRanks = rankPlayers(players);
  const resultWrapper = generateComponent([
    "div",
    [["h1", "Game Over !!"]],
    { class: "flex result-wrapper" },
  ]);
  const resultSection = generateComponent([
    "div",
    "",
    { class: "result-section" },
  ]);
  const bonusSection = generateComponent([
    "div",
    "",
    { class: "bonus-section" },
  ]);
  const closeBtn = generateComponent([
    "div",
    "×",
    { class: "bonus-close-btn" },
  ]);

  const bonusCards = bonuses.map(createBonusCard);
  const resultPage = generateComponent(["div", "", { class: "result-page" }]);
  resultSection.append(generateRankTable(playerRanks));
  bonusSection.append(...bonusCards);

  closeBtn.onclick = () => resultPage.remove();
  resultWrapper.append(closeBtn, resultSection, bonusSection);
  resultPage.append(resultWrapper);
  document.body.append(resultPage);
};

const getGameResult = () => {
  fetch(`${getGameBaseUrl()}/end-result`)
    .then(res => res.json())
    .then(renderGameResult);
};

const refillTile = () => {
  const transitionDelay = 1000;
  fetch(`${getGameBaseUrl()}/end-turn`, { method: "POST" }).then(() => {
    const tileElements = getTileElements();
    placeNewTile(tileElements);
    setTimeout(() => removeHighlight(tileElements), transitionDelay);
  });
};

const removeHighlight = tileElements => {
  tileElements.forEach(tileElement =>
    tileElement.classList.remove("highlight")
  );
};

const getTileElements = () => {
  const tileContainer = getTileContainer();
  return Array.from(tileContainer.children);
};

const capitalizeFirstLetter = text =>
  text.charAt(0).toUpperCase() + text.slice(1);

const renderTilePlacedMessage = () => {
  const refillTilePrompt = document.createElement("div");
  refillTilePrompt.classList.add("refill-tile-prompt");
  refillTilePrompt.append(...generateRefillTileBtn());
  getActivityConsole().append(refillTilePrompt);
};

const generateRefillTileBtn = () => {
  const refillTileMessageElement = generateComponent(["p", "Refill your tile"]);
  const endButton = generateComponent([
    "button",
    "Refill",
    { type: "button", onclick: "refillTile()" },
  ]);

  return [refillTileMessageElement, endButton];
};

const isSamePlayer = (self, currentPlayer) =>
  self.username === currentPlayer.username;

const corporationsInMarket = corporations =>
  Object.entries(corporations).filter(
    ([, corp]) => corp.isActive && corp.stocks > 0
  );

class Purchase {
  #cart;
  #portfolio;
  #corporations;
  #displayPanel;

  constructor(corporations, portfolio, displayPanel) {
    this.#cart = [];
    this.#portfolio = portfolio;
    this.#displayPanel = displayPanel;
    this.#corporations = corporations;
  }

  #confirmPurchase() {
    return fetch(`${getGameBaseUrl()}/buy-stocks`, {
      method: "POST",
      body: JSON.stringify(this.#cart),
      headers: {
        "content-type": "application/json",
      },
    });
  }

  #hasEnoughStocks(corp) {
    const [, corporation] = this.#corporations.find(([name]) => name === corp);
    const addedStocks = this.#cart.filter(({ name }) => name === corp).length;

    return corporation.stocks - addedStocks >= 1;
  }

  #selectStocks() {
    const mobileCorpBtn = document.querySelector('.mobile-panel-btn[data-panel="corporation"]');
    const corporationSection = document.getElementById("corporation-section");
    
    if (mobileCorpBtn) mobileCorpBtn.classList.add("attention-needed");
    if (corporationSection) corporationSection.classList.add("highlight-selection");
    
    this.#corporations
      .map(([name, { price }]) => {
        const corp = document.getElementById(name);

        corp.onclick = () => {
          if (this.#hasEnoughStocks(name)) {
            this.addToCart(name, price);
          }
        };
        return corp;
      })
      .forEach(corp => {
        corp.classList.remove("non-selectable");
      });

    getCorporations().classList.add("selectable");
  }

  removeStock(index) {
    this.#cart.splice(index, 1);
    this.#renderCart();
  }

  addToCart(name, price) {
    if (this.#cart.length === 3) return;
    this.#cart.push({ name, price });
    this.#renderCart();
  }

  #generateBuySkip() {
    const buySkipButtons = document.createElement("div");
    const buyButton = generateComponent([
      "button",
      "Buy",
      { type: "button", disabled: true, class: "disable-btn" },
    ]);

    if (this.#corporations.length > 0) {
      buyButton.classList.remove("disable-btn");
      buyButton.removeAttribute("disabled");
    }

    buyButton.onclick = () => {
      this.#selectStocks();
      this.#renderStockSelection();
    };

    const skipButton = generateComponent([
      "button",
      "Skip",
      { type: "button", onclick: "refillTile()" },
    ]);

    skipButton.onclick = () => {
      refillTile();
    };

    buySkipButtons.append(buyButton, skipButton);

    return [buySkipButtons];
  }

  #renderBuySkip() {
    const stockBuyingPrompt = document.createElement("div");

    stockBuyingPrompt.classList.add("buying-prompt");
    stockBuyingPrompt.append(...this.#generateBuySkip());
    this.#displayPanel.innerHTML = "";
    this.#displayPanel.append(stockBuyingPrompt);
  }

  #generateStockCards() {
    return this.#cart.map(({ name }, index) => {
      const stockCard = generateComponent([
        "div",
        [
          ["p", capitalizeFirstLetter(name), { class: "blank" }],
          ["div", "x"],
        ],
        { class: `${name} stock` },
      ]);

      stockCard.lastChild.onclick = () => this.removeStock(index);
      return stockCard;
    });
  }

  #renderCart() {
    const totalPrice = this.#cart.reduce((total, { price }) => {
      return total + price;
    }, 0);

    const cartElement = document.createElement("div");
    cartElement.append(...this.#generateStockCards());

    cartElement.classList.add("selected-stocks");
    const stockBuyingPrompt = document.createElement("div");

    stockBuyingPrompt.classList.add("buying-prompt");
    stockBuyingPrompt.append(...this.#generateConfirmCancel(totalPrice));

    this.#displayPanel.innerHTML = "";
    this.#displayPanel.append(cartElement, stockBuyingPrompt);
  }

  #priceElement(cannotPurchase, totalPrice) {
    const priceContainer = document.createElement("div");
    priceContainer.className = "price-display";
    
    if (cannotPurchase) {
      priceContainer.innerHTML = `<span class="total-label low-balance">Not Enough Balance:</span> <span class="total-price low-balance">$${totalPrice}</span>`;
    } else {
      priceContainer.innerHTML = `<span class="total-label">Total:</span> <span class="total-price">$${totalPrice || 0}</span>`;
    }

    return priceContainer;
  }

  #generateConfirmCancel(totalPrice) {
    const corporationsContainer = getCorporations();
    const corporationSection = document.getElementById("corporation-section");
    const mobileCorpBtn = document.querySelector('.mobile-panel-btn[data-panel="corporation"]');
    const cannotPurchase = this.#portfolio.balance < totalPrice;
    const balanceElement = this.#priceElement(cannotPurchase, totalPrice);
    const confirmButton = generateComponent([
      "button",
      "Confirm",
      { type: "button", "disabled": true, class: "disable-btn" },
    ]);

    if (!cannotPurchase && this.#cart.length > 0) {
      confirmButton.removeAttribute("disabled");
      confirmButton.classList.remove("disable-btn");

      confirmButton.onclick = () => {
        this.#confirmPurchase().then(refillTile);
        corporationsContainer.classList.remove("selectable");
        if (corporationSection) corporationSection.classList.remove("highlight-selection");
        if (mobileCorpBtn) mobileCorpBtn.classList.remove("attention-needed");
        [...corporationsContainer.children].forEach(c =>
          c.classList.add("non-selectable")
        );
      };
    }

    const skipButton = generateComponent([
      "button",
      "Skip",
      { type: "button" },
    ]);

    skipButton.onclick = () => {
      refillTile();
      getCorporations().classList.remove("selectable");
      if (corporationSection) corporationSection.classList.remove("highlight-selection");
      if (mobileCorpBtn) mobileCorpBtn.classList.remove("attention-needed");
      [...corporationsContainer.children].forEach(c =>
        c.classList.add("non-selectable")
      );
    };

    return [balanceElement, confirmButton, skipButton];
  }

  #renderStockSelection() {
    const stockBuyingPrompt = document.createElement("div");
    const buyMsg = generateComponent(["p", "Select your stocks (Max : 3)"]);
    stockBuyingPrompt.classList.add("buying-prompt");
    stockBuyingPrompt.append(...this.#generateConfirmCancel());

    this.#displayPanel.innerHTML = "";
    this.#displayPanel.append(buyMsg, stockBuyingPrompt);
  }

  render() {
    this.#renderBuySkip();
  }
}

const startPurchase = ({ corporations, portfolio }, activityConsole) => {
  const availableCorporations = corporationsInMarket(corporations);
  
  if (availableCorporations.length === 0) {
    activityConsole.innerHTML = '<p class="auto-skip-msg">No stocks available - skipping purchase...</p>';
    setTimeout(refillTile, 800);
    return;
  }
  
  const purchase = new Purchase(
    availableCorporations,
    portfolio,
    activityConsole
  );

  purchase.render();
};
