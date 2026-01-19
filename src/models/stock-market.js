const { groupBy } = require("lodash");

/**
 * StockMarket handles all stock-related operations.
 * Responsibilities:
 * - Buy and sell stocks
 * - Calculate majority/minority shareholders
 * - Distribute bonuses
 */
class StockMarket {
  #corporations;
  #players;

  constructor(corporations, players) {
    this.#corporations = corporations;
    this.#players = players;
  }

  /**
   * Process a stock purchase for a player
   * @returns {boolean} Whether the purchase was successful
   */
  buyStock(player, corporationName) {
    const corporation = this.#corporations[corporationName];
    const { isActive, stocks, price } = corporation.stats();

    if (!isActive || stocks < 1 || player.balance < price) {
      return false;
    }

    corporation.decrementStocks(1);
    player.addExpense(price);
    player.addStocks(corporationName, 1);
    return true;
  }

  /**
   * Process multiple stock purchases
   * @returns {string[]} List of successfully purchased corporation names
   */
  buyStocks(player, purchases) {
    const successful = [];

    for (const { name } of purchases) {
      if (this.buyStock(player, name)) {
        successful.push(name);
      }
    }

    return successful;
  }

  /**
   * Sell stocks back to a corporation
   */
  sellStock(player, corporationName, quantity) {
    const corporation = this.#corporations[corporationName];
    const { stocks } = player.portfolio();
    const { price } = corporation.stats();
    const owned = stocks[corporationName] || 0;

    if (quantity > owned) {
      return false;
    }

    player.sellStocks(corporationName, quantity);
    player.addIncome(quantity * price);
    corporation.incrementStocks(quantity);
    return true;
  }

  /**
   * Trade defunct stocks for acquirer stocks (2:1 ratio)
   */
  tradeStocks(player, defunctName, acquirerName, defunctQuantity) {
    const defunct = this.#corporations[defunctName];
    const acquirer = this.#corporations[acquirerName];
    const { stocks } = player.portfolio();
    const owned = stocks[defunctName] || 0;
    const acquirerQuantity = Math.floor(defunctQuantity / 2);

    if (defunctQuantity > owned || acquirerQuantity > acquirer.stocks) {
      return false;
    }

    player.sellStocks(defunctName, defunctQuantity);
    player.addStocks(acquirerName, acquirerQuantity);
    defunct.incrementStocks(defunctQuantity);
    acquirer.decrementStocks(acquirerQuantity);
    return true;
  }

  /**
   * Find majority and minority shareholders for a corporation
   */
  findShareholderGroups(corporationName) {
    const getStockCount = player => player.portfolio().stocks[corporationName] || 0;
    const stockholders = this.#players.filter(player => getStockCount(player) > 0);

    if (stockholders.length === 0) {
      return {
        majority: { stock: 0, players: [], playerNames: [] },
        minority: { stock: 0, players: [], playerNames: [] },
      };
    }

    const grouped = Object.entries(groupBy(stockholders, getStockCount))
      .map(([count, players]) => ({
        stock: parseInt(count),
        players,
        playerNames: players.map(p => p.username),
      }))
      .sort((a, b) => b.stock - a.stock);

    const [majority, minority] = grouped;

    return {
      majority: majority || { stock: 0, players: [], playerNames: [] },
      minority: minority || { stock: 0, players: [], playerNames: [] },
    };
  }

  /**
   * Distribute majority/minority bonuses for a corporation
   * @returns {Object} Stats about the bonus distribution
   */
  distributeBonuses(corporationName) {
    const corporation = this.#corporations[corporationName];
    const { majorityPrice, minorityPrice } = corporation.stats();
    const { majority, minority } = this.findShareholderGroups(corporationName);

    let stats;

    if (majority.players.length > 1 || minority.players.length === 0) {
      const totalBonus = majorityPrice + minorityPrice;
      const sharePrice = Math.floor(totalBonus / majority.players.length);

      majority.players.forEach(player => {
        player.addIncome(sharePrice);
      });

      stats = {
        corporation: corporationName,
        majority: {
          bonus: majorityPrice,
          players: majority.playerNames,
          stocks: majority.stock,
        },
        minority: {
          bonus: minorityPrice,
          players: majority.playerNames,
          stocks: minority.stock,
        },
      };
    } else {
      majority.players[0].addIncome(majorityPrice);

      const minorityShare = Math.floor(minorityPrice / minority.players.length);
      minority.players.forEach(player => {
        player.addIncome(minorityShare);
      });

      stats = {
        corporation: corporationName,
        majority: {
          bonus: majorityPrice,
          players: majority.playerNames,
          stocks: majority.stock,
        },
        minority: {
          bonus: minorityPrice,
          players: minority.playerNames,
          stocks: minority.stock,
        },
      };
    }

    return stats;
  }

  /**
   * Liquidate all stocks in a corporation (for game end)
   */
  liquidateCorporation(corporationName) {
    const corporation = this.#corporations[corporationName];
    const { price } = corporation.stats();

    this.#players.forEach(player => {
      const { stocks } = player.portfolio();
      const quantity = stocks[corporationName] || 0;

      if (quantity > 0) {
        player.sellStocks(corporationName, quantity);
        player.addIncome(quantity * price);
        corporation.incrementStocks(quantity);
      }
    });
  }

  /**
   * Get purchasable corporations (active with available stocks)
   */
  getPurchasableCorps(playerBalance) {
    return Object.entries(this.#corporations)
      .filter(([, corp]) => {
        const { isActive, stocks, price } = corp.stats();
        return isActive && stocks > 0 && price <= playerBalance;
      })
      .map(([name]) => name);
  }
}

module.exports = { StockMarket };
