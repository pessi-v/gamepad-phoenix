import { Socket } from "phoenix"

const el = document.getElementById("cs-data")
if (!el) {
  // Not on the CS page
} else {
  const sessionId  = el.dataset.sessionId
  const padUrl     = el.dataset.padUrl
  const sensorUrl  = el.dataset.sensorUrl

  // QR codes
  const qrEl = document.getElementById("qr-code")
  if (qrEl && typeof QRCode !== "undefined") {
    new QRCode(qrEl, { text: padUrl, width: 200, height: 200 })
  }
  const sensorQrEl = document.getElementById("sensor-qr")
  if (sensorQrEl && typeof QRCode !== "undefined") {
    new QRCode(sensorQrEl, { text: sensorUrl, width: 200, height: 200 })
  }

  const socket = new Socket("/socket", {})
  socket.connect()

  // --- Gamepad: thumbstick-driven object ---
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

  const gameChannel = socket.channel(`game:${sessionId}`, {})

  gameChannel.on("pad_connected",    () => spawnObject())
  gameChannel.on("pad_disconnected", () => despawnObject())
  gameChannel.on("stick", ({ x, y }) => { stick.x = x; stick.y = y })

  gameChannel.on("button_down", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.add("btn-active")
    if (button === "a") scale = 1.6
    if (button === "b") gameObj.style.setProperty("background-color", "var(--color-error)")
  })

  gameChannel.on("button_up", ({ button }) => {
    const btn = document.querySelector(`[data-state="${button}"]`)
    if (btn) btn.classList.remove("btn-active")
    if (button === "a") scale = 1
    if (button === "b") gameObj.style.removeProperty("background-color")
  })

  gameChannel
    .join()
    .receive("ok",   () => console.log("[CS] joined game:" + sessionId))
    .receive("error", (err) => console.error("[CS] game join error", err))

  // --- Sensor: accelerometer-driven physics ball ---
  const sensorArea = document.getElementById("sensor-area")
  const sensorBall = document.getElementById("sensor-ball")
  const ACCEL   = 0.4
  const FRICTION = 0.92
  const BOUNCE  = 0.5
  let ballX = 0, ballY = 0, velX = 0, velY = 0
  let accelX = 0, accelY = 0, sensorFrame = null

  function spawnBall() {
    sensorArea.classList.remove("hidden")
    requestAnimationFrame(() => {
      ballX = sensorArea.clientWidth / 2
      ballY = sensorArea.clientHeight / 2
      velX = velY = 0
      startSensorLoop()
    })
  }

  function despawnBall() {
    stopSensorLoop()
    sensorArea.classList.add("hidden")
    accelX = accelY = 0
  }

  function startSensorLoop() {
    if (sensorFrame) return
    function loop() {
      const half = sensorBall.offsetWidth / 2
      const w = sensorArea.clientWidth
      const h = sensorArea.clientHeight

      velX = (velX + accelX * ACCEL) * FRICTION
      velY = (velY + accelY * ACCEL) * FRICTION
      ballX += velX
      ballY += velY

      if (ballX < half)     { ballX = half;     velX =  Math.abs(velX) * BOUNCE }
      if (ballX > w - half) { ballX = w - half; velX = -Math.abs(velX) * BOUNCE }
      if (ballY < half)     { ballY = half;     velY =  Math.abs(velY) * BOUNCE }
      if (ballY > h - half) { ballY = h - half; velY = -Math.abs(velY) * BOUNCE }

      sensorBall.style.left      = ballX + "px"
      sensorBall.style.top       = ballY + "px"
      sensorBall.style.transform = "translate(-50%, -50%)"
      sensorFrame = requestAnimationFrame(loop)
    }
    sensorFrame = requestAnimationFrame(loop)
  }

  function stopSensorLoop() {
    if (sensorFrame) { cancelAnimationFrame(sensorFrame); sensorFrame = null }
  }

  const sensorChannel = socket.channel(`sensor:${sessionId}`, {})

  sensorChannel.on("sensor_connected",    () => spawnBall())
  sensorChannel.on("sensor_disconnected", () => despawnBall())
  sensorChannel.on("accel", ({ x, y }) => { accelX = x; accelY = y })

  sensorChannel
    .join()
    .receive("ok",   () => console.log("[CS] joined sensor:" + sessionId))
    .receive("error", (err) => console.error("[CS] sensor join error", err))
}
