import { Socket } from "phoenix"

const el = document.getElementById("cs-data")
if (!el) {
  // Not on the CS page
} else {
  const sessionId = el.dataset.sessionId
  const padUrl = el.dataset.padUrl

  // Render QR code
  const qrEl = document.getElementById("qr-code")
  if (qrEl && typeof QRCode !== "undefined") {
    new QRCode(qrEl, { text: padUrl, width: 200, height: 200 })
  }

  // Show pad URL as a link too
  const urlEl = document.getElementById("pad-url")
  if (urlEl) {
    urlEl.textContent = padUrl
    urlEl.href = padUrl
  }

  // Join game channel as computer (receiver)
  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`game:${sessionId}`, {})

  channel.on("button_down", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.add("btn-active")
    console.log("[CS] button_down", button)
  })

  channel.on("button_up", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.remove("btn-active")
    console.log("[CS] button_up", button)
  })

  channel
    .join()
    .receive("ok", () => console.log("[CS] joined game:" + sessionId))
    .receive("error", (err) => console.error("[CS] join error", err))
}
