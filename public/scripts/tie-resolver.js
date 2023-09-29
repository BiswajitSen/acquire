import { createCard } from "/scripts/game.js";

const createCorpIcon = corp => {
  return ["div", "", { class: `corp-icon ${corp} conflict` }];
};

export const resolveTie = (turns, activityConsole, tieHeading, confirm) => {
  const lastActivity = turns.currentTurn.activities.at(-1);
  const potentialAcquirers = lastActivity.data;
  const cardContainer = generateComponent(["div", "", { class: "flex" }]);
  const selectionMsg = generateComponent(["p", tieHeading]);

  const acquirerCards = potentialAcquirers.map(name => {
    const card = createCard(
      `${name}`,
      [["div", [createCorpIcon(name)], { class: "merger" }]],
      "done"
    );

    card.onclick = () => confirm(name);
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
