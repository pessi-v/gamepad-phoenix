import { Socket } from "phoenix"

const el = document.getElementById("ra-data")
if (!el) {
  // Not on the RetroArch page
} else {
  const sessionId = el.dataset.sessionId
  const padUrl    = el.dataset.padUrl

  // QR code
  const qrEl = document.getElementById("ra-qr")
  if (qrEl && typeof QRCode !== "undefined") {
    new QRCode(qrEl, { text: padUrl, width: 160, height: 160 })
  }

  const statusEl = document.getElementById("ra-status")
  const iframe   = document.getElementById("retroarch-frame")

  function send(msg) {
    try {
      iframe.contentWindow.postMessage({ source: "gamepad-bridge", ...msg }, "*")
    } catch (_) {}
  }

  // Phoenix channel
  const socket = new Socket("/socket", {})
  socket.connect()
  const channel = socket.channel(`game:${sessionId}`, {})

  channel.on("pad_connected", () => {
    if (statusEl) statusEl.textContent = "Connected"
    send({ type: "connected" })
  })

  channel.on("pad_disconnected", () => {
    if (statusEl) statusEl.textContent = "Scan to connect"
    send({ type: "disconnected" })
  })

  channel.on("stick", ({ x, y }) => {
    send({ type: "stick", x, y })
  })

  channel.on("button_down", ({ button }) => {
    send({ type: "button_down", button })
  })

  channel.on("button_up", ({ button }) => {
    send({ type: "button_up", button })
  })

  channel
    .join()
    .receive("ok",    () => console.log("[RA] joined game:" + sessionId))
    .receive("error", (err) => console.error("[RA] join error", err))
}
