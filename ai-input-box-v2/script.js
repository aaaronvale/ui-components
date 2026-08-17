let playCuelume = () => {};

import("https://esm.sh/cuelume@0.2.2")
  .then(({ play, setVolume }) => {
    setVolume(0.7);
    playCuelume = play;
  })
  .catch(() => {
    playCuelume = () => {};
  });

function playCue(name) {
  try {
    playCuelume(name);
  } catch {
    playCuelume = () => {};
  }
}

async function renderThinkingOrb(target) {
  try {
    const [{ ThinkingOrb }, { createRoot }, jsxRuntime] = await Promise.all([
      import("https://esm.sh/thinking-orbs@0.3.1?bundle&deps=react@19.2.8"),
      import("https://esm.sh/react-dom@19.2.8/client"),
      import("https://esm.sh/react@19.2.8/jsx-runtime"),
    ]);

    createRoot(target).render(jsxRuntime.jsx(ThinkingOrb, { state: "searching", size: 20, speed: 0.35, theme: "dark" }));
  } catch {
    target.classList.add("is-orb-unavailable");
  }
}

let beamRoot = null;
let beamModules = null;
let pendingBeamActive = false;

async function renderComposeBeam(active) {
  pendingBeamActive = active;

  try {
    if (!beamModules) {
      beamModules = Promise.all([
        import("https://esm.sh/border-beam@1.3.0?bundle&deps=react@19.2.8"),
        import("https://esm.sh/react-dom@19.2.8/client"),
        import("https://esm.sh/react@19.2.8/jsx-runtime"),
      ]);
    }

    const [{ BorderBeam }, { createRoot }, jsxRuntime] = await beamModules;
    const host = document.querySelector("[data-compose-beam]");

    if (!host) {
      return;
    }

    if (!beamRoot) {
      beamRoot = createRoot(host);
    }

    beamRoot.render(
      jsxRuntime.jsx(BorderBeam, {
        active: pendingBeamActive,
        borderRadius: 28,
        className: "compose-beam-frame",
        colorVariant: "colorful",
        size: "md",
        strength: 0.6,
        theme: "dark",
        style: {
          position: "absolute",
          inset: 0,
          width: "100%",
          minHeight: "inherit",
          pointerEvents: "none",
        },
        children: jsxRuntime.jsx("div", { className: "compose-beam-shape" }),
      })
    );
  } catch {
    document.querySelector("[data-compose-beam]")?.classList.add("is-beam-unavailable");
  }
}

const composeBox = document.querySelector("[data-compose-box]");
const aiFrame = composeBox.closest(".ai-frame");
const statusPanel = document.querySelector(".status-panel");
const promptRow = document.querySelector("[data-prompt-row]");
const promptInput = document.querySelector("#follow-up-input");
const addButton = document.querySelector('[data-action="add"]');
const sendButton = document.querySelector('[data-action="send"]');
const statusStopButton = document.querySelector('[data-action="status-stop"]');
const addAnchor = addButton.closest(".menu-anchor");
const statusText = document.querySelector("[data-status-text]");
const statusIcon = document.querySelector(".status-icon");
const statusOrb = document.querySelector("[data-status-orb]");

const promptLineHeight = 20;
const maxPromptLines = 6;
const baseComposeHeight = 127;
const frameOverlapOffset = 46;
const frameBottomPadding = 0;

let statusIndex = 0;
let statusVisible = false;
let statusSwapTimer = 0;
let statusCycleTimer = 0;
let statusFadeTimer = 0;
let statusDismissTimer = 0;
let statusResetTimer = 0;
let statusCompletionHandled = false;
const statuses = ["Checking permissions...", "Making updates...", "Finalising changes...", "Changes completed"];
const completedStatus = statuses[statuses.length - 1];
const stoppedStatus = "Action stopped";

function setStatusText(nextText) {
  statusText.textContent = nextText;
  statusText.dataset.text = nextText;
  syncStatusVisualState(nextText);
}

function syncStatusVisualState(currentText) {
  const isComplete = currentText === completedStatus;
  const isStopped = currentText === stoppedStatus;
  const isLoading = !isComplete && !isStopped;

  statusText.classList.toggle("is-shimmering", isLoading);
  statusPanel.classList.toggle("is-complete", isComplete);
  statusPanel.classList.toggle("is-stopped", isStopped);
  statusIcon.classList.toggle("is-complete", isComplete);
  statusIcon.classList.toggle("is-stopped", isStopped);
  statusIcon.classList.remove("is-leaving");
  statusStopButton.disabled = isComplete || isStopped;
}

function setStatusVisible(isVisible) {
  window.clearTimeout(statusFadeTimer);
  window.clearTimeout(statusDismissTimer);
  if (isVisible) {
    window.clearTimeout(statusResetTimer);
  }
  statusVisible = isVisible;
  aiFrame.classList.toggle("has-status", statusVisible);
  statusPanel.setAttribute("aria-hidden", String(!statusVisible));
  if (statusVisible) {
    statusPanel.classList.remove("is-dismissing");
    startStatusCycle();
  } else {
    stopStatusCycle();
    statusText.classList.remove("is-leaving", "is-entering");
  }
  updatePromptLayout();
}

function resetHiddenStatus() {
  if (statusVisible) {
    return;
  }

  statusPanel.classList.remove("is-dismissing");
  statusCompletionHandled = false;
  statusStopButton.disabled = false;
  statusIcon.classList.remove("is-leaving");
  setStatusText(statuses[0]);
  statusText.classList.remove("is-leaving", "is-entering");
}

function startStatusCycle() {
  stopStatusCycle();
  statusIndex = 0;
  statusCompletionHandled = false;
  statusStopButton.disabled = false;
  setStatusText(statuses[statusIndex]);
  statusText.classList.remove("is-leaving", "is-entering");
  statusText.classList.add("is-entering");
  statusSwapTimer = window.setTimeout(() => {
    statusText.classList.remove("is-entering");
  }, 520);
  statusCycleTimer = window.setInterval(advanceStatusText, 3000);
}

function stopStatusCycle() {
  window.clearTimeout(statusSwapTimer);
  window.clearInterval(statusCycleTimer);
}

function dismissStatusAfter(delay) {
  window.clearTimeout(statusFadeTimer);
  window.clearTimeout(statusDismissTimer);
  window.clearTimeout(statusResetTimer);

  statusFadeTimer = window.setTimeout(() => {
    statusPanel.classList.add("is-dismissing");
  }, delay);

  statusDismissTimer = window.setTimeout(() => {
    setStatusVisible(false);
  }, delay + 300);

  statusResetTimer = window.setTimeout(resetHiddenStatus, delay + 880);
}

function handleStatusCompleted() {
  if (statusCompletionHandled) {
    return;
  }

  statusCompletionHandled = true;
  stopStatusCycle();
  statusStopButton.disabled = true;
  playCue("scan");
  dismissStatusAfter(1500);
}

function swapStatusText(nextText, afterSwap) {
  window.clearTimeout(statusSwapTimer);
  statusText.classList.remove("is-entering");
  statusText.classList.add("is-leaving");

  statusSwapTimer = window.setTimeout(() => {
    setStatusText(nextText);
    afterSwap?.();
    statusText.classList.remove("is-leaving");
    statusText.classList.add("is-entering");

    statusSwapTimer = window.setTimeout(() => {
      statusText.classList.remove("is-entering");
    }, 520);
  }, 420);
}

function advanceStatusText() {
  if (!statusVisible) {
    return;
  }

  statusIndex = (statusIndex + 1) % statuses.length;
  const nextStatus = statuses[statusIndex];
  swapStatusText(nextStatus, nextStatus === completedStatus ? handleStatusCompleted : undefined);
  if (nextStatus === completedStatus) {
    window.clearInterval(statusCycleTimer);
  }
}

function closeMenus() {
  addAnchor.classList.remove("is-open");
  addButton.setAttribute("aria-expanded", "false");
}

function updatePromptScrollState() {
  const canScroll = promptInput.scrollHeight > promptInput.clientHeight + 1;
  const canScrollUp = canScroll && promptInput.scrollTop > 1;
  const canScrollDown = canScroll && promptInput.scrollTop + promptInput.clientHeight < promptInput.scrollHeight - 1;

  promptRow.classList.toggle("can-scroll-up", canScrollUp);
  promptRow.classList.toggle("can-scroll-down", canScrollDown);
}

function updatePromptLayout() {
  promptInput.style.height = "auto";
  promptRow.classList.remove("is-scrollable");

  const maxHeight = promptLineHeight * maxPromptLines;
  const nextHeight = Math.min(promptInput.scrollHeight, maxHeight);
  const isScrollable = promptInput.scrollHeight > maxHeight + 1;
  const composeHeight = Math.max(baseComposeHeight, 107 + nextHeight);
  const frameOffset = aiFrame.classList.contains("has-status") ? frameOverlapOffset : 0;

  promptInput.style.height = `${Math.max(promptLineHeight, nextHeight)}px`;
  composeBox.style.minHeight = `${composeHeight}px`;
  aiFrame.style.minHeight = `${frameOffset + composeHeight + frameBottomPadding}px`;
  promptRow.classList.toggle("is-scrollable", isScrollable);
  updatePromptScrollState();
}

function syncPromptState() {
  const hasText = promptInput.value.length > 0;
  const isActive = document.activeElement === promptInput;

  updatePromptLayout();
  promptRow.classList.toggle("has-text", hasText);
  promptRow.classList.toggle("is-active", isActive);
  composeBox.classList.toggle("is-active", isActive);
  composeBox.classList.toggle("is-beam-active", isActive);
  composeBox.classList.toggle("has-text", hasText);
  sendButton.disabled = !hasText;
  renderComposeBeam(isActive);
  updatePromptLayout();
}

function sendMessage() {
  if (!promptInput.value.trim() || promptRow.classList.contains("is-sending")) {
    return;
  }

  closeMenus();
  playCue("whisper");
  setStatusVisible(true);
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
    syncPromptState();
  }, 650);
}

addButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = !addAnchor.classList.contains("is-open");

  addAnchor.classList.toggle("is-open", willOpen);
  addButton.setAttribute("aria-expanded", String(willOpen));
});

statusStopButton.addEventListener("click", () => {
  if (!statusVisible) {
    return;
  }

  if (statusPanel.classList.contains("is-dismissing")) {
    return;
  }

  stopStatusCycle();
  statusStopButton.disabled = true;
  statusIcon.classList.add("is-leaving");
  swapStatusText(stoppedStatus);
  dismissStatusAfter(1420);
});

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button:not(:disabled)");

    if (button && !button.matches('[data-action="send"]')) {
      playCue("press");
    }
  },
  true
);

document.querySelectorAll(".dropdown-item").forEach((item) => {
  item.addEventListener("click", () => {
    closeMenus();
    promptInput.focus();
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

  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    sendMessage();
  }
});

composeBox.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

promptRow.addEventListener("click", () => {
  playCue("press");
  promptInput.focus();
});

promptInput.addEventListener("focus", syncPromptState);
promptInput.addEventListener("blur", syncPromptState);
promptInput.addEventListener("input", syncPromptState);
promptInput.addEventListener("scroll", updatePromptScrollState);

syncPromptState();
setStatusVisible(false);
renderThinkingOrb(statusOrb);
