import { Socket } from "phoenix"

const el = document.getElementById("sensor-data")
if (!el) {
  // Not on the sensor page
} else {
  const sessionId = el.dataset.sessionId

  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`sensor:${sessionId}`, {})
  channel.join()
    .receive("error", (err) => console.error("[Sensor] join error", err))

  window.addEventListener("beforeunload", () => channel.leave())

  const waitingEl  = document.getElementById("sensor-waiting")
  const activeEl   = document.getElementById("sensor-active")
  const enableBtn  = document.getElementById("enable-btn")
  const statusText = waitingEl.querySelector("p")

  function setError(msg) {
    console.error("[Sensor]", msg)
    statusText.textContent = msg
  }

  function startSensors() {
    if (typeof DeviceOrientationEvent === "undefined") {
      setError("Motion sensors not supported on this device")
      return
    }

    // Trigger the iOS permission dialog. Use DeviceMotionEvent (covers both
    // motion + orientation on iOS). Don't await or check the result — just
    // fire and immediately add the listener, same as the working reference demo.
    // Firefox iOS returns "denied" silently but events still fire if Motion &
    // Orientation Access is enabled for Firefox in iOS Settings.
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission()
    }

    // Transition UI only once the first event actually fires, so we can detect
    // the case where events never arrive (e.g. OS-level permission denied).
    let started = false
    const timeout = setTimeout(() => {
      if (!started) setError("No motion data received. On Firefox iOS: Settings → Firefox → enable Motion & Orientation Access")
    }, 3000)

    window.addEventListener("deviceorientation", (e) => {
      if (!started) {
        started = true
        clearTimeout(timeout)
        channel.push("sensor_join", {})
        waitingEl.classList.add("hidden")
        activeEl.classList.remove("hidden")
      }
      // gamma: left/right tilt (-90..90°), beta: front/back tilt (-180..180°)
      const x = Math.max(-1, Math.min(1, (e.gamma || 0) / 45))
      const y = Math.max(-1, Math.min(1, (e.beta  || 0) / 45))
      channel.push("accel", { x, y })
    })
  }

  enableBtn.addEventListener("click", startSensors)
}
