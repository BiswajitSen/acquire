const assert = require("assert");
const { describe, it } = require("node:test");
const { StockMarket } = require("../../src/models/stock-market");
const { createPlayers } = require("../../src/models/player");
const { createCorporations } = require("../../src/models/corporation");

describe("StockMarket", () => {
  const createTestMarket = (playerCount = 2) => {
    const players = createPlayers(
      Array.from({ length: playerCount }, (_, i) => ({ username: `player${i + 1}` }))
    );
    const corporations = createCorporations();
    const market = new StockMarket(corporations, players);

    players.forEach(p => p.addIncome(6000));

    return { market, players, corporations };
  };

  describe("buyStock", () => {
    it("should buy stock from an active corporation", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];

      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      
      const result = market.buyStock(player, "phoenix");
      
      assert.ok(result);
      assert.strictEqual(player.portfolio().stocks.phoenix, 1);
      assert.strictEqual(corporations.phoenix.stocks, 24);
    });

    it("should not buy from inactive corporation", () => {
      const { market, players } = createTestMarket();
      const player = players[0];
      
      const result = market.buyStock(player, "phoenix");
      
      assert.ok(!result);
      assert.strictEqual(player.portfolio().stocks.phoenix, 0);
    });

    it("should not buy when no stocks available", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      for (let i = 0; i < 25; i++) {
        corporations.phoenix.decrementStocks(1);
      }
      
      const result = market.buyStock(player, "phoenix");
      
      assert.ok(!result);
    });

    it("should not buy when player has insufficient funds", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      player.addExpense(6000);

      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      
      const result = market.buyStock(player, "phoenix");
      
      assert.ok(!result);
    });

    it("should deduct correct price from player balance", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      const initialBalance = player.portfolio().balance;
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      const { price } = corporations.phoenix.stats();
      
      market.buyStock(player, "phoenix");
      
      assert.strictEqual(player.portfolio().balance, initialBalance - price);
    });
  });

  describe("buyStocks", () => {
    it("should buy multiple stocks", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      
      const purchased = market.buyStocks(player, [
        { name: "phoenix" },
        { name: "phoenix" },
      ]);
      
      assert.strictEqual(purchased.length, 2);
      assert.strictEqual(player.portfolio().stocks.phoenix, 2);
    });

    it("should return only successfully purchased stocks", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);

      const purchased = market.buyStocks(player, [
        { name: "phoenix" },
        { name: "quantum" },
      ]);
      
      assert.strictEqual(purchased.length, 1);
      assert.deepStrictEqual(purchased, ["phoenix"]);
    });
  });

  describe("sellStock", () => {
    it("should sell stocks back to corporation", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      player.addStocks("phoenix", 5);
      corporations.phoenix.decrementStocks(5);
      const initialBalance = player.portfolio().balance;
      const { price } = corporations.phoenix.stats();
      
      const result = market.sellStock(player, "phoenix", 3);
      
      assert.ok(result);
      assert.strictEqual(player.portfolio().stocks.phoenix, 2);
      assert.strictEqual(player.portfolio().balance, initialBalance + 3 * price);
      assert.strictEqual(corporations.phoenix.stocks, 23);
    });

    it("should not sell more stocks than owned", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      player.addStocks("phoenix", 2);
      
      const result = market.sellStock(player, "phoenix", 5);
      
      assert.ok(!result);
      assert.strictEqual(player.portfolio().stocks.phoenix, 2);
    });
  });

  describe("tradeStocks", () => {
    it("should trade defunct stocks for acquirer stocks at 2:1", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(5);
      corporations.quantum.establish();
      corporations.quantum.increaseSize(2);
      
      player.addStocks("quantum", 4);
      corporations.quantum.decrementStocks(4);
      
      const result = market.tradeStocks(player, "quantum", "phoenix", 4);
      
      assert.ok(result);
      assert.strictEqual(player.portfolio().stocks.quantum, 0);
      assert.strictEqual(player.portfolio().stocks.phoenix, 2);
      assert.strictEqual(corporations.quantum.stocks, 25);
      assert.strictEqual(corporations.phoenix.stocks, 23);
    });

    it("should not trade more than owned", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.quantum.establish();
      player.addStocks("quantum", 2);
      
      const result = market.tradeStocks(player, "quantum", "phoenix", 4);
      
      assert.ok(!result);
    });

    it("should not trade when acquirer has no stocks", () => {
      const { market, players, corporations } = createTestMarket();
      const player = players[0];
      
      corporations.phoenix.establish();
      corporations.quantum.establish();
      player.addStocks("quantum", 4);

      for (let i = 0; i < 25; i++) {
        corporations.phoenix.decrementStocks(1);
      }
      
      const result = market.tradeStocks(player, "quantum", "phoenix", 4);
      
      assert.ok(!result);
    });
  });

  describe("findShareholderGroups", () => {
    it("should find majority and minority shareholders", () => {
      const players = createPlayers([
        { username: "player1" },
        { username: "player2" },
        { username: "player3" },
      ]);
      players.forEach(p => p.addIncome(6000));
      players[0].addStocks("phoenix", 5);
      players[1].addStocks("phoenix", 3);
      players[2].addStocks("phoenix", 1);
      
      const corporations = createCorporations();
      const market = new StockMarket(corporations, players);
      
      const { majority, minority } = market.findShareholderGroups("phoenix");
      
      assert.strictEqual(majority.stock, 5);
      assert.deepStrictEqual(majority.playerNames, ["player1"]);
      assert.strictEqual(minority.stock, 3);
      assert.deepStrictEqual(minority.playerNames, ["player2"]);
    });

    it("should handle tied majority", () => {
      const players = createPlayers([
        { username: "player1" },
        { username: "player2" },
      ]);
      players.forEach(p => p.addIncome(6000));
      players[0].addStocks("phoenix", 5);
      players[1].addStocks("phoenix", 5);
      
      const corporations = createCorporations();
      const market = new StockMarket(corporations, players);
      
      const { majority } = market.findShareholderGroups("phoenix");
      
      assert.strictEqual(majority.stock, 5);
      assert.strictEqual(majority.playerNames.length, 2);
    });

    it("should handle no shareholders", () => {
      const { market } = createTestMarket();
      
      const { majority, minority } = market.findShareholderGroups("phoenix");
      
      assert.strictEqual(majority.stock, 0);
      assert.deepStrictEqual(majority.playerNames, []);
      assert.strictEqual(minority.stock, 0);
    });
  });

  describe("distributeBonuses", () => {
    it("should distribute majority and minority bonuses", () => {
      const players = createPlayers([
        { username: "player1" },
        { username: "player2" },
      ]);
      players.forEach(p => p.addIncome(0));
      players[0].addStocks("phoenix", 5);
      players[1].addStocks("phoenix", 3);
      
      const corporations = createCorporations();
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      const { majorityPrice, minorityPrice } = corporations.phoenix.stats();
      
      const market = new StockMarket(corporations, players);
      
      market.distributeBonuses("phoenix");
      
      assert.strictEqual(players[0].portfolio().balance, majorityPrice);
      assert.strictEqual(players[1].portfolio().balance, minorityPrice);
    });

    it("should split bonus among tied majority holders", () => {
      const players = createPlayers([
        { username: "player1" },
        { username: "player2" },
      ]);
      players.forEach(p => p.addIncome(0));
      players[0].addStocks("phoenix", 5);
      players[1].addStocks("phoenix", 5);
      
      const corporations = createCorporations();
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      const { majorityPrice, minorityPrice } = corporations.phoenix.stats();
      const expectedShare = Math.floor((majorityPrice + minorityPrice) / 2);
      
      const market = new StockMarket(corporations, players);
      
      market.distributeBonuses("phoenix");
      
      assert.strictEqual(players[0].portfolio().balance, expectedShare);
      assert.strictEqual(players[1].portfolio().balance, expectedShare);
    });

    it("should return stats about distribution", () => {
      const players = createPlayers([{ username: "player1" }]);
      players[0].addStocks("phoenix", 5);
      
      const corporations = createCorporations();
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      
      const market = new StockMarket(corporations, players);
      
      const stats = market.distributeBonuses("phoenix");
      
      assert.strictEqual(stats.corporation, "phoenix");
      assert.ok(stats.majority);
      assert.ok(stats.minority);
    });
  });

  describe("liquidateCorporation", () => {
    it("should sell all player stocks at current price", () => {
      const { market, players, corporations } = createTestMarket();
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(5);
      const { price } = corporations.phoenix.stats();
      
      players[0].addStocks("phoenix", 3);
      players[1].addStocks("phoenix", 2);
      corporations.phoenix.decrementStocks(5);
      
      const balance0Before = players[0].portfolio().balance;
      const balance1Before = players[1].portfolio().balance;
      
      market.liquidateCorporation("phoenix");
      
      assert.strictEqual(players[0].portfolio().stocks.phoenix, 0);
      assert.strictEqual(players[1].portfolio().stocks.phoenix, 0);
      assert.strictEqual(players[0].portfolio().balance, balance0Before + 3 * price);
      assert.strictEqual(players[1].portfolio().balance, balance1Before + 2 * price);
      assert.strictEqual(corporations.phoenix.stocks, 25);
    });
  });

  describe("getPurchasableCorps", () => {
    it("should return active corporations player can afford", () => {
      const { market, corporations } = createTestMarket();
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      corporations.quantum.establish();
      corporations.quantum.increaseSize(2);

      const { price } = corporations.phoenix.stats();
      
      const purchasable = market.getPurchasableCorps(price + 100);
      
      assert.ok(purchasable.includes("phoenix"));
      assert.ok(purchasable.includes("quantum"));
      assert.ok(!purchasable.includes("hydra"));
    });

    it("should exclude corporations with no stocks", () => {
      const { market, corporations } = createTestMarket();
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);

      for (let i = 0; i < 25; i++) {
        corporations.phoenix.decrementStocks(1);
      }
      
      const purchasable = market.getPurchasableCorps(10000);
      
      assert.ok(!purchasable.includes("phoenix"));
    });

    it("should exclude corporations player cannot afford", () => {
      const { market, corporations } = createTestMarket();
      
      corporations.phoenix.establish();
      corporations.phoenix.increaseSize(2);
      
      const purchasable = market.getPurchasableCorps(0);
      
      assert.strictEqual(purchasable.length, 0);
    });
  });
});
