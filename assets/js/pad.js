import { Socket } from "phoenix";

// Prevent double-tap zoom on iOS (touch-action: manipulation is not enough)
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

// Prevent refresh on pull-down
document.addEventListener(
  "touchmove",
  function (e) {
    if (window.pageYOffset === 0) {
      e.preventDefault();
    }
  },
  { passive: false },
);

const el = document.getElementById("ps-data");
if (!el) {
  // Not on the PS page
} else {
  const sessionId = el.dataset.sessionId;

  const socket = new Socket("/socket", {});
  socket.connect();

  const channel = socket.channel(`game:${sessionId}`, {});

  channel
    .join()
    .receive("ok", () => console.log("[PS] joined game:" + sessionId))
    .receive("error", (err) => console.error("[PS] join error", err));

  function onDown(button) {
    channel.push("button_down", { button });
  }

  function onUp(button) {
    channel.push("button_up", { button });
  }

  document.querySelectorAll("[data-button]").forEach((btn) => {
    const button = btn.dataset.button;

    // Touch events (mobile)
    btn.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        onDown(button);
      },
      { passive: false },
    );

    btn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        onUp(button);
      },
      { passive: false },
    );

    // Mouse events (desktop testing)
    btn.addEventListener("mousedown", () => onDown(button));
    btn.addEventListener("mouseup", () => onUp(button));
    btn.addEventListener("mouseleave", () => onUp(button));
  });
}
