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
import { socketClient, EVENTS } from "/scripts/socket-client.js";
import { voiceChat } from "/scripts/voice-chat.js";

let previousState;

const getLobbyIdFromUrl = () => {
  const pathParts = window.location.pathname.split("/");
  return pathParts[2];
};

const getGameBaseUrl = () => `/game/${getLobbyIdFromUrl()}`;

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
  
  const mobileHistoryToggle = document.getElementById("mobile-history-toggle");
  const mobileHistoryPanel = document.getElementById("mobile-history-panel");
  const mobileHistoryClose = document.getElementById("mobile-history-close");
  
  if (mobileHistoryToggle && mobileHistoryPanel) {
    const toggleMobileHistory = () => {
      const isVisible = mobileHistoryPanel.classList.contains("visible");
      mobileHistoryPanel.classList.toggle("visible");
      mobileHistoryToggle.classList.toggle("active");
      
      if (!isVisible) {
        syncMobileHistoryCards();
      }
    };
    
    mobileHistoryToggle.onclick = toggleMobileHistory;
    
    if (mobileHistoryClose) {
      mobileHistoryClose.onclick = toggleMobileHistory;
    }
  }
};

const syncMobileHistoryCards = () => {
  const historyPane = getHistoryPane();
  const mobileHistoryCards = document.getElementById("mobile-history-cards");
  
  if (!historyPane || !mobileHistoryCards) return;
  
  mobileHistoryCards.innerHTML = "";
  
  Array.from(historyPane.children).forEach(card => {
    const clone = card.cloneNode(true);
    mobileHistoryCards.appendChild(clone);
  });
};

const getBalanceContainer = () => document.querySelector("#balance-container");

const getCorporations = () => document.querySelector("#corporations");

const establishCorporation = data => {
  fetch(`${getGameBaseUrl()}/establish`, {
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
  fetch(`${getGameBaseUrl()}/tile`, {
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

const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

let selectedTileElement = null;
let currentTiles = [];

const clearAllHighlights = () => {
  currentTiles.forEach(tile => {
    if (tile) removeHighlight(tile);
  });
  if (selectedTileElement) {
    selectedTileElement.classList.remove("tile-selected");
    selectedTileElement = null;
  }
};

const setupMobileTileTouch = (tileElement, tile) => {
  tileElement.addEventListener("touchstart", (e) => {
    if (tile.exchange === "yes") return;
    
    e.preventDefault();
    
    if (selectedTileElement === tileElement) {
      return;
    }
    
    clearAllHighlights();
    
    selectedTileElement = tileElement;
    tileElement.classList.add("tile-selected");
    highlightTile(tile);
  }, { passive: false });
};

const setUpHoverEventForTiles = tiles => {
  const tileContainer = getTileContainer();
  currentTiles = tiles;

  if (isMobile()) {
    document.addEventListener("touchstart", (e) => {
      const isOnTile = e.target.closest(".tile");
      const isOnBoard = e.target.closest("#game-board");
      if (!isOnTile && !isOnBoard) {
        clearAllHighlights();
      }
    });
  } else {
    tileContainer.onmouseover = () => {
      tiles.forEach(highlightTile);
    };

    tileContainer.onmouseleave = () => {
      tiles.forEach(removeHighlight);
    };
  }
};

const displayAndSetupAccountTiles = gameStatus => {
  const { tiles } = gameStatus.portfolio;
  const tileElements = getTileElements();
  const validTiles = tiles.filter(tile => tile);
  setUpHoverEventForTiles(validTiles);

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
    
    if (isMobile()) {
      setupMobileTileTouch(tileElement, tile);
    }
    
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

const syncMobileTiles = () => {
  const mobileTilesSection = document.getElementById("mobile-tiles");
  if (!mobileTilesSection) return;
  
  const tileContainer = getTileContainer();
  if (!tileContainer) return;
  
  mobileTilesSection.innerHTML = "";
  
  Array.from(tileContainer.children).forEach(tile => {
    const clone = tile.cloneNode(true);
    clone.onclick = tile.onclick;
    mobileTilesSection.appendChild(clone);
  });
};

const highlightPlayerTilesOnBoard = tiles => {
  const validTiles = tiles.filter(tile => tile && tile.exchange !== "yes");
  validTiles.forEach(tile => {
    const boardCell = getBoardTile(tile.position);
    boardCell.classList.add("player-tile-indicator");
  });
};

const clearPlayerTileIndicators = () => {
  const board = getBoard();
  board.forEach(cell => cell.classList.remove("player-tile-indicator"));
};

const displayPlayerProfile = gameStatus => {
  displayAndSetupAccountTiles(gameStatus);
  syncMobileTiles();
  
  if (isMobile()) {
    clearPlayerTileIndicators();
    highlightPlayerTilesOnBoard(gameStatus.portfolio.tiles);
  }
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
  const corporationSection = document.querySelector("#corporation-section");
  const mobileCorpBtn = document.querySelector('[data-panel="corporation"]');

  if (!(isSamePlayer(self, currentPlayer) && isInCorrectState)) {
    corporationsContainer.classList.remove("selectable");
    corporationSection.classList.remove("highlight-selection");
    if (mobileCorpBtn) mobileCorpBtn.classList.remove("attention-needed");
    [...document.querySelectorAll(".corporation")].forEach(corp =>
      corp.classList.add("non-selectable")
    );
    return;
  }

  corporationsContainer.classList.add("selectable");
  corporationSection.classList.add("highlight-selection");
  if (mobileCorpBtn) mobileCorpBtn.classList.add("attention-needed");

  Object.entries(corporations)
    .filter(([, corp]) => !corp.isActive)
    .map(([name]) => {
      const corp = getCorporation(name);

      corp.onclick = () => {
        establishCorporation({ name });
        corporationsContainer.classList.remove("selectable");
        corporationSection.classList.remove("highlight-selection");
        if (mobileCorpBtn) mobileCorpBtn.classList.remove("attention-needed");
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

const renderGame = (forceUpdate = false) => {
  fetch(`${getGameBaseUrl()}/status`)
    .then(res => res.json())
    .then(gameStatus => {
      if (!forceUpdate && previousState === gameStatus.state && gameStatus.state !== "merge")
        return;

      if (gameStatus.state === "game-end") {
        notifyGameEnd();
        displayPlayerProfile(gameStatus);
        previousState = gameStatus.state;
        return;
      }

      displayPlayerProfile(gameStatus, previousState);
      renderBoard(gameStatus);
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
  const card = createCard("PLACE TILE", [["div", "?", { class: "tile placeholder-tile" }]], "action");
  activityConsole.innerHTML = "";
  activityConsole.appendChild(card);
  getTileContainer().classList.remove("disable-click");
  getTileSection().classList.add("highlight-player-tile");
};

const renderEstablishCorporationView = ({ corporations }, activityConsole) => {
  activityConsole.innerText = "Select a corporation to establish...";
  const corporationsContainer = getCorporations();
  const corporationSection = document.querySelector("#corporation-section");
  const mobileCorpBtn = document.querySelector('[data-panel="corporation"]');
  
  corporationsContainer.classList.add("selectable");
  corporationSection.classList.add("highlight-selection");
  if (mobileCorpBtn) mobileCorpBtn.classList.add("attention-needed");

  Object.entries(corporations)
    .filter(([, corp]) => !corp.isActive)
    .map(([name]) => {
      const corp = getCorporation(name);

      corp.onclick = () => {
        establishCorporation({ name });
        corporationsContainer.classList.remove("selectable");
        corporationSection.classList.remove("highlight-selection");
        if (mobileCorpBtn) mobileCorpBtn.classList.remove("attention-needed");
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
    return createCard("PLACING", [["div", "...", { class: "tile waiting-tile" }]], "waiting");
  },

  [ACTIVITIES.establish]: () => {
    return createCard("FOUNDING", "", "waiting");
  },

  [ACTIVITIES.buyStocks]: () => {
    return createCard("BUYING", "", "waiting");
  },

  [ACTIVITIES.merge]: ({ acquirer, defunct }) => {
    return createCard("MERGING", "", "waiting");
  },
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
  const gameGateway = new GameGateway(getGameBaseUrl());

  return gameGateway.getStatus().then(gameStatus => {
    displayPlayerProfile(gameStatus);
    renderBoard(gameStatus);
    renderCorporations(gameStatus);
    setupCorporationSelection(gameStatus);

    const components = createComponents(gameStatus);
    const gameService = new GameService(gameGateway, components);

    return gameService;
  });
};

const setupSocketListeners = (gameService) => {
  const lobbyId = getLobbyIdFromUrl();
  
  socketClient.game.emit(EVENTS.JOIN_GAME, { lobbyId });
  
  socketClient.game.on(EVENTS.GAME_UPDATE, () => {
    renderGame(true);
    gameService.render();
  });
  
  socketClient.game.on(EVENTS.GAME_END, () => {
    notifyGameEnd();
  });

  socketClient.game.onReconnect(() => {
    socketClient.game.emit(EVENTS.JOIN_GAME, { lobbyId });
    renderGame(true);
    gameService.render();
  });
};

const setupMobileMicButton = () => {
  const mobileMicBtn = document.getElementById('mobile-voice-toggle');
  const mainVoiceToggle = document.getElementById('voice-toggle');
  
  if (mobileMicBtn) {
    mobileMicBtn.addEventListener('click', () => {
      voiceChat.toggleMic();
    });
    
    if (mainVoiceToggle) {
      const observer = new MutationObserver(() => {
        mobileMicBtn.classList.toggle('active', mainVoiceToggle.classList.contains('active'));
      });
      observer.observe(mainVoiceToggle, { attributes: true, attributeFilter: ['class'] });
    }
  }
};

const initializeGame = () => {
  setupGame().then(gameService => {
    setupSocketListeners(gameService);
    renderGame();
    gameService.render();
    voiceChat.joinVoiceRoom();
    setupMobileMicButton();
  });

  setupHistory();
};

window.onload = initializeGame;
