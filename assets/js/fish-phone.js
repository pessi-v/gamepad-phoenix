import { Socket } from "phoenix"

const el = document.getElementById("fish-phone-data")
if (!el) {
  // Not on the fish phone page
} else {
  const sessionId = el.dataset.sessionId

  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`fish:${sessionId}`, {})
  channel.join()
    .receive("error", (err) => console.error("[Fish] join error", err))

  window.addEventListener("beforeunload", () => channel.leave())

  const waitingEl  = document.getElementById("fish-waiting")
  const activeEl   = document.getElementById("fish-active")
  const enableBtn  = document.getElementById("fish-enable-btn")
  const statusText = waitingEl.querySelector("p")

  function setError(msg) {
    console.error("[Fish]", msg)
    statusText.textContent = msg
  }

  function startSensors() {
    if (typeof DeviceOrientationEvent === "undefined" || typeof DeviceMotionEvent === "undefined") {
      setError("Motion sensors not supported on this device")
      return
    }

    if (typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission()
    }

    let started = false
    let accelX = 0, accelY = 0   // latest accelerometer readings
    let alpha = 0                  // latest compass heading

    const timeout = setTimeout(() => {
      if (!started) setError("No motion data received. On Firefox iOS: Settings → Firefox → enable Motion & Orientation Access")
    }, 3000)

    // Accelerometer: x/y swimming speed
    window.addEventListener("devicemotion", (e) => {
      const a = e.accelerationIncludingGravity
      if (!a) return
      // Normalize by g (~9.8 m/s²) to get roughly [-1, 1]
      accelX = (a.x || 0) / 9.8
      accelY = (a.y || 0) / 9.8
    })

    // Orientation: alpha for yaw rotation
    window.addEventListener("deviceorientation", (e) => {
      if (!started) {
        started = true
        clearTimeout(timeout)
        channel.push("fish_join", {})
        waitingEl.classList.add("hidden")
        activeEl.classList.remove("hidden")
      }
      alpha = e.alpha || 0
      channel.push("accel", { x: accelX, y: accelY, z: alpha })
    })
  }

  enableBtn.addEventListener("click", startSensors)
}
