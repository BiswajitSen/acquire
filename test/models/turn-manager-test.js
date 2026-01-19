const assert = require("assert");
const { describe, it } = require("node:test");
const { TurnManager, ACTIVITIES } = require("../../src/models/turn-manager");

describe("TurnManager", () => {
  describe("constructor", () => {
    it("should initialize with empty current turn", () => {
      const manager = new TurnManager();
      const turns = manager.getTurns();
      
      assert.deepStrictEqual(turns.currentTurn, { activities: [] });
    });

    it("should initialize with null previous turn", () => {
      const manager = new TurnManager();
      const turns = manager.getTurns();
      
      assert.strictEqual(turns.previousTurn, null);
    });
  });

  describe("getTurns", () => {
    it("should return current and previous turns", () => {
      const manager = new TurnManager();
      
      const turns = manager.getTurns();
      
      assert.ok("currentTurn" in turns);
      assert.ok("previousTurn" in turns);
    });

    it("should return copies of turn objects", () => {
      const manager = new TurnManager();
      
      const turns1 = manager.getTurns();
      const turns2 = manager.getTurns();
      
      assert.notStrictEqual(turns1.currentTurn, turns2.currentTurn);
    });
  });

  describe("changeTurn", () => {
    it("should move current turn to previous", () => {
      const manager = new TurnManager();
      manager.initiateActivity(ACTIVITIES.tilePlace);
      
      manager.changeTurn();
      
      const turns = manager.getTurns();
      assert.ok(turns.previousTurn);
      assert.strictEqual(turns.previousTurn.activities.length, 1);
    });

    it("should create new empty current turn", () => {
      const manager = new TurnManager();
      manager.initiateActivity(ACTIVITIES.tilePlace);
      
      manager.changeTurn();
      
      const turns = manager.getTurns();
      assert.deepStrictEqual(turns.currentTurn, { activities: [] });
    });

    it("should preserve previous turn data", () => {
      const manager = new TurnManager();
      manager.initiateActivity(ACTIVITIES.tilePlace);
      manager.consolidateActivity({ x: 1, y: 2 });
      
      manager.changeTurn();
      
      const turns = manager.getTurns();
      assert.deepStrictEqual(turns.previousTurn.activities[0], {
        id: ACTIVITIES.tilePlace,
        data: { x: 1, y: 2 },
      });
    });

    it("should replace previous turn on subsequent changes", () => {
      const manager = new TurnManager();

      manager.initiateActivity(ACTIVITIES.tilePlace);
      manager.changeTurn();

      manager.initiateActivity(ACTIVITIES.buyStocks);
      manager.changeTurn();

      const turns = manager.getTurns();
      assert.strictEqual(turns.previousTurn.activities[0].id, ACTIVITIES.buyStocks);
    });
  });

  describe("initiateActivity", () => {
    it("should add activity to current turn", () => {
      const manager = new TurnManager();
      
      manager.initiateActivity(ACTIVITIES.tilePlace);
      
      const turns = manager.getTurns();
      assert.strictEqual(turns.currentTurn.activities.length, 1);
      assert.strictEqual(turns.currentTurn.activities[0].id, ACTIVITIES.tilePlace);
    });

    it("should add multiple activities", () => {
      const manager = new TurnManager();
      
      manager.initiateActivity(ACTIVITIES.tilePlace);
      manager.initiateActivity(ACTIVITIES.establish);
      manager.initiateActivity(ACTIVITIES.buyStocks);
      
      const turns = manager.getTurns();
      assert.strictEqual(turns.currentTurn.activities.length, 3);
    });

    it("should create activity without data", () => {
      const manager = new TurnManager();
      
      manager.initiateActivity(ACTIVITIES.merge);
      
      const turns = manager.getTurns();
      assert.strictEqual(turns.currentTurn.activities[0].data, undefined);
    });
  });

  describe("consolidateActivity", () => {
    it("should add data to the current activity", () => {
      const manager = new TurnManager();
      manager.initiateActivity(ACTIVITIES.tilePlace);
      
      manager.consolidateActivity({ position: { x: 3, y: 4 } });
      
      const turns = manager.getTurns();
      assert.deepStrictEqual(turns.currentTurn.activities[0].data, {
        position: { x: 3, y: 4 },
      });
    });

    it("should update the most recent activity", () => {
      const manager = new TurnManager();
      manager.initiateActivity(ACTIVITIES.tilePlace);
      manager.consolidateActivity({ tile: "1A" });
      manager.initiateActivity(ACTIVITIES.establish);
      
      manager.consolidateActivity({ corp: "phoenix" });
      
      const turns = manager.getTurns();
      const activities = turns.currentTurn.activities;
      assert.deepStrictEqual(activities[0].data, { tile: "1A" });
      assert.deepStrictEqual(activities[1].data, { corp: "phoenix" });
    });

    it("should handle complex data objects", () => {
      const manager = new TurnManager();
      manager.initiateActivity(ACTIVITIES.merge);
      
      const mergeData = {
        acquirer: "phoenix",
        defunct: "quantum",
        turns: [{ player: "test", sell: 3, trade: 2 }],
      };
      manager.consolidateActivity(mergeData);
      
      const turns = manager.getTurns();
      assert.deepStrictEqual(turns.currentTurn.activities[0].data, mergeData);
    });
  });

  describe("ACTIVITIES constants", () => {
    it("should define all activity types", () => {
      assert.strictEqual(ACTIVITIES.tilePlace, "tile-place");
      assert.strictEqual(ACTIVITIES.establish, "establish");
      assert.strictEqual(ACTIVITIES.buyStocks, "buy-stocks");
      assert.strictEqual(ACTIVITIES.deal, "deal");
      assert.strictEqual(ACTIVITIES.merge, "merge");
      assert.strictEqual(ACTIVITIES.mergeConflict, "merge-conflict");
      assert.strictEqual(ACTIVITIES.acquirerSelection, "acquirer-selection");
      assert.strictEqual(ACTIVITIES.defunctSelection, "defunct-selection");
    });
  });

  describe("typical turn flow", () => {
    it("should track a complete turn with tile placement and purchase", () => {
      const manager = new TurnManager();

      manager.initiateActivity(ACTIVITIES.tilePlace);
      manager.consolidateActivity({
        position: { x: 2, y: 3 },
        belongsTo: "incorporated",
      });

      manager.initiateActivity(ACTIVITIES.buyStocks);
      manager.consolidateActivity({
        purchases: ["phoenix", "phoenix", "quantum"],
      });
      
      const turns = manager.getTurns();
      assert.strictEqual(turns.currentTurn.activities.length, 2);
      assert.strictEqual(turns.currentTurn.activities[0].id, ACTIVITIES.tilePlace);
      assert.strictEqual(turns.currentTurn.activities[1].id, ACTIVITIES.buyStocks);
    });

    it("should track turn with corporation establishment", () => {
      const manager = new TurnManager();
      
      manager.initiateActivity(ACTIVITIES.tilePlace);
      manager.consolidateActivity({ position: { x: 0, y: 0 } });
      
      manager.initiateActivity(ACTIVITIES.establish);
      manager.consolidateActivity({ name: "phoenix" });
      
      manager.initiateActivity(ACTIVITIES.buyStocks);
      manager.consolidateActivity({ purchases: [] });
      
      const turns = manager.getTurns();
      const activities = turns.currentTurn.activities;
      
      assert.strictEqual(activities.length, 3);
      assert.strictEqual(activities[1].id, ACTIVITIES.establish);
      assert.strictEqual(activities[1].data.name, "phoenix");
    });
  });
});
