const assert = require("assert");
const { describe, it } = require("node:test");
const { GameStateManager, GAME_STATES, STATE_TRANSITIONS } = require("../../src/models/game-state");

describe("GameStateManager", () => {
  describe("constructor", () => {
    it("should initialize with SETUP state by default", () => {
      const manager = new GameStateManager();
      
      assert.strictEqual(manager.state, GAME_STATES.SETUP);
    });

    it("should initialize with custom state", () => {
      const manager = new GameStateManager(GAME_STATES.PLACE_TILE);
      
      assert.strictEqual(manager.state, GAME_STATES.PLACE_TILE);
    });

    it("should start with empty state info", () => {
      const manager = new GameStateManager();
      
      assert.deepStrictEqual(manager.info, {});
    });

    it("should initialize state history", () => {
      const manager = new GameStateManager();
      
      assert.strictEqual(manager.history.length, 1);
      assert.strictEqual(manager.history[0].state, GAME_STATES.SETUP);
    });
  });

  describe("transitionTo", () => {
    it("should transition to a valid state", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      manager.transitionTo(GAME_STATES.PLACE_TILE);
      
      assert.strictEqual(manager.state, GAME_STATES.PLACE_TILE);
    });

    it("should throw error for invalid transition", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      assert.throws(() => {
        manager.transitionTo(GAME_STATES.GAME_END);
      }, /Invalid state transition/);
    });

    it("should set state info on transition", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      manager.transitionTo(GAME_STATES.PLACE_TILE, { player: "test" });
      
      assert.deepStrictEqual(manager.info, { player: "test" });
    });

    it("should add to state history", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      manager.transitionTo(GAME_STATES.PLACE_TILE);
      
      assert.strictEqual(manager.history.length, 2);
      assert.strictEqual(manager.history[1].state, GAME_STATES.PLACE_TILE);
    });

    it("should return self for chaining", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      const result = manager.transitionTo(GAME_STATES.PLACE_TILE);
      
      assert.strictEqual(result, manager);
    });
  });

  describe("forceTransition", () => {
    it("should transition regardless of validity", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      manager.forceTransition(GAME_STATES.GAME_END);
      
      assert.strictEqual(manager.state, GAME_STATES.GAME_END);
    });

    it("should set state info", () => {
      const manager = new GameStateManager();
      
      manager.forceTransition(GAME_STATES.MERGE, { acquirer: "phoenix" });
      
      assert.deepStrictEqual(manager.info, { acquirer: "phoenix" });
    });

    it("should return self for chaining", () => {
      const manager = new GameStateManager();
      
      const result = manager.forceTransition(GAME_STATES.PLACE_TILE);
      
      assert.strictEqual(result, manager);
    });
  });

  describe("canTransitionTo", () => {
    it("should return true for valid transitions", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      assert.ok(manager.canTransitionTo(GAME_STATES.PLACE_TILE));
    });

    it("should return false for invalid transitions", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      assert.ok(!manager.canTransitionTo(GAME_STATES.GAME_END));
      assert.ok(!manager.canTransitionTo(GAME_STATES.MERGE));
    });

    it("should handle all defined transitions", () => {
      const manager = new GameStateManager(GAME_STATES.PLACE_TILE);
      
      assert.ok(manager.canTransitionTo(GAME_STATES.TILE_PLACED));
      assert.ok(manager.canTransitionTo(GAME_STATES.ESTABLISH_CORPORATION));
      assert.ok(manager.canTransitionTo(GAME_STATES.BUY_STOCKS));
      assert.ok(manager.canTransitionTo(GAME_STATES.MERGE));
    });
  });

  describe("setInfo", () => {
    it("should set state info", () => {
      const manager = new GameStateManager();
      
      manager.setInfo({ key: "value" });
      
      assert.deepStrictEqual(manager.info, { key: "value" });
    });

    it("should merge with existing info", () => {
      const manager = new GameStateManager();
      manager.setInfo({ key1: "value1" });
      
      manager.setInfo({ key2: "value2" });
      
      assert.deepStrictEqual(manager.info, { key1: "value1", key2: "value2" });
    });

    it("should override existing keys", () => {
      const manager = new GameStateManager();
      manager.setInfo({ key: "old" });
      
      manager.setInfo({ key: "new" });
      
      assert.deepStrictEqual(manager.info, { key: "new" });
    });
  });

  describe("clearInfo", () => {
    it("should clear all state info", () => {
      const manager = new GameStateManager();
      manager.setInfo({ key: "value" });
      
      manager.clearInfo();
      
      assert.deepStrictEqual(manager.info, {});
    });
  });

  describe("isIn", () => {
    it("should return true when in specified state", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      assert.ok(manager.isIn(GAME_STATES.SETUP));
    });

    it("should return false when not in specified state", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      assert.ok(!manager.isIn(GAME_STATES.PLACE_TILE));
    });
  });

  describe("isInAny", () => {
    it("should return true when in one of specified states", () => {
      const manager = new GameStateManager(GAME_STATES.MERGE);
      
      assert.ok(manager.isInAny(GAME_STATES.MERGE, GAME_STATES.BUY_STOCKS));
    });

    it("should return false when not in any of specified states", () => {
      const manager = new GameStateManager(GAME_STATES.SETUP);
      
      assert.ok(!manager.isInAny(GAME_STATES.MERGE, GAME_STATES.BUY_STOCKS));
    });
  });

  describe("isGameOver", () => {
    it("should return true when game has ended", () => {
      const manager = new GameStateManager();
      manager.forceTransition(GAME_STATES.GAME_END);
      
      assert.ok(manager.isGameOver);
    });

    it("should return false when game is in progress", () => {
      const manager = new GameStateManager(GAME_STATES.PLACE_TILE);
      
      assert.ok(!manager.isGameOver);
    });
  });

  describe("isMerging", () => {
    it("should return true for MERGE state", () => {
      const manager = new GameStateManager();
      manager.forceTransition(GAME_STATES.MERGE);
      
      assert.ok(manager.isMerging);
    });

    it("should return true for MERGE_CONFLICT state", () => {
      const manager = new GameStateManager();
      manager.forceTransition(GAME_STATES.MERGE_CONFLICT);
      
      assert.ok(manager.isMerging);
    });

    it("should return true for ACQUIRER_SELECTION state", () => {
      const manager = new GameStateManager();
      manager.forceTransition(GAME_STATES.ACQUIRER_SELECTION);
      
      assert.ok(manager.isMerging);
    });

    it("should return true for DEFUNCT_SELECTION state", () => {
      const manager = new GameStateManager();
      manager.forceTransition(GAME_STATES.DEFUNCT_SELECTION);
      
      assert.ok(manager.isMerging);
    });

    it("should return false for non-merge states", () => {
      const manager = new GameStateManager(GAME_STATES.PLACE_TILE);
      
      assert.ok(!manager.isMerging);
    });
  });

  describe("toJSON", () => {
    it("should serialize state", () => {
      const manager = new GameStateManager();
      manager.forceTransition(GAME_STATES.MERGE, { acquirer: "phoenix" });
      
      const json = manager.toJSON();
      
      assert.deepStrictEqual(json, {
        currentState: GAME_STATES.MERGE,
        stateInfo: { acquirer: "phoenix" },
      });
    });
  });

  describe("fromJSON", () => {
    it("should restore from serialized state", () => {
      const json = {
        currentState: GAME_STATES.BUY_STOCKS,
        stateInfo: { player: "test" },
      };
      
      const manager = GameStateManager.fromJSON(json);
      
      assert.strictEqual(manager.state, GAME_STATES.BUY_STOCKS);
      assert.deepStrictEqual(manager.info, { player: "test" });
    });

    it("should handle missing stateInfo", () => {
      const json = { currentState: GAME_STATES.SETUP };
      
      const manager = GameStateManager.fromJSON(json);
      
      assert.deepStrictEqual(manager.info, {});
    });
  });

  describe("STATE_TRANSITIONS", () => {
    it("should define transitions for all states", () => {
      const allStates = Object.values(GAME_STATES);
      
      allStates.forEach(state => {
        assert.ok(
          STATE_TRANSITIONS[state] !== undefined,
          `Missing transitions for state: ${state}`
        );
      });
    });

    it("should have GAME_END as terminal state", () => {
      assert.deepStrictEqual(STATE_TRANSITIONS[GAME_STATES.GAME_END], []);
    });
  });
});
