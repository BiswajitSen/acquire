const puppeteer = require("puppeteer");

const openChrome = async (name, url) => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--window-size=1728,1200"],
  });

  const page = await browser.newPage();
  await page.goto(url);
  await page.setViewport({
    width: 1728,
    height: 920,
    isLandscape: true,
    deviceScaleFactor: 0.9,
  });

  const usernameForm = await page.waitForSelector("#username-field");
  await usernameForm.type(name);
  const joinButton = await page.waitForSelector("input[type=submit]");
  joinButton.click();

  const startButton = await page.waitForSelector("#start-btn:not(.hide)", {
    hidden: true,
  });

  if (startButton) {
    startButton.click();
  }
};

const main = async () => {
  const url = process.argv[2];
  openChrome("Debu", url);
  openChrome("Bittu", url);
  openChrome("biswa", url);
};

main();
