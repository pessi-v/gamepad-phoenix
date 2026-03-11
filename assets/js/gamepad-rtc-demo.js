export function init(channel) {
  const gamepadRtcArea = document.getElementById("gamepad-rtc-area")
  const gamepadRtcObj  = document.getElementById("gamepad-rtc-object")
  const SPEED = 5
  const stick = { x: 0, y: 0 }
  let objX = 0, objY = 0, scale = 1, animFrame = null

  function spawnObject() {
    gamepadRtcArea.classList.remove("hidden")
    requestAnimationFrame(() => {
      objX = gamepadRtcArea.clientWidth  / 2
      objY = gamepadRtcArea.clientHeight / 2
      startLoop()
    })
  }

  function despawnObject() {
    stopLoop()
    gamepadRtcArea.classList.add("hidden")
    stick.x = stick.y = 0
    scale = 1
    gamepadRtcObj.style.removeProperty("background-color")
  }

  function startLoop() {
    if (animFrame) return
    function loop() {
      const half = gamepadRtcObj.offsetWidth / 2
      objX = Math.max(half, Math.min(gamepadRtcArea.clientWidth  - half, objX + stick.x * SPEED))
      objY = Math.max(half, Math.min(gamepadRtcArea.clientHeight - half, objY + stick.y * SPEED))
      gamepadRtcObj.style.left      = objX + "px"
      gamepadRtcObj.style.top       = objY + "px"
      gamepadRtcObj.style.transform = `translate(-50%, -50%) scale(${scale})`
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
    if (button === "a") scale = 1.6
    if (button === "b") gamepadRtcObj.style.setProperty("background-color", "var(--color-error)")
  })

  channel.on("button_up", ({ button }) => {
    if (button === "a") scale = 1
    if (button === "b") gamepadRtcObj.style.removeProperty("background-color")
  })
}
