import { createCard } from "/scripts/game.js";

const determineDefunctCorp = (acquirer, defunct) => {
  fetch("/game/merger/resolve-conflict", {
    method: "POST",
    body: JSON.stringify({ acquirer, defunct }),
    headers: {
      "content-type": "application/json",
    },
  });
};

const createCorpIcon = corp => {
  return ["div", "", { class: `corp-icon ${corp} conflict` }];
};

export const resolveMergeConflict = ({ turns }, activityConsole) => {
  const lastActivity = turns.currentTurn.activities.at(-1);
  const [mergingCorp1, mergingCorp2] = lastActivity.data;
  const cardContainer = generateComponent(["div", "", { class: "flex" }]);

  const selectionMsg = generateComponent(["p", "Select acquirer"]);
  const corp1 = createCard(
    `${mergingCorp1}`,
    [["div", [createCorpIcon(mergingCorp1)], { class: "merger" }]],
    "done"
  );

  const corp2 = createCard(
    `${mergingCorp2}`,
    [["div", [createCorpIcon(mergingCorp2)], { class: "merger" }]],
    "done"
  );

  corp1.onclick = () => determineDefunctCorp(mergingCorp1, mergingCorp2);
  corp2.onclick = () => determineDefunctCorp(mergingCorp2, mergingCorp1);
  corp1.classList.add("scale-mouse-pointer");
  corp2.classList.add("scale-mouse-pointer");

  cardContainer.append(corp1, corp2);

  const container = generateComponent([
    "div",
    "",
    { class: "select-container" },
  ]);
  container.append(selectionMsg, cardContainer);

  activityConsole.innerHTML = "";
  activityConsole.append(container);
};
