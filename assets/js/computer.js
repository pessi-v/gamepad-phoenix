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

  // Show pad URL as a link
  const urlEl = document.getElementById("pad-url")
  if (urlEl) {
    urlEl.textContent = padUrl
    urlEl.href = padUrl
  }

  // --- Game object ---
  const gameArea = document.getElementById("game-area")
  const gameObj = document.getElementById("game-object")
  const SPEED = 5
  const stick = { x: 0, y: 0 }
  let objX = 0, objY = 0
  let scale = 1
  let animFrame = null

  function spawnObject() {
    gameArea.classList.remove("hidden")
    requestAnimationFrame(() => {
      objX = gameArea.clientWidth / 2
      objY = gameArea.clientHeight / 2
      startLoop()
    })
  }

  function despawnObject() {
    stopLoop()
    gameArea.classList.add("hidden")
    stick.x = stick.y = 0
    scale = 1
    gameObj.style.removeProperty("background-color")
  }

  function startLoop() {
    if (animFrame) return
    function loop() {
      const half = gameObj.offsetWidth / 2
      objX = Math.max(half, Math.min(gameArea.clientWidth - half,  objX + stick.x * SPEED))
      objY = Math.max(half, Math.min(gameArea.clientHeight - half, objY + stick.y * SPEED))
      gameObj.style.left = objX + "px"
      gameObj.style.top = objY + "px"
      gameObj.style.transform = `translate(-50%, -50%) scale(${scale})`
      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  }

  // --- Channel ---
  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`game:${sessionId}`, {})

  channel.on("pad_connected", () => spawnObject())
  channel.on("pad_disconnected", () => despawnObject())

  channel.on("stick", ({ x, y }) => {
    stick.x = x
    stick.y = y
  })

  channel.on("button_down", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.add("btn-active")

    if (button === "a") scale = 1.6
    if (button === "b") gameObj.style.setProperty("background-color", "var(--color-error)")
  })

  channel.on("button_up", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.remove("btn-active")
    if (button === "a") scale = 1
    if (button === "b") gameObj.style.removeProperty("background-color")
  })

  channel
    .join()
    .receive("ok", () => console.log("[CS] joined game:" + sessionId))
    .receive("error", (err) => console.error("[CS] join error", err))
}
