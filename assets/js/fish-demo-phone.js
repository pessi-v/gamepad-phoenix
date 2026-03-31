import { Socket } from "phoenix"

const el = document.getElementById("fish-demo-data")
if (!el) {
  // Not on the fish-demo page
} else {
  const sessionId = el.dataset.sessionId

  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`fish_demo:${sessionId}`, {})
  channel.join()
    .receive("error", (err) => console.error("[FishDemo] join error", err))

  window.addEventListener("beforeunload", () => channel.leave())

  const waitingEl  = document.getElementById("fish-demo-waiting")
  const activeEl   = document.getElementById("fish-demo-active")
  const statusText = document.getElementById("fish-demo-status")

  function setError(msg) {
    console.error("[FishDemo]", msg)
    statusText.textContent = msg
  }

  let wakeLock = null
  async function requestWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request("screen")
    } catch (err) {
      console.warn("[FishDemo] Wake lock failed:", err)
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wakeLock === null) requestWakeLock()
  })

  let started = false

  // bfcache: when the page is restored from back-forward cache, JS state is
  // preserved (including started=true), so reset it to allow fish_demo_join
  // to be sent again on the next sensor event.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) started = false
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

    const timeout = setTimeout(() => {
      if (!started) setError("No motion data received. On Firefox iOS: Settings → Firefox → enable Motion & Orientation Access")
    }, 3000)

    let orientTick = 0
    window.addEventListener("deviceorientation", (e) => {
      if (!started) {
        started = true
        clearTimeout(timeout)
        requestWakeLock()
        channel.push("fish_demo_join", {})
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

  const needsGesture = typeof DeviceMotionEvent !== "undefined" &&
                       typeof DeviceMotionEvent.requestPermission === "function"

  if (needsGesture) {
    // iOS: requires explicit user gesture for permission
    waitingEl.addEventListener("click", startSensors, { once: true })
  } else {
    // Android / desktop: start immediately
    statusText.textContent = "Starting…"
    startSensors()
  }
}
