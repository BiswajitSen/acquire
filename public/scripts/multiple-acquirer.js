import { createCard } from "/scripts/game.js";

const confirmAcquirer = acquirer => {
  fetch("/game/merger/resolve-acquirer", {
    method: "POST",
    body: JSON.stringify({ acquirer }),
    headers: {
      "content-type": "application/json",
    },
  });
};

const createCorpIcon = corp => {
  return ["div", "", { class: `corp-icon ${corp} conflict` }];
};

export const selectAcquirer = ({ turns }, activityConsole) => {
  const lastActivity = turns.currentTurn.activities.at(-1);
  const potentialAcquirers = lastActivity.data;

  const cardContainer = generateComponent(["div", "", { class: "flex" }]);
  const selectionMsg = generateComponent(["p", "Select acquirer"]);

  const acquirerCards = potentialAcquirers.map(name => {
    const card = createCard(
      `${name}`,
      [["div", [createCorpIcon(name)], { class: "merger" }]],
      "done"
    );

    card.onclick = () => confirmAcquirer(name);
    card.classList.add("scale-mouse-pointer");
    return card;
  });

  cardContainer.append(...acquirerCards);

  const container = generateComponent([
    "div",
    "",
    { class: "select-container" },
  ]);
  container.append(selectionMsg, cardContainer);

  activityConsole.innerHTML = "";
  activityConsole.append(container);
};
