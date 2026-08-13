const MARKETS = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: 24751.48,
    percent: 2.46,
    color: "#F7931A",
    iconUrl: "https://app.paper.design/file-assets/01KZRS79EC7Q4AZGWWZFYYVFMA/0RNQZ6QX4S19BZ0SCP8DP128MF.png",
    range: 92,
    priceWidth: "9ch",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: 1690.82,
    percent: -3.64,
    color: "#7B74FF",
    iconUrl: "https://app.paper.design/file-assets/01KZRS79EC7Q4AZGWWZFYYVFMA/243NXCP42SCRVYS1B2PFC223QZ.png",
    range: 18,
    priceWidth: "8ch",
  },
];

const DEFAULT_CUE_VOLUME = 0.55;
const ERROR_CUE_VOLUME = 0.65;
const MAX_PILLS = 2;
const group = document.querySelector("[data-pill-group]");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
let selectedSymbols = ["BTC"];
let tick = 0;
let playCuelume = () => {};
let setCuelumeVolume = () => {};

import("https://esm.sh/cuelume@0.2.2")
  .then(({ play, setVolume }) => {
    setCuelumeVolume = setVolume;
    playCuelume = play;
    setCuelumeVolume(DEFAULT_CUE_VOLUME);
  })
  .catch(() => {
    playCuelume = () => {};
    setCuelumeVolume = () => {};
  });

function playCue(sound) {
  playCuelume(sound);
}

function playCueAtEffectiveVolume(sound, volume) {
  setCuelumeVolume(volume);
  playCuelume(sound);
  setCuelumeVolume(DEFAULT_CUE_VOLUME);
}

function formatSigned(value) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${currencyFormatter.format(Math.abs(value))}`;
}

function getLoopOffset(currentTick, index, range) {
  const phase = currentTick + index * 1.35;
  return Math.sin(phase) * range;
}

function getVisibleMarkets() {
  const markets = MARKETS.map((market, index) => {
    const offset = getLoopOffset(tick, index, market.range);
    const percentOffset = (offset / Math.max(market.price, 1)) * 100;

    return {
      ...market,
      price: market.price + offset,
      percent: market.percent + percentOffset,
    };
  });

  return selectedSymbols.map((symbol) => markets.find((market) => market.symbol === symbol)).filter(Boolean);
}

function renderRollingValue(value, previousValue) {
  const oldValue = previousValue || value;
  const maxLength = Math.max(oldValue.length, value.length);
  const previousCharacters = oldValue.padStart(maxLength, " ").split("");
  const currentCharacters = value.padStart(maxLength, " ").split("");
  const root = document.createElement("span");
  root.className = "rolling-value";
  root.setAttribute("aria-label", value.trim());

  currentCharacters.forEach((character, index) => {
    const previousCharacter = previousCharacters[index] || " ";
    const changed = previousCharacter !== character;
    const isDigit = /\d/.test(character) || /\d/.test(previousCharacter);
    const slot = document.createElement("span");
    slot.className = isDigit ? "digit-slot" : "digit-slot symbol-slot";

    if (changed) {
      const track = document.createElement("span");
      track.className = "digit-track is-rolling";
      const previous = document.createElement("span");
      const current = document.createElement("span");
      previous.textContent = previousCharacter;
      current.textContent = character;
      track.append(previous, current);
      slot.append(track);
    } else {
      const staticValue = document.createElement("span");
      staticValue.className = "digit-static";
      staticValue.textContent = character;
      slot.append(staticValue);
    }

    root.append(slot);
  });

  return root;
}

function createPill(market, previousValues, canDelete) {
  const shell = document.createElement("div");
  shell.className = "pill-motion";
  shell.dataset.symbol = market.symbol;

  const pill = document.createElement("div");
  pill.className = "market-pill";
  pill.setAttribute("aria-label", `${market.name} market pill`);

  const main = document.createElement("div");
  main.className = "market-main";

  const identity = document.createElement("div");
  identity.className = "market-identity";

  const icon = document.createElement("span");
  icon.className = "asset-icon";
  icon.style.setProperty("--asset-color", market.color);
  if (market.iconUrl) {
    const img = document.createElement("img");
    img.src = market.iconUrl;
    img.alt = "";
    icon.append(img);
  } else {
    icon.textContent = market.symbol.slice(0, 1);
  }

  const symbol = document.createElement("span");
  symbol.className = "symbol";
  symbol.textContent = market.symbol;
  identity.append(icon, symbol);

  const price = document.createElement("span");
  price.className = "price";
  price.style.setProperty("--price-width", market.priceWidth);
  const priceText = `$${currencyFormatter.format(market.price)}`;
  price.append(renderRollingValue(priceText, previousValues.get(`${market.symbol}:price`)));
  previousValues.set(`${market.symbol}:price`, priceText);
  main.append(identity, price);

  const divider = document.createElement("span");
  divider.className = "divider";

  const stats = document.createElement("div");
  stats.className = "market-stats";
  const percent = document.createElement("span");
  percent.className = market.percent >= 0 ? "percent positive" : "percent negative";
  const percentText = `${formatSigned(market.percent)}%`;
  percent.append(renderRollingValue(percentText, previousValues.get(`${market.symbol}:percent`)));
  previousValues.set(`${market.symbol}:percent`, percentText);
  stats.append(percent);

  pill.append(main, divider, stats);

  if (canDelete) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-cluster";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Remove ${market.symbol}`);
    deleteButton.innerHTML = `
      <span class="divider delete-divider"></span>
      <span class="delete-pill-button" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.75 4.75 11.25 11.25"></path>
          <path d="M11.25 4.75 4.75 11.25"></path>
        </svg>
      </span>
    `;
    deleteButton.addEventListener("click", () => deleteMarket(market.symbol));
    pill.append(deleteButton);
  }

  shell.append(pill);
  return shell;
}

function captureRects() {
  return new Map(
    Array.from(group.querySelectorAll(".pill-motion")).map((element) => [element.dataset.symbol, element.getBoundingClientRect()]),
  );
}

function animateLayout(previousRects) {
  if (!previousRects.size) return;

  group.querySelectorAll(".pill-motion").forEach((element) => {
    const previousRect = previousRects.get(element.dataset.symbol);
    if (!previousRect) return;

    const nextRect = element.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

    element.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.998)` },
        { transform: `translate(${deltaX * -0.018}px, ${deltaY * -0.018}px) scale(1.002)`, offset: 0.78 },
        { transform: "translate(0, 0) scale(1)" },
      ],
      {
        duration: 680,
        easing: "cubic-bezier(0.19, 1, 0.22, 1)",
      },
    );
  });
}

const previousValues = new Map();

function render(previousRects = new Map()) {
  const canAdd = selectedSymbols.length < Math.min(MAX_PILLS, MARKETS.length);
  const canDelete = selectedSymbols.length > 1;
  group.replaceChildren();

  getVisibleMarkets().forEach((market) => {
    group.append(createPill(market, previousValues, canDelete));
  });

  if (canAdd) {
    const add = document.createElement("button");
    add.className = "add-pill-button";
    add.type = "button";
    add.setAttribute("aria-label", "Add market pill");
    add.innerHTML = `
      <svg width="20" height="20" viewBox="1.5 1.5 15 15" aria-hidden="true">
        <path d="M9 4.625v8.75" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M4.625 9h8.75" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
    add.addEventListener("click", addNextMarket);
    group.append(add);
  }

  requestAnimationFrame(() => animateLayout(previousRects));
}

function addNextMarket() {
  const nextMarket = MARKETS.find((market) => !selectedSymbols.includes(market.symbol));
  if (!nextMarket) return;

  const previousRects = captureRects();
  playCue("ready");
  selectedSymbols = [...selectedSymbols, nextMarket.symbol].slice(0, MAX_PILLS);
  render(previousRects);
}

function deleteMarket(symbol) {
  if (selectedSymbols.length <= 1) return;

  const previousRects = captureRects();
  playCueAtEffectiveVolume("error", ERROR_CUE_VOLUME);
  selectedSymbols = selectedSymbols.filter((selectedSymbol) => selectedSymbol !== symbol);
  render(previousRects);
}

render();

window.setInterval(() => {
  tick += 1;
  render();
}, 2500);
