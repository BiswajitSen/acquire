const assert = require("assert");
const { it, describe } = require("node:test");
const { Corporation } = require("../../src/models/corporation");
const { BASE_PRICES } = require("../../src/constants");

describe("Corporation", () => {
  describe("establish", () => {
    it("should mark a corporation as active", () => {
      const phoenix = new Corporation();

      assert.ok(!phoenix.isActive);
      phoenix.establish();
      assert.ok(phoenix.isActive);
    });
  });

  describe("stats", () => {
    it("should give status of a corporation based on the tiles", () => {
      const phoenix = new Corporation(BASE_PRICES.large);
      const stats = {
        stocks: 25,
        size: 0,
        price: 0,
        isActive: false,
        isSafe: false,
        majorityPrice: 0,
        minorityPrice: 0,
      };

      assert.deepStrictEqual(phoenix.stats(), stats);
    });

    it("price should be reasonable for tiles between 6-10", () => {
      const size = 7;
      const phoenix = new Corporation(BASE_PRICES.large, size);
      const stats = {
        size,
        stocks: 25,
        isActive: false,
        isSafe: false,
        price: 800,
        majorityPrice: 8000,
        minorityPrice: 4000,
      };

      assert.deepStrictEqual(phoenix.stats(), stats);
    });

    it("price should be reasonable for tiles between 11-20", () => {
      const size = 12;
      const phoenix = new Corporation(BASE_PRICES.large, size);
      const stats = {
        size,
        stocks: 25,
        isActive: false,
        isSafe: false,
        price: 900,
        majorityPrice: 9000,
        minorityPrice: 4500,
      };

      assert.deepStrictEqual(phoenix.stats(), stats);
    });

    it("price should be reasonable for tiles between 21-30", () => {
      const size = 28;
      const phoenix = new Corporation(BASE_PRICES.large, size);
      const stats = {
        size,
        stocks: 25,
        isActive: false,
        isSafe: false,
        price: 1000,
        majorityPrice: 10000,
        minorityPrice: 5000,
      };

      assert.deepStrictEqual(phoenix.stats(), stats);
    });

    it("price should be reasonable for tiles between 31-40", () => {
      const size = 33;
      const phoenix = new Corporation(BASE_PRICES.large, size);
      const stats = {
        size,
        stocks: 25,
        isActive: false,
        isSafe: false,
        price: 1100,
        majorityPrice: 11000,
        minorityPrice: 5500,
      };

      assert.deepStrictEqual(phoenix.stats(), stats);
    });

    it("price should be reasonable for tiles between 41+", () => {
      const size = 53;
      const phoenix = new Corporation(BASE_PRICES.large, size);
      const stats = {
        size,
        stocks: 25,
        isActive: false,
        isSafe: false,
        price: 1200,
        majorityPrice: 12000,
        minorityPrice: 6000,
      };

      assert.deepStrictEqual(phoenix.stats(), stats);
    });
  });

  describe("decrementStock", () => {
    it("should decrease the stocks quantity", () => {
      const phoenix = new Corporation();

      phoenix.establish();

      assert.strictEqual(phoenix.stocks, 25);
      phoenix.decrementStocks(1);
      assert.strictEqual(phoenix.stocks, 24);
    });

    it("should not decrease the stocks quantity if corporation is not established", () => {
      const phoenix = new Corporation();

      phoenix.decrementStocks(2);
      assert.strictEqual(phoenix.stocks, 25);
    });
  });

  describe("incrementStock", () => {
    it("should increase the quantity of stocks", () => {
      const phoenix = new Corporation();

      phoenix.establish();

      assert.strictEqual(phoenix.stocks, 25);
      phoenix.incrementStocks(1);
      assert.strictEqual(phoenix.stocks, 26);
    });

    it("should not increase the stocks quantity if corporation is not established", () => {
      const phoenix = new Corporation();

      phoenix.incrementStocks(2);
      assert.strictEqual(phoenix.stocks, 25);
    });
  });

  describe("increaseSize", () => {
    it("should increase the size by delta", () => {
      const phoenix = new Corporation();
      assert.strictEqual(phoenix.stats().size, 0);
      phoenix.increaseSize(10);
      assert.strictEqual(phoenix.stats().size, 10);
    });
  });

  describe("markSafe", () => {
    it("should mark a corporation safe", () => {
      const phoenix = new Corporation();
      assert.ok(!phoenix.stats().isSafe);
      phoenix.markSafe();
      assert.ok(phoenix.stats().isSafe);
    });
  });
});
