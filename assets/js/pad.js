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
    .receive("ok", () => {
      console.log("[PS] joined game:" + sessionId);
      channel.push("pad_join", {});
    })
    .receive("error", (err) => console.error("[PS] join error", err));

  window.addEventListener("beforeunload", () => channel.leave());

  // --- WebRTC (phone side) ---
  // If the desktop initiates a WebRTC offer we switch all game events to the
  // data channel so they bypass the server entirely.
  let pc = null;
  let dc = null;

  function send(event, payload) {
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ event, payload }));
    } else {
      channel.push(event, payload);
    }
  }

  channel.on("rtc_offer", async ({ sdp, type }) => {
    console.log("[PS] received rtc_offer, setting up WebRTC");
    pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    pc.ondatachannel = ({ channel: dataChannel }) => {
      dc = dataChannel;
      dc.onopen  = () => console.log("[PS] data channel open");
      dc.onclose = () => { dc = null; };
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) channel.push("rtc_ice", { candidate: candidate.toJSON() });
    };

    await pc.setRemoteDescription({ sdp, type });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    channel.push("rtc_answer", { sdp: answer.sdp, type: answer.type });
  });

  channel.on("rtc_ice", async ({ candidate }) => {
    if (pc) await pc.addIceCandidate(candidate);
  });

  // --- Thumbstick ---
  const base = document.getElementById("thumbstick-base");
  const nub = document.getElementById("thumbstick-nub");

  function stickMove(dx, dy) {
    const baseRadius = base.offsetWidth / 2;
    const nubRadius = nub.offsetWidth / 2;
    const maxDist = baseRadius - nubRadius;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    send("stick", { x: dx / maxDist, y: dy / maxDist });
  }

  function stickRelease() {
    nub.style.transform = "translate(-50%, -50%)";
    send("stick", { x: 0, y: 0 });
  }

  function offsetFromCenter(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);

    // In portrait mode, .pad-root is CSS-rotated 90°CW so the UI appears
    // landscape. Touch coords are in viewport (portrait) space, but
    // translate(dx, dy) on the nub applies in the element's local (rotated)
    // space. Convert viewport offsets → local coords via the inverse rotation.
    if (window.matchMedia("(orientation: portrait)").matches) {
      [dx, dy] = [dy, -dx];
    }

    return { dx, dy };
  }

  // Touch
  let activeTouchId = null;

  base.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (activeTouchId !== null) return;
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    const { dx, dy } = offsetFromCenter(t.clientX, t.clientY);
    stickMove(dx, dy);
  }, { passive: false });

  base.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const t = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId);
    if (!t) return;
    const { dx, dy } = offsetFromCenter(t.clientX, t.clientY);
    stickMove(dx, dy);
  }, { passive: false });

  base.addEventListener("touchend", (e) => {
    e.preventDefault();
    const t = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId);
    if (!t) return;
    activeTouchId = null;
    stickRelease();
  }, { passive: false });

  // Mouse (desktop testing)
  let mouseDragging = false;

  base.addEventListener("mousedown", (e) => {
    mouseDragging = true;
    const { dx, dy } = offsetFromCenter(e.clientX, e.clientY);
    stickMove(dx, dy);
  });

  window.addEventListener("mousemove", (e) => {
    if (!mouseDragging) return;
    const { dx, dy } = offsetFromCenter(e.clientX, e.clientY);
    stickMove(dx, dy);
  });

  window.addEventListener("mouseup", () => {
    if (!mouseDragging) return;
    mouseDragging = false;
    stickRelease();
  });

  // --- Select / Start buttons ---
  document.querySelectorAll("[data-button]").forEach((btn) => {
    const button = btn.dataset.button;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      send("button_down", { button });
    }, { passive: false });
    btn.addEventListener("pointerup",     () => send("button_up", { button }));
    btn.addEventListener("pointercancel", () => send("button_up", { button }));
  });

  // --- A/B button field ---
  // Left zone = B, right zone = A, middle overlap = both.
  // Each active pointer contributes independently so sliding across zones
  // naturally presses both buttons at once.
  const buttonField   = document.getElementById("button-field");
  const fieldBLight   = document.getElementById("field-b-highlight");
  const fieldALight   = document.getElementById("field-a-highlight");
  const activePointers = new Map(); // pointerId → { b, a }
  let fieldB = false, fieldA = false;

  function pointerZone(e) {
    const rect = buttonField.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    return { b: x < 0.55, a: x > 0.45 };
  }

  function syncField() {
    let b = false, a = false;
    for (const z of activePointers.values()) { if (z.b) b = true; if (z.a) a = true; }
    if (b !== fieldB) { send(b ? "button_down" : "button_up", { button: "b" }); fieldB = b; }
    if (a !== fieldA) { send(a ? "button_down" : "button_up", { button: "a" }); fieldA = a; }
    fieldBLight.style.background = b ? "rgba(234,179,8,0.35)"  : "";
    fieldALight.style.background = a ? "rgba(168,85,247,0.35)" : "";
  }

  buttonField.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    buttonField.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, pointerZone(e));
    syncField();
  }, { passive: false });

  buttonField.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, pointerZone(e));
    syncField();
  });

  buttonField.addEventListener("pointerup",     (e) => { activePointers.delete(e.pointerId); syncField(); });
  buttonField.addEventListener("pointercancel", (e) => { activePointers.delete(e.pointerId); syncField(); });
}
