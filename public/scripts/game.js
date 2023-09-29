import GameService from "/scripts/game-service.js";
import GameGateway from "/scripts/game-gateway.js";
import Balance from "/scripts/components/balance.js";
import Stocks from "/scripts/components/stocks.js";
import Players from "/scripts/components/players.js";
import { renderMerge } from "/scripts/merger.js";
import { resolveMergeConflict } from "/scripts/merge-conflict.js";
import DisplayPanel from "/scripts/components/display-panel.js";
import { selectAcquirer } from "/scripts/multiple-acquirer.js";
import { selectDefunct } from "/scripts/multiple-defunct.js";

let previousState;

const CORPORATIONS = [
  "phoenix",
  "quantum",
  "hydra",
  "fusion",
  "america",
  "sackson",
  "zeta",
  "incorporated",
];

const ACTIVITIES = {
  tilePlace: "tile-place",
  establish: "establish",
  buyStocks: "buy-stocks",
  merge: "merge",
  mergeConflict: "merge-conflict",
  acquirerSelection: "acquirer-selection",
  defunctSelection: "defunct-selection",
};

const getTile = position => {
  const columnSpecification = position.y + 1;
  const rowSpecification = String.fromCharCode(position.x + 65);

  return columnSpecification + rowSpecification;
};

const stockIDs = {
  "phoenix": "phoenix-stock",
  "quantum": "quantum-stock",
  "hydra": "hydra-stock",
  "fusion": "fusion-stock",
  "america": "america-stock",
  "sackson": "sackson-stock",
  "zeta": "zeta-stock",
};

const getStockElement = ([corp, id]) => {
  const corpElement = document.getElementById(id);

  return [
    corp,
    {
      card: corpElement,
      quantity: corpElement.querySelector(".quantity"),
    },
  ];
};

const getDisplayPanelElement = () => {
  const panel = document.querySelector("#display-panel");
  const historyPane = panel.querySelector("#history-pane");
  const activityConsole = panel.querySelector("#activity-console");

  return { panel, historyPane, activityConsole };
};

const getStockElements = () => {
  const stockContainerEntries = Object.entries(stockIDs).map(getStockElement);
  return Object.fromEntries(stockContainerEntries);
};

const getPlayerElements = () => {
  const players = document.querySelector("#players");
  return [...players.children].map(player => ({
    player,
    name: player.querySelector(".name"),
    avatar: player.querySelector(".avatar"),
  }));
};

const getCorporation = id => document.getElementById(id);
const getBoard = () => document.querySelectorAll(".space");
const getInfoIcon = () => document.querySelector("#info-icon");
const getInfoCard = () => document.querySelector("#info-card");
const getInfoCloseBtn = () => document.querySelector("#info-close-btn");
const getTileContainer = () => document.querySelector("#tile-container");
const getTileSection = () => document.querySelector(".tiles");
const getTileElements = () => {
  const tileContainer = getTileContainer();
  return Array.from(tileContainer.children);
};

const getHistoryPane = () => document.querySelector("#history-pane");
const getHistoryButton = () => document.querySelector("#history-button");

const setupHistory = () => {
  const historyButton = getHistoryButton();
  const historyPane = getHistoryPane();

  historyButton.onclick = () => {
    historyPane.classList.toggle("expanded");
    const isExpanded = historyPane.classList.contains("expanded");
    historyButton.value = isExpanded ? "Close" : "Previous Turn";
  };
};

const getBalanceContainer = () => document.querySelector("#balance-container");

const getCorporations = () => document.querySelector("#corporations");

const establishCorporation = data => {
  fetch("/game/establish", {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "content-type": "application/json",
    },
  });
};

const renderCorporations = ({ corporations }) => {
  Object.entries(corporations).forEach(([name, stats]) => {
    const corporation = getCorporation(name);

    if (stats.isSafe) corporation.classList.add("safe");

    corporation.querySelector(".price").innerText = `$${stats.price}`;
    corporation.querySelector(".size").innerText = stats.size;
    corporation.querySelector(".stocks").innerText = stats.stocks;
  });
};

const fillSpace = (position, corpClass) => {
  const board = getBoard();
  const tileId = position.x * 12 + position.y;
  const tile = board[tileId];
  CORPORATIONS.forEach(corp => tile.classList.remove(corp));
  tile.classList.add(corpClass);
};

const disablePlayerTiles = () => {
  const tileContainer = getTileContainer();
  tileContainer.classList.add("disable-click");
  getTileSection().classList.remove("highlight-player-tile");
};

const setUpTiles = ({ position }) => {
  fetch("/game/tile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(position),
  })
    .then(res => {
      if (res.status === 200) {
        fillSpace(position);
      }
    })
    .then(disablePlayerTiles);
};

const displayTile = (tileElement, position) => {
  const { x, y } = position;
  const columnSpecification = y + 1;
  const rowSpecification = String.fromCharCode(x + 65);
  tileElement.innerText = columnSpecification + rowSpecification;
};

const attachListener = (tileElement, tile) => {
  tileElement.onclick = () => {
    tileElement.classList.add("used-tile");
    setUpTiles(tile);
  };
};

const addVisualAttribute = (tileElement, { isPlaced }) => {
  tileElement.classList.remove("unplayable-tile");
  if (isPlaced) tileElement.classList.add("used-tile");
};

const getBoardTile = position => {
  const board = getBoard();
  const tileId = position.x * 12 + position.y;
  return board[tileId];
};

const highlightTile = tile => {
  const onBoardTile = getBoardTile(tile.position);
  onBoardTile.classList.add("highlight");
};

const removeHighlight = tile => {
  const onBoardTile = getBoardTile(tile.position);
  onBoardTile.classList.remove("highlight");
};

const setUpHoverEventForTiles = tiles => {
  const tileContainer = getTileContainer();

  tileContainer.onmouseover = () => {
    tiles.forEach(highlightTile);
  };

  tileContainer.onmouseleave = () => {
    tiles.forEach(removeHighlight);
  };
};

const displayAndSetupAccountTiles = gameStatus => {
  const { tiles } = gameStatus.portfolio;
  const tileElements = getTileElements();
  setUpHoverEventForTiles(tiles.filter(tile => tile));

  tiles.forEach((tile, tileID) => {
    const tileElement = tileElements[tileID];
    if (!tile) {
      tileElement.innerText = "";
      tileElement.classList.add("used-tile");
      tileElement.classList.remove("unplayable-tile");
      return;
    }

    displayTile(tileElement, tile.position);
    addVisualAttribute(tileElement, tile);
    attachListener(tileElement, tile);
    if (tile.exchange === "yes") {
      tileElement.onclick = () => {};
      tileElement.classList.add("unplayable-tile");
    }
  });
};

const setupInfoCard = () => {
  const infoIcon = getInfoIcon();
  const infoCard = getInfoCard();
  const infoCloseBtn = getInfoCloseBtn();

  infoIcon.onclick = () => {
    infoCard.classList.remove("hide");
  };

  infoCloseBtn.onclick = () => {
    infoCard.classList.add("hide");
  };
};

const displayPlayerProfile = gameStatus => {
  displayAndSetupAccountTiles(gameStatus);
};

const animateTile = (position, transitionType, duration = 1000) => {
  const board = getBoard();
  const tileId = position.x * 12 + position.y;
  const tile = board[tileId];

  tile.classList.add(transitionType);
  setTimeout(() => tile.classList.remove(transitionType), duration);
};

const renderBoard = ({ placedTiles, state }) => {
  placedTiles.forEach(({ position, belongsTo }) =>
    fillSpace(position, belongsTo)
  );

  const newTilePlaced = placedTiles.at(-1);
  animateTile(newTilePlaced.position, "new-tile");
};

const isSamePlayer = (self, currentPlayer) =>
  self.username === currentPlayer.username;

const setupCorporationSelection = ({ players, corporations, state }) => {
  const self = players.find(({ you }) => you);
  const currentPlayer = players.find(({ isTakingTurn }) => isTakingTurn);
  const isInCorrectState = state === "establish-corporation";
  const corporationsContainer = getCorporations();

  if (!(isSamePlayer(self, currentPlayer) && isInCorrectState)) {
    corporationsContainer.classList.remove("selectable");
    [...document.querySelectorAll(".corporation")].forEach(corp =>
      corp.classList.add("non-selectable")
    );
    return;
  }

  corporationsContainer.classList.add("selectable");

  Object.entries(corporations)
    .filter(([, corp]) => !corp.isActive)
    .map(([name]) => {
      const corp = getCorporation(name);

      corp.onclick = () => {
        establishCorporation({ name });
        corporationsContainer.classList.remove("selectable");
      };
      return corp;
    })
    .forEach(corp => corp.classList.remove("non-selectable"));
};

const notifyGameEnd = () => {
  const activityConsole = document.querySelector("#activity-console");
  const gameEndElement = generateComponent([
    "div",
    [
      ["p", "Game Over"],
      ["button", "Stats", { onclick: "getGameResult()" }],
    ],
    { class: "game-over flex" },
  ]);

  getGameResult();
  activityConsole.innerHTML = "";
  activityConsole.append(gameEndElement);
};

const renderGame = () => {
  fetch("/game/status")
    .then(res => res.json())
    .then(gameStatus => {
      if (previousState === gameStatus.state && gameStatus.state !== "merge")
        return;

      if (gameStatus.state === "game-end") {
        notifyGameEnd();
        displayPlayerProfile(gameStatus);
        previousState = gameStatus.state;
        return;
      }

      displayPlayerProfile(gameStatus, previousState);
      renderBoard(gameStatus);
      // renderActivityMessage(gameStatus);
      // setUpPlayerTilePlacing(gameStatus);
      // startPurchase(gameStatus, getDisplayPanel());
      renderCorporations(gameStatus);
      previousState = gameStatus.state;
    });

  setupInfoCard();
};

const flash = (element, time = 500) => {
  element.classList.add("flash");
  setTimeout(() => {
    element.classList.remove("flash");
  }, time);
};

const renderTilePlaceView = (_, activityConsole) => {
  activityConsole.innerText = "Place a tile ...";
  getTileContainer().classList.remove("disable-click");
  getTileSection().classList.add("highlight-player-tile");
};

const renderEstablishCorporationView = ({ corporations }, activityConsole) => {
  activityConsole.innerText = "Select a corporation to establish...";
  const corporationsContainer = getCorporations();
  corporationsContainer.classList.add("selectable");

  Object.entries(corporations)
    .filter(([, corp]) => !corp.isActive)
    .map(([name]) => {
      const corp = getCorporation(name);

      corp.onclick = () => {
        establishCorporation({ name });
        corporationsContainer.classList.remove("selectable");
        [...corporationsContainer.children].forEach(c =>
          c.classList.add("non-selectable")
        );
      };
      return corp;
    })
    .forEach(corp => corp.classList.remove("non-selectable"));
};

const createStock = corp => {
  return ["div", "", { class: `stock ${corp}` }];
};

export const createCard = (label, body = "", type = "pending") => {
  return generateComponent([
    "div",
    [
      ["div", label, { class: "label" }],
      ["div", body, { class: "body" }],
    ],
    { class: `card ${type}` },
  ]);
};

const createCorpIcon = corp => {
  return ["div", "", { class: `corp-icon ${corp}` }];
};

const createDealIcon = (type, quantity) => {
  return [
    "div",
    [
      ["div", "", { class: `${type}-icon` }],
      ["div", quantity],
    ],
    { class: `${type}-defunct-box` },
  ];
};

const createBonusTable = ({ majority, minority }) => {
  const bonusTable = generateComponent([
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
    { class: "flex bonus-table" },
  ]);

  return bonusTable;
};

const PENDING_CARD_GENERATORS = {
  [ACTIVITIES.tilePlace]: () => {
    return createCard("TILE");
  },

  [ACTIVITIES.establish]: () => {
    return createCard("FOUNDED");
  },

  [ACTIVITIES.buyStocks]: () => {
    return createCard("PURCHASED");
  },

  [ACTIVITIES.merge]: ({ acquirer, defunct }) => {
    return createCard("MERGING");

    // return createCard("MERGING", `${acquirer} >> ${defunct}`);
  },

  // [ACTIVITIES.mergeConflict]: equalCorporations => {
  //   return createCard("MERGING", `${acquirer} = ${defunct}`);
  // },
};

const createMergerTieCard = (corporations, label) => {
  const corpIcons = corporations.map(corpName => createCorpIcon(corpName));

  const mergingCard = createCard(
    label,
    [["div", corpIcons, { class: "merger" }]],
    "done"
  );

  if (corpIcons.length > 2) {
    mergingCard.classList.add("extra-width-card");
  }

  return mergingCard;
};

const CARD_GENERATORS = {
  [ACTIVITIES.tilePlace]: tile => {
    return createCard(
      "placed",
      [["div", getTile(tile.position), { class: "tile" }]],
      "done"
    );
  },

  [ACTIVITIES.establish]: corporation => {
    return createCard("founded", [createCorpIcon(corporation.name)], "done");
  },

  [ACTIVITIES.buyStocks]: stocks => {
    return createCard(
      "purchased",
      [["div", stocks.map(createStock), { class: "stocks-purchased" }]],
      "done"
    );
  },

  [ACTIVITIES.acquirerSelection]: potentialAcquirers =>
    createMergerTieCard(potentialAcquirers, "acquirer tie"),

  [ACTIVITIES.defunctSelection]: potentialDefunct =>
    createMergerTieCard(potentialDefunct, "defunct tie"),

  [ACTIVITIES.merge]: ({ acquirer, defunct, majority, minority, turns }) => {
    const mergeDiv = generateComponent(["div", "", { class: "flex" }]);
    const mergingCard = createCard(
      "merging",
      [
        [
          "div",
          [createCorpIcon(acquirer), ["p", ">>"], createCorpIcon(defunct)],
          { class: "merger" },
        ],
      ],
      "done"
    );
    const bonusesCard = createBonusTable({ majority, minority });
    const turnCards = turns.map(({ player, sell, trade }) =>
      createCard(
        `${player}'s deal`,
        [createDealIcon("sell", sell), createDealIcon("trade", trade)],
        "done player-deal"
      )
    );

    mergeDiv.append(mergingCard, bonusesCard, ...turnCards);
    return mergeDiv;
  },

  [ACTIVITIES.mergeConflict]: equalCorporations => {
    const mergeDiv = generateComponent(["div", "", { class: "flex" }]);
    const mergingCard = createCard(
      "merge conflict",
      [
        [
          "div",
          [
            createCorpIcon(equalCorporations[0]),
            ["p", "="],
            createCorpIcon(equalCorporations[1]),
          ],
          { class: "merger" },
        ],
      ],
      "done"
    );

    return mergingCard;
  },
};

const ACTIVE_VIEW_RENDERERS = {
  [ACTIVITIES.tilePlace]: renderTilePlaceView,
  [ACTIVITIES.buyStocks]: startPurchase,
  [ACTIVITIES.establish]: renderEstablishCorporationView,
  [ACTIVITIES.merge]: renderMerge,
  [ACTIVITIES.mergeConflict]: resolveMergeConflict,
  [ACTIVITIES.acquirerSelection]: selectAcquirer,
  [ACTIVITIES.defunctSelection]: selectDefunct,
};

const createComponents = gameStatus => {
  const { players, portfolio } = gameStatus;
  const balanceContainer = getBalanceContainer();
  const amountElement = balanceContainer.querySelector(".amount");
  const stockElements = getStockElements();
  const playerElements = getPlayerElements();
  const flashBalance = () => flash(balanceContainer);
  const flashStock = corp => flash(stockElements[corp].card);

  const displayPanelElement = getDisplayPanelElement();
  const renderers = ACTIVE_VIEW_RENDERERS;
  const cardGenerators = {
    done: CARD_GENERATORS,
    pending: PENDING_CARD_GENERATORS,
  };

  return {
    balance: new Balance(amountElement, flashBalance, portfolio.balance),
    stocks: new Stocks(stockElements, flashStock, portfolio.stocks),
    players: new Players(playerElements, players),
    displayPanel: new DisplayPanel(
      displayPanelElement,
      gameStatus,
      renderers,
      cardGenerators
    ),
  };
};

const setupGame = () => {
  setupInfoCard();
  const gameGateway = new GameGateway("/game");

  return gameGateway.getStatus().then(gameStatus => {
    displayPlayerProfile(gameStatus);
    renderBoard(gameStatus);
    // displayInitialMessages(gameStatus);
    renderCorporations(gameStatus);
    setupCorporationSelection(gameStatus);

    const components = createComponents(gameStatus);
    const gameService = new GameService(gameGateway, components);

    return gameService;
  });
};

const keepPlayerProfileUpdated = () => {
  const interval = 1000;

  setupGame().then(gameService => {
    setTimeout(() => {
      setInterval(() => {
        renderGame();
        gameService.render();
      }, interval);
    }, interval * 1);
  });

  setupHistory();
};

window.onload = keepPlayerProfileUpdated;
