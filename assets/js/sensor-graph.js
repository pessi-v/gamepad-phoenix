import { Socket } from "phoenix"

const el = document.getElementById("sensor-graph-data")
if (!el) {
  // Not on the sensor-graph page
} else {
  const sessionId = el.dataset.sessionId

  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`sensor_graph:${sessionId}`, {})
  channel.join()
    .receive("error", (err) => console.error("[SensorGraph] join error", err))

  window.addEventListener("beforeunload", () => channel.leave())

  const waitingEl  = document.getElementById("sensor-graph-waiting")
  const activeEl   = document.getElementById("sensor-graph-active")
  const enableBtn  = document.getElementById("sensor-graph-enable-btn")
  const statusText = waitingEl.querySelector("p")

  function setError(msg) {
    console.error("[SensorGraph]", msg)
    statusText.textContent = msg
  }

  let wakeLock = null
  async function requestWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request("screen")
    } catch (err) {
      console.warn("[SensorGraph] Wake lock failed:", err)
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wakeLock === null) requestWakeLock()
  })

  function startSensors() {
    if (typeof DeviceOrientationEvent === "undefined") {
      setError("Motion sensors not supported on this device")
      return
    }

    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission()
    }

    let started = false
    const timeout = setTimeout(() => {
      if (!started) setError("No motion data received. On Firefox iOS: Settings → Firefox → enable Motion & Orientation Access")
    }, 3000)

    let orientTick = 0
    window.addEventListener("deviceorientation", (e) => {
      if (!started) {
        started = true
        clearTimeout(timeout)
        requestWakeLock()
        channel.push("sensor_graph_join", {})
        waitingEl.classList.add("hidden")
        activeEl.classList.remove("hidden")
      }
      if (++orientTick % 2 !== 0) return
      channel.push("orient", {
        alpha: e.alpha || 0,
        beta:  e.beta  || 0,
        gamma: e.gamma || 0,
      })
    })

    let motionTick = 0
    window.addEventListener("devicemotion", (e) => {
      if (++motionTick % 2 !== 0) return
      const a  = e.acceleration || {}
      const rr = e.rotationRate || {}
      channel.push("motion", {
        ax: a.x  || 0, ay: a.y  || 0, az: a.z  || 0,
        rx: rr.beta  || 0, ry: rr.gamma || 0, rz: rr.alpha || 0,
      })
    })
  }

  enableBtn.addEventListener("click", startSensors)
}
