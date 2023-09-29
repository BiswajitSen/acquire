export default class GameGateway {
  #root;

  constructor(root) {
    this.#root = root;
  }

  #post(url, data = {}) {
    return fetch(this.#root + url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "content-type": "application/json",
      },
    });
  }

  #get(url) {
    return fetch(this.#root + url);
  }

  endTurn() {
    this.#post("/end-turn");
  }

  establishCorporation(corporation) {
    this.#post("/establish", corporation);
  }

  async getStatus() {
    const res = await this.#get("/status");
    return res.json();
  }
}
