// Demo that drives a game object using only the standard Gamepad API.
// This module has no knowledge of the channel or WebRTC — it just polls
// navigator.getGamepads() inside the animation loop, exactly as a real game would.
export function init() {
  const area = document.getElementById("gamepad-api-area")
  const obj  = document.getElementById("gamepad-api-object")
  const SPEED = 5
  let objX = 0, objY = 0, animFrame = null

  window.addEventListener("gamepadconnected", (e) => {
    console.log("[Gamepad API] connected:", e.gamepad.id)
    area.classList.remove("hidden")
    requestAnimationFrame(() => {
      objX = area.clientWidth  / 2
      objY = area.clientHeight / 2
      startLoop()
    })
  })

  window.addEventListener("gamepaddisconnected", (e) => {
    console.log("[Gamepad API] disconnected:", e.gamepad.id)
    stopLoop()
    area.classList.add("hidden")
  })

  function startLoop() {
    if (animFrame) return
    function loop() {
      const gp = navigator.getGamepads()[0]
      if (gp && gp.connected) {
        const half = obj.offsetWidth / 2
        objX = Math.max(half, Math.min(area.clientWidth  - half, objX + gp.axes[0] * SPEED))
        objY = Math.max(half, Math.min(area.clientHeight - half, objY + gp.axes[1] * SPEED))
        obj.style.left      = objX + "px"
        obj.style.top       = objY + "px"
        obj.style.transform = `translate(-50%, -50%) scale(${gp.buttons[0].pressed ? 1.6 : 1})`

        if (gp.buttons[1].pressed) {
          obj.style.setProperty("background-color", "var(--color-error)")
        } else {
          obj.style.removeProperty("background-color")
        }
      }
      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  }
}
