export function init(channel) {
  const gameArea = document.getElementById("game-area")
  const gameObj  = document.getElementById("game-object")
  const SPEED    = 5
  const stick    = { x: 0, y: 0 }
  let objX = 0, objY = 0, scale = 1, animFrame = null

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
      objX = Math.max(half, Math.min(gameArea.clientWidth  - half, objX + stick.x * SPEED))
      objY = Math.max(half, Math.min(gameArea.clientHeight - half, objY + stick.y * SPEED))
      gameObj.style.left      = objX + "px"
      gameObj.style.top       = objY + "px"
      gameObj.style.transform = `translate(-50%, -50%) scale(${scale})`
      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  }

  channel.on("pad_connected",    () => spawnObject())
  channel.on("pad_disconnected", () => despawnObject())
  channel.on("stick", ({ x, y }) => { stick.x = x; stick.y = y })

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
}
