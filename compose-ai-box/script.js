const buttons = document.querySelectorAll("[data-action]");
const composeBox = document.querySelector(".compose-box");
const promptRow = document.querySelector("[data-prompt-row]");
const promptInput = document.querySelector("#prompt-input");
const menuButtons = document.querySelectorAll('[data-action="add"], [data-action="lightbulb"]');
let playCuelume = () => {};

import("https://esm.sh/cuelume@0.2.2")
  .then(({ play, setVolume }) => {
    setVolume(0.7);
    playCuelume = play;
  })
  .catch(() => {
    playCuelume = () => {};
  });

const promptLineHeight = 20;
const maxPromptLines = 8;
const composeTopGap = 20;
const defaultTextToolbarGap = 31;
const scrollTextToolbarGap = 20;
const toolbarHeight = 50;
const toolbarBottomOffset = 6;
let suppressNextFocusSound = false;

function closeMenus(exceptAnchor = null) {
  document.querySelectorAll(".menu-anchor.is-open").forEach((anchor) => {
    if (anchor !== exceptAnchor) {
      anchor.classList.remove("is-open");
      anchor.querySelector("button")?.setAttribute("aria-expanded", "false");
    }
  });
}

function positionMenu(anchor) {
  const composeBox = document.querySelector(".compose-box");
  const menu = anchor.querySelector(".dropdown-menu");
  const anchorRect = anchor.getBoundingClientRect();
  const composeRect = composeBox.getBoundingClientRect();

  menu.style.top = `${composeRect.bottom - anchorRect.top + 4}px`;
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action !== "send") {
      playCuelume("press");
    }

    if (action === "globe") {
      const willSelect = !button.classList.contains("is-selected");

      button.classList.remove("spin-clockwise", "spin-counter");
      void button.offsetWidth;
      button.classList.add(willSelect ? "spin-clockwise" : "spin-counter");
      promptRow.classList.toggle("search-mode", willSelect);

      button.classList.toggle("is-selected");
    }

    if (action === "send") {
      sendMessage();
    }
  });
});

function sendMessage() {
  if (!promptInput.value.trim() || promptRow.classList.contains("is-sending")) {
    return;
  }

  closeMenus();
  playCuelume("loading");
  promptRow.classList.remove("placeholder-returning");
  promptRow.classList.add("is-sending");

  window.setTimeout(() => {
    promptInput.value = "";
    updatePromptLayout();
    promptRow.classList.remove("is-sending");
    syncPromptState();
    promptRow.classList.add("placeholder-returning");
  }, 300);

  window.setTimeout(() => {
    promptRow.classList.remove("placeholder-returning");
    suppressNextFocusSound = true;
    promptInput.focus();
    syncPromptState();
  }, 650);
}

menuButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();

    const anchor = button.closest(".menu-anchor");
    const willOpen = !anchor.classList.contains("is-open");

    if (button.dataset.action === "lightbulb") {
      const icon = button.querySelector(".ai-icon-slot");
      icon.classList.remove("is-shaking");
      void icon.offsetWidth;
      icon.classList.add("is-shaking");
    }

    closeMenus(anchor);
    if (willOpen) {
      positionMenu(anchor);
    }
    anchor.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
});

document.querySelector(".ai-icon-slot").addEventListener("animationend", (event) => {
  if (event.animationName === "ai-shake") {
    event.currentTarget.classList.remove("is-shaking");
  }
});

document.querySelectorAll('[data-menu="add"] .dropdown-item').forEach((item) => {
  item.addEventListener("click", () => {
    playCuelume("press");
  });
});

document.querySelectorAll('[data-menu="lightbulb"] .dropdown-item').forEach((item) => {
  item.addEventListener("click", (event) => {
    playCuelume("press");

    const menu = event.currentTarget.closest(".dropdown-menu");
    const anchor = menu.closest(".menu-anchor");
    const button = anchor.querySelector('[data-action="lightbulb"]');
    const labelWrap = button.querySelector(".model-label-wrap");
    const currentLabel = labelWrap.querySelector(".model-label-current");
    const nextLabel = labelWrap.querySelector(".model-label-next");
    const nextText = event.currentTarget.textContent;

    if (currentLabel.textContent !== nextText) {
      window.clearTimeout(Number(labelWrap.dataset.swapTimer || 0));
      labelWrap.classList.add("no-transition");
      labelWrap.classList.remove("is-swapping");

      const currentWidth = labelWrap.getBoundingClientRect().width;

      nextLabel.textContent = nextText;
      const nextWidth = nextLabel.getBoundingClientRect().width;

      labelWrap.style.width = `${currentWidth}px`;
      void labelWrap.offsetWidth;
      labelWrap.classList.remove("no-transition");
      labelWrap.style.width = `${nextWidth}px`;
      labelWrap.classList.add("is-swapping");

      labelWrap.dataset.swapTimer = String(window.setTimeout(() => {
        labelWrap.classList.add("no-transition");
        currentLabel.textContent = nextText;
        nextLabel.textContent = "";
        labelWrap.classList.remove("is-swapping");
        labelWrap.style.width = `${nextWidth}px`;
        void labelWrap.offsetWidth;
        labelWrap.classList.remove("no-transition");
        delete labelWrap.dataset.swapTimer;
      }, 320));
    }

    anchor.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".model-label-wrap").forEach((labelWrap) => {
  const currentLabel = labelWrap.querySelector(".model-label-current");
  labelWrap.style.width = `${currentLabel.getBoundingClientRect().width}px`;
});

window.addEventListener("resize", () => {
  document.querySelectorAll(".model-label-wrap").forEach((labelWrap) => {
    const currentLabel = labelWrap.querySelector(".model-label-current");
    if (!labelWrap.classList.contains("is-swapping")) {
      labelWrap.style.width = `${currentLabel.getBoundingClientRect().width}px`;
    }
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-anchor")) {
    closeMenus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenus();
  }
});

document.querySelector('[data-action="globe"]').addEventListener("animationend", (event) => {
  if (event.animationName.startsWith("globe-spin")) {
    event.currentTarget.classList.remove("spin-clockwise", "spin-counter");
  }
});

function syncPromptState() {
  const hasText = promptInput.value.length > 0;
  const isActive = document.activeElement === promptInput;

  updatePromptLayout();
  promptRow.classList.toggle("has-text", hasText);
  promptRow.classList.toggle("is-active", isActive);
  composeBox.classList.toggle("is-active", isActive);
  composeBox.classList.toggle("has-text", hasText);
}

function updatePromptLayout() {
  promptInput.style.height = "auto";
  promptRow.classList.remove("is-scrollable");

  const maxHeight = promptLineHeight * maxPromptLines;
  const isExpanded = promptInput.scrollHeight > promptLineHeight + 1;
  const isScrollable = promptInput.scrollHeight > maxHeight + 1;
  const maxVisibleHeight = maxHeight;
  const nextHeight = Math.min(promptInput.scrollHeight, maxVisibleHeight);
  const textToolbarGap = isScrollable ? scrollTextToolbarGap : defaultTextToolbarGap;
  const nextComposeHeight = composeTopGap + Math.max(promptLineHeight, nextHeight) + textToolbarGap + toolbarHeight + toolbarBottomOffset;

  promptInput.style.height = `${Math.max(promptLineHeight, nextHeight)}px`;
  composeBox.style.height = `${nextComposeHeight}px`;
  composeBox.classList.toggle("is-expanded", isExpanded);
  composeBox.classList.toggle("is-scrollable", isScrollable);
  promptRow.classList.toggle("is-scrollable", isScrollable);
  updatePromptScrollState();
}

function updatePromptScrollState() {
  const canScroll = promptInput.scrollHeight > promptInput.clientHeight + 1;
  const canScrollUp = canScroll && promptInput.scrollTop > 1;
  const canScrollDown = canScroll && promptInput.scrollTop + promptInput.clientHeight < promptInput.scrollHeight - 1;

  promptRow.classList.toggle("can-scroll-up", canScrollUp);
  promptRow.classList.toggle("can-scroll-down", canScrollDown);
}

promptRow.addEventListener("click", () => {
  promptInput.focus();
});

promptInput.addEventListener("focus", () => {
  if (suppressNextFocusSound) {
    suppressNextFocusSound = false;
  } else if (!composeBox.classList.contains("is-active")) {
    playCuelume("toggle");
  }

  syncPromptState();
});
promptInput.addEventListener("blur", syncPromptState);
promptInput.addEventListener("input", syncPromptState);
promptInput.addEventListener("scroll", updatePromptScrollState);

promptInput.focus();
syncPromptState();
