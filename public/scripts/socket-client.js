import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const EVENTS = {
  CONNECTION: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",
  ERROR: "error",
  
  JOIN_LOBBY: "joinLobby",
  LEAVE_LOBBY: "leaveLobby",
  LOBBY_UPDATE: "lobbyUpdate",
  LOBBY_LIST_UPDATE: "lobbyListUpdate",
  
  JOIN_GAME: "joinGame",
  LEAVE_GAME: "leaveGame",
  GAME_UPDATE: "gameUpdate",
  GAME_END: "gameEnd",
  
  VOICE_JOIN: "voiceJoin",
  VOICE_LEAVE: "voiceLeave",
  VOICE_OFFER: "voiceOffer",
  VOICE_ANSWER: "voiceAnswer",
  VOICE_ICE_CANDIDATE: "voiceIceCandidate",
  VOICE_USER_JOINED: "voiceUserJoined",
  VOICE_USER_LEFT: "voiceUserLeft",
  VOICE_ROOM_USERS: "voiceRoomUsers",
  VOICE_MIC_ON: "voiceMicOn",
  VOICE_MIC_OFF: "voiceMicOff"
};

const getAuthInfo = () => {
  const pathParts = window.location.pathname.split("/");
  const lobbyId = pathParts[2] || null;
  const username = document.cookie
    .split("; ")
    .find(row => row.startsWith("username="))
    ?.split("=")[1];
  
  return { lobbyId, username };
};

const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
};

class NamespacedSocket {
  #socket;
  #namespace;
  #isConnected = false;
  #eventQueue = [];
  #reconnectCallbacks = [];

  constructor(namespace) {
    this.#namespace = namespace;
    const { lobbyId, username } = getAuthInfo();
    
    this.#socket = io(namespace, {
      ...SOCKET_OPTIONS,
      auth: { lobbyId, username }
    });

    this.#setupConnectionHandlers();
  }

  #setupConnectionHandlers() {
    this.#socket.on(EVENTS.CONNECTION, () => {
      this.#isConnected = true;
      this.#flushEventQueue();
      this.#reconnectCallbacks.forEach(cb => cb());
    });

    this.#socket.on(EVENTS.DISCONNECT, (reason) => {
      this.#isConnected = false;
      console.warn(`[${this.#namespace}] Disconnected:`, reason);
    });

    this.#socket.on(EVENTS.CONNECT_ERROR, (error) => {
      console.error(`[${this.#namespace}] Connection error:`, error.message);
    });

    this.#socket.on(EVENTS.ERROR, (error) => {
      console.error(`[${this.#namespace}] Error:`, error);
    });
  }

  #flushEventQueue() {
    while (this.#eventQueue.length > 0) {
      const { event, data, callback } = this.#eventQueue.shift();
      this.emit(event, data, callback);
    }
  }

  on(event, callback) {
    this.#socket.on(event, callback);
    return this;
  }

  off(event, callback) {
    this.#socket.off(event, callback);
    return this;
  }

  emit(event, data, callback) {
    if (!this.#isConnected) {
      this.#eventQueue.push({ event, data, callback });
      return this;
    }
    
    if (callback) {
      this.#socket.emit(event, data, callback);
    } else {
      this.#socket.emit(event, data);
    }
    return this;
  }

  emitWithAck(event, data) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Socket acknowledgment timeout"));
      }, 5000);

      this.emit(event, data, (response) => {
        clearTimeout(timeout);
        if (response?.success) {
          resolve(response);
        } else {
          reject(response?.error || new Error("Unknown error"));
        }
      });
    });
  }

  onReconnect(callback) {
    this.#reconnectCallbacks.push(callback);
    return this;
  }

  get connected() {
    return this.#isConnected;
  }

  get id() {
    return this.#socket.id;
  }

  disconnect() {
    this.#socket.disconnect();
  }
}

class SocketClient {
  #lobbySocket = null;
  #gameSocket = null;
  #voiceSocket = null;

  get lobby() {
    if (!this.#lobbySocket) {
      this.#lobbySocket = new NamespacedSocket("/lobby");
    }
    return this.#lobbySocket;
  }

  get game() {
    if (!this.#gameSocket) {
      this.#gameSocket = new NamespacedSocket("/game");
    }
    return this.#gameSocket;
  }

  get voice() {
    if (!this.#voiceSocket) {
      this.#voiceSocket = new NamespacedSocket("/voice");
    }
    return this.#voiceSocket;
  }

  disconnectAll() {
    this.#lobbySocket?.disconnect();
    this.#gameSocket?.disconnect();
    this.#voiceSocket?.disconnect();
  }
}

export const socketClient = new SocketClient();
export { EVENTS };