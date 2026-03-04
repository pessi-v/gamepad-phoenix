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
  const SPEED = 3
  const held = { up: false, down: false, left: false, right: false }
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
    held.up = held.down = held.left = held.right = false
    scale = 1
  }

  function startLoop() {
    if (animFrame) return
    function loop() {
      const half = gameObj.offsetWidth / 2
      if (held.up)    objY = Math.max(half, objY - SPEED)
      if (held.down)  objY = Math.min(gameArea.clientHeight - half, objY + SPEED)
      if (held.left)  objX = Math.max(half, objX - SPEED)
      if (held.right) objX = Math.min(gameArea.clientWidth - half, objX + SPEED)
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

  channel.on("button_down", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.add("btn-active")

    if (button in held) held[button] = true

    if (button === "a") {
      scale = 1.6
      setTimeout(() => { scale = 1 }, 150)
    }
    if (button === "b") {
      gameObj.style.setProperty("background-color", "var(--color-error)")
      setTimeout(() => gameObj.style.removeProperty("background-color"), 200)
    }
  })

  channel.on("button_up", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.remove("btn-active")
    if (button in held) held[button] = false
  })

  channel
    .join()
    .receive("ok", () => console.log("[CS] joined game:" + sessionId))
    .receive("error", (err) => console.error("[CS] join error", err))
}
