import { socketClient, EVENTS } from "/scripts/socket-client.js";

const getHostForm = () => document.querySelector("#host-form");
const getJoinForm = () => document.querySelector("#join-form");
const getMessageElement = () => document.querySelector("#message");
const getLobbyList = () => document.querySelector("#lobby-list");
const getLoadingMessage = () => document.querySelector("#loading-message");
const getSelectedLobbyId = () => document.querySelector("#selected-lobby-id");

let selectedLobbyId = null;

const showError = error => {
  const message = getMessageElement();
  message.classList.add("error");
  message.innerText = error;
};

const clearError = () => {
  const message = getMessageElement();
  message.classList.remove("error");
  message.innerText = "";
};

const hostLobby = userData => {
  return fetch("/host", {
    method: "POST",
    body: JSON.stringify(userData),
    headers: { "content-type": "application/json" },
  });
};

const joinLobby = (lobbyId, userData) => {
  return fetch(`/lobby/${lobbyId}/players`, {
    method: "POST",
    body: JSON.stringify(userData),
    headers: { "content-type": "application/json" },
  });
};

const fetchLobbies = () => {
  return fetch("/list").then(res => res.json());
};

const handleHostResponse = res => {
  if (res.ok) {
    res.json().then(({ lobbyId }) => {
      window.location.assign(`/lobby/${lobbyId}`);
    });
    return;
  }

  res.json().then(({ error }) => showError(error));
};

const handleJoinResponse = res => {
  if (res.redirected) {
    window.location.assign(res.url);
    return;
  }

  res.json().then(({ error }) => showError(error));
};

const selectLobby = lobbyId => {
  selectedLobbyId = lobbyId;
  getSelectedLobbyId().value = lobbyId;
  getJoinForm().classList.remove("hide");
  clearError();

  document.querySelectorAll(".lobby-item").forEach(item => {
    item.classList.remove("selected");
  });
  document.querySelector(`[data-lobby-id="${lobbyId}"]`)?.classList.add("selected");
};

const renderLobbyItem = lobby => {
  const item = document.createElement("div");
  item.className = "lobby-item";
  item.dataset.lobbyId = lobby.id;
  
  const hostDisplay = lobby.host || "Unknown";
  
  item.innerHTML = `
    <span class="lobby-host">${hostDisplay}</span>
    <span class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers}</span>
    ${lobby.isFull ? '<span class="lobby-full">FULL</span>' : ''}
  `;

  if (!lobby.isFull) {
    item.onclick = () => selectLobby(lobby.id);
    item.classList.add("joinable");
  }

  return item;
};

const renderLobbies = lobbies => {
  const lobbyList = getLobbyList();
  const loadingMessage = getLoadingMessage();

  if (lobbies.length === 0) {
    loadingMessage.innerText = "No lobbies available. Host one!";
    loadingMessage.classList.remove("hide");
    lobbyList.innerHTML = "";
    return;
  }

  loadingMessage.classList.add("hide");
  lobbyList.innerHTML = "";

  lobbies.forEach(lobby => {
    lobbyList.appendChild(renderLobbyItem(lobby));
  });
};

const loadLobbies = () => {
  fetchLobbies()
    .then(({ lobbies }) => renderLobbies(lobbies))
    .catch(() => {
      getLoadingMessage().innerText = "Failed to load lobbies";
    });
};

const setupHostForm = () => {
  const hostForm = getHostForm();
  hostForm.onsubmit = event => {
    event.preventDefault();
    clearError();
    const userData = Object.fromEntries(new FormData(hostForm));
    hostLobby(userData).then(handleHostResponse).catch(console.error);
  };
};

const setupJoinForm = () => {
  const joinForm = getJoinForm();
  joinForm.onsubmit = event => {
    event.preventDefault();
    clearError();

    if (!selectedLobbyId) {
      showError("Please select a lobby to join");
      return;
    }

    const formData = new FormData(joinForm);
    const userData = { username: formData.get("username") };
    joinLobby(selectedLobbyId, userData).then(handleJoinResponse).catch(console.error);
  };
};

const setupSocketListeners = () => {
  socketClient.lobby.on(EVENTS.LOBBY_LIST_UPDATE, ({ lobbies }) => {
    renderLobbies(lobbies);
  });

  socketClient.lobby.onReconnect(() => {
    loadLobbies();
  });
};

const main = () => {
  loadLobbies();
  setupHostForm();
  setupJoinForm();
  setupSocketListeners();
};

window.onload = main;
