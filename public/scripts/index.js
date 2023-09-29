const getJoinForm = () => document.querySelector("#join-form");
const getMessageElement = () => document.querySelector("#message");

const requestJoinGame = userData => {
  return fetch("/lobby/players", {
    method: "POST",
    body: JSON.stringify(userData),
    headers: { "content-type": "application/json" },
  });
};

const joinGame = res => {
  if (res.redirected) {
    window.location.assign(res.url);
    return;
  }

  res.json().then(({ error }) => {
    const message = getMessageElement();
    message.classList.add("error");
    message.innerText = error;
  });
};

const setupJoinForm = () => {
  const joinFrom = getJoinForm();
  joinFrom.onsubmit = event => {
    event.preventDefault();
    const userData = Object.fromEntries(new FormData(joinFrom));
    joinFrom.reset();
    requestJoinGame(userData).then(joinGame).catch(console.error);
  };
};

const main = () => {
  setupJoinForm();
};

window.onload = main;
