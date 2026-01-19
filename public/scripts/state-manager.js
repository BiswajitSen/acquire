class StateManager {
  #state = {};
  #listeners = new Map();
  #history = [];
  #maxHistory = 10;

  constructor(initialState = {}) {
    this.#state = { ...initialState };
  }

  get(key) {
    if (key) {
      return this.#state[key];
    }
    return { ...this.#state };
  }

  set(key, value) {
    const oldValue = this.#state[key];
    
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
      return;
    }

    this.#history.push({ key, oldValue, timestamp: Date.now() });
    if (this.#history.length > this.#maxHistory) {
      this.#history.shift();
    }

    this.#state[key] = value;
    this.#notifyListeners(key, value, oldValue);
  }

  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  subscribe(key, callback) {
    if (!this.#listeners.has(key)) {
      this.#listeners.set(key, new Set());
    }
    this.#listeners.get(key).add(callback);

    return () => {
      this.#listeners.get(key)?.delete(callback);
    };
  }

  subscribeAll(callback) {
    return this.subscribe("*", callback);
  }

  #notifyListeners(key, newValue, oldValue) {
    this.#listeners.get(key)?.forEach(cb => cb(newValue, oldValue, key));
    this.#listeners.get("*")?.forEach(cb => cb(newValue, oldValue, key));
  }

  getHistory() {
    return [...this.#history];
  }

  reset(initialState = {}) {
    this.#state = { ...initialState };
    this.#history = [];
  }
}

class GameState extends StateManager {
  constructor() {
    super({
      gameStatus: null,
      isLoading: false,
      error: null,
      lastUpdate: null,
      connectionStatus: "disconnected"
    });
  }

  setGameStatus(status) {
    this.update({
      gameStatus: status,
      lastUpdate: Date.now(),
      error: null
    });
  }

  setLoading(isLoading) {
    this.set("isLoading", isLoading);
  }

  setError(error) {
    this.set("error", error);
  }

  setConnectionStatus(status) {
    this.set("connectionStatus", status);
  }

  get isMyTurn() {
    const status = this.get("gameStatus");
    if (!status) return false;
    
    const self = status.players?.find(p => p.you);
    const currentPlayer = status.players?.find(p => p.isTakingTurn);
    return self?.username === currentPlayer?.username;
  }

  get currentState() {
    return this.get("gameStatus")?.state;
  }
}

const retry = async (fn, options = {}) => {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

const fetchWithRetry = async (url, options = {}, retryOptions = {}) => {
  return retry(async () => {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return response;
  }, {
    ...retryOptions,
    shouldRetry: (error) => {
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
      return retryOptions.shouldRetry ? retryOptions.shouldRetry(error) : true;
    }
  });
};

export { StateManager, GameState, retry, fetchWithRetry };
