import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

class SocketClient {
  #socket;

  constructor() {
    this.#socket = io();
    this.#socket.on("connect", () => {
      console.log("Socket connected:", this.#socket.id);
    });
    this.#socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }

  emit(event, data) {
    this.#socket.emit(event, data);
  }

  on(event, callback) {
    this.#socket.on(event, callback);
  }

  get id() {
    return this.#socket.id;
  }
}

export const socketClient = new SocketClient();
