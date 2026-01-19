import { socketClient } from "/scripts/socket-client.js";

const getPlayerSection = () => document.querySelector("#players");
const getMessageElement = () => document.querySelector("#message");
const getAnimationSection = () => document.querySelector("#animation");
const getStartBtn = () => document.querySelector("#start-btn");

const getLobbyIdFromUrl = () => {
  const pathParts = window.location.pathname.split("/");
  return pathParts[2];
};

const getLobbyStatus = () => {
  const lobbyId = getLobbyIdFromUrl();
  return fetch(`/lobby/${lobbyId}/status`).then(res => res.json());
};

const renderPlayer = (username, playerElement) => {
  const playerNameElement = playerElement.querySelector(".name");
  const profilePicture = playerElement.querySelector(".profile-picture");
  
  playerElement.classList.add("joined");
  playerNameElement.innerText = username;
  profilePicture.innerText = username.charAt(0).toUpperCase();
};

const renderPlayers = players => {
  const playerSection = getPlayerSection();
  players.forEach(({ username }, index) => {
    const playerElement = playerSection.children[index];
    renderPlayer(username, playerElement);
  });
};

const redirectToGame = () => {
  const lobbyId = getLobbyIdFromUrl();
  window.location.assign(`/game/${lobbyId}`);
};

const isHost = (host, self) => self.username === host.username;

const renderStartBtn = ({ host, self, isPossibleToStartGame }) => {
  const startButton = getStartBtn();
  if (isHost(host, self)) {
    startButton.classList.remove("hide");
    startButton.classList.add("disable-click");
  }

  if (isPossibleToStartGame) startButton.classList.remove("disable-click");
};

const gameHasStarted = ({ isPossibleToStartGame, hasExpired }) => {
  return isPossibleToStartGame && hasExpired;
};

const updateLobbyUI = (status) => {
  renderPlayers(status.players);
  renderStartBtn(status);
  if (gameHasStarted(status)) redirectToGame();
};

const updateLobby = () => {
  getLobbyStatus().then(updateLobbyUI);
};

const animate = () => {
  const animationSection = getAnimationSection();
  let dots = 0;
  setInterval(() => {
    dots = (dots % 3) + 1;
    animationSection.innerText = ".".repeat(dots);
  }, 500);
};

const startGame = () => {
  const lobbyId = getLobbyIdFromUrl();
  return fetch(`/game/${lobbyId}/start`, { method: "POST" }).then(res => {
    if (res.status === 200) {
      redirectToGame();
    }
  });
};

const setUpStartButton = () => {
  const startBtn = getStartBtn();
  startBtn.onclick = () => {
    startGame();
  };
};

const setupSocketListeners = () => {
  const lobbyId = getLobbyIdFromUrl();
  
  // Join the lobby room
  socketClient.emit("joinLobbyRoom", lobbyId);
  
  // Listen for lobby updates - fetch fresh data to get user-specific info
  socketClient.on("lobbyUpdate", () => {
    updateLobby();
  });
};

const main = () => {
  animate();
  updateLobby();
  setUpStartButton();
  setupSocketListeners();
};

window.onload = main;
