const GAME_CONFIG = {
  BOARD_ROWS: 9,
  BOARD_COLS: 12,
  INITIAL_BALANCE: 6000,
  TILES_PER_PLAYER: 6,
  MAX_STOCKS_PER_TURN: 3,
  INITIAL_STOCKS: 25,
  SAFE_SIZE_THRESHOLD: 11,
  GAME_END_SIZE: 41,
  TRADE_RATIO: 2,
};

const CORPORATION_TIERS = {
  BUDGET: { basePrice: 100, names: ["zeta", "sackson"] },
  STANDARD: { basePrice: 200, names: ["fusion", "hydra", "america"] },
  PREMIUM: { basePrice: 300, names: ["phoenix", "quantum"] },
};

const CORPORATION_NAMES = [
  "phoenix",
  "quantum",
  "hydra",
  "fusion",
  "america",
  "sackson",
  "zeta",
];

const PRICE_RANGES = [
  { minSize: 41, bonus: 900 },
  { minSize: 31, bonus: 800 },
  { minSize: 21, bonus: 700 },
  { minSize: 11, bonus: 600 },
  { minSize: 6, bonus: 500 },
  { minSize: 5, bonus: 400 },
  { minSize: 4, bonus: 300 },
  { minSize: 3, bonus: 200 },
  { minSize: 2, bonus: 100 },
  { minSize: 0, bonus: 0 },
];

module.exports = {
  GAME_CONFIG,
  CORPORATION_TIERS,
  CORPORATION_NAMES,
  PRICE_RANGES,
};
