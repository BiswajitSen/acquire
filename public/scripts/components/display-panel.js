export default class DisplayPanel {
  #displayPanelElement;
  #currentTurn;
  #previousTurn;
  #activeViewRenderers;
  #gameStatus;
  #cardGenerators;

  constructor(
    displayPanelElement,
    gameStatus,
    activeViewRenderers,
    cardGenerators
  ) {
    this.#displayPanelElement = displayPanelElement;
    this.#gameStatus = gameStatus;
    this.#currentTurn = gameStatus.turns.currentTurn;
    this.#previousTurn = gameStatus.turns.previousTurn;
    this.#activeViewRenderers = activeViewRenderers;
    this.#cardGenerators = cardGenerators;
    this.#render();
  }

  #renderActiveView() {
    const lastActivity = this.#currentTurn.activities.at(-1).id;
    const { activityConsole } = this.#displayPanelElement;
    const renderer = this.#activeViewRenderers[lastActivity];

    renderer(this.#gameStatus, activityConsole);
  }

  #renderCardView(activities, container) {
    const cards = activities.map(({ id, data }) => {
      const cardGenerator = data
        ? this.#cardGenerators.done[id]
        : this.#cardGenerators.pending[id];

      return cardGenerator(data);
    });

    container.innerHTML = "";
    container.append(...cards);
  }

  #renderPreviousActivities() {
    if (!this.#previousTurn) return;

    this.#renderCardView(
      this.#previousTurn.activities,
      this.#displayPanelElement.historyPane
    );
  }

  #renderCurrentActivities() {
    if (this.#currentTurn.player.you) return this.#renderActiveView();

    this.#renderCardView(
      this.#currentTurn.activities,
      this.#displayPanelElement.activityConsole
    );
  }

  #render() {
    this.#renderPreviousActivities();
    this.#renderCurrentActivities();
  }

  // eslint-disable-next-line complexity
  update(gameStatus) {
    const { currentTurn, previousTurn } = gameStatus.turns;
    const updatedCurrentPlayer = currentTurn.player.username;
    const currentPlayer = this.#currentTurn.player.username;
    const lastActivity = this.#currentTurn.activities.at(-1).id;
    const updatedLastActivity = currentTurn.activities.at(-1).id;

    const hasActivitiesUpdated = lastActivity !== updatedLastActivity;
    const hasTurnChanged = currentPlayer !== updatedCurrentPlayer;
    const isNextPlayerInMerger = lastActivity !== "merge" || !hasTurnChanged;

    // if activity not updated then return except activity is merge

    if (isNextPlayerInMerger && !hasActivitiesUpdated) return;

    this.#gameStatus = gameStatus;

    if (hasTurnChanged) {
      this.#currentTurn = currentTurn;
      this.#previousTurn = previousTurn;
      this.#render();
      return;
    }

    this.#currentTurn.activities = currentTurn.activities;
    this.#renderCurrentActivities();
  }
}
