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

  // --- Sensor: accelerometer-driven physics ball with track game ---
  const sensorArea      = document.getElementById("sensor-area")
  const sensorBall      = document.getElementById("sensor-ball")
  const trackCanvas     = document.getElementById("track-canvas")
  const trackHud        = document.getElementById("track-hud")
  const trackScoreEl    = document.getElementById("track-score")
  const trackAccuracyEl = document.getElementById("track-accuracy")

  const ACCEL    = 0.4
  const FRICTION = 0.92
  const BOUNCE   = 0.5
  const CORRIDOR = 40   // half-width of track corridor in px
  const CP_RADIUS = 30  // checkpoint trigger radius in px

  // Tracks: normalized [x, y] waypoints in [0..1] × [0..1]
  const TRACKS = [
    [[0.10, 0.50], [0.30, 0.20], [0.50, 0.50], [0.70, 0.80], [0.90, 0.50]], // S-curve
    [[0.15, 0.20], [0.15, 0.75], [0.50, 0.75], [0.85, 0.75], [0.85, 0.20]], // U-shape
    [[0.10, 0.20], [0.90, 0.20], [0.10, 0.80], [0.90, 0.80]],               // Z-shape
    [[0.10, 0.50], [0.10, 0.15], [0.50, 0.15], [0.90, 0.15], [0.90, 0.85], [0.50, 0.85]], // L+
  ]

  let ballX = 0, ballY = 0, velX = 0, velY = 0
  let accelX = 0, accelY = 0, sensorFrame = null

  // Track game state
  let trackIdx = 0, nextCp = 1, onTrackF = 0, totalF = 0, trackScore = 0, trackActive = false

  function pixelWaypoints() {
    const w = sensorArea.clientWidth, h = sensorArea.clientHeight
    return TRACKS[trackIdx].map(([nx, ny]) => [nx * w, ny * h])
  }

  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, len2 = dx*dx + dy*dy
    if (len2 === 0) return Math.hypot(px - ax, py - ay)
    const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / len2))
    return Math.hypot(px - ax - t*dx, py - ay - t*dy)
  }

  function isOnTrack(bx, by, wps) {
    for (let i = 0; i < wps.length - 1; i++)
      if (distSeg(bx, by, ...wps[i], ...wps[i+1]) <= CORRIDOR) return true
    return false
  }

  function renderTrack(wps, ncp) {
    const ctx = trackCanvas.getContext("2d")
    const w = sensorArea.clientWidth, h = sensorArea.clientHeight
    trackCanvas.width = w; trackCanvas.height = h
    ctx.clearRect(0, 0, w, h)

    const drawPath = () => {
      ctx.beginPath()
      wps.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
    }

    // Corridor fill
    ctx.lineWidth = CORRIDOR * 2
    ctx.lineCap = "round"; ctx.lineJoin = "round"
    ctx.strokeStyle = "rgba(99,102,241,0.18)"
    drawPath(); ctx.stroke()

    // Dashed center line
    ctx.lineWidth = 1.5
    ctx.strokeStyle = "rgba(99,102,241,0.55)"
    ctx.setLineDash([6, 10])
    drawPath(); ctx.stroke()
    ctx.setLineDash([])

    // Waypoint dots
    wps.forEach(([x, y], i) => {
      const isEnd = i === wps.length - 1
      ctx.beginPath()
      ctx.arc(x, y, isEnd ? 12 : 8, 0, Math.PI * 2)
      if (i === 0) {
        ctx.fillStyle = "#facc15"                           // start: yellow
      } else if (i < ncp) {
        ctx.fillStyle = "#22c55e"                           // passed: green
      } else if (i === ncp && isEnd) {
        ctx.fillStyle = "#ef4444"                           // end & next: red
      } else if (i === ncp) {
        ctx.fillStyle = "#ffffff"                           // next target: white
      } else if (isEnd) {
        ctx.fillStyle = "rgba(239,68,68,0.45)"              // end & future: dim red
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.3)"             // future: dim
      }
      ctx.fill()
    })
  }

  function initTrack() {
    nextCp = 1; onTrackF = 0; totalF = 0; trackActive = true
    const wps = pixelWaypoints()
    ballX = wps[0][0]; ballY = wps[0][1]; velX = velY = 0
    renderTrack(wps, 1)
    trackHud.classList.remove("hidden")
    trackAccuracyEl.textContent = "--"
  }

  function finishTrack() {
    trackActive = false
    const pct = totalF > 0 ? Math.round(onTrackF / totalF * 100) : 0
    const pass = pct >= 90
    if (pass) { trackScore++; trackScoreEl.textContent = trackScore }
    renderTrack(pixelWaypoints(), TRACKS[trackIdx].length)  // show all as passed
    trackAccuracyEl.textContent = `${pct}% ${pass ? "✓" : "✗"}`
    setTimeout(() => {
      trackIdx = (trackIdx + 1) % TRACKS.length
      initTrack()
    }, 2000)
  }

  function spawnBall() {
    trackScore = 0; trackScoreEl.textContent = "0"; trackIdx = 0
    sensorArea.classList.remove("hidden")
    requestAnimationFrame(() => { initTrack(); startSensorLoop() })
  }

  function despawnBall() {
    stopSensorLoop()
    sensorArea.classList.add("hidden")
    trackHud.classList.add("hidden")
    trackActive = false
    accelX = accelY = 0
    const ctx = trackCanvas.getContext("2d")
    ctx.clearRect(0, 0, trackCanvas.width, trackCanvas.height)
  }

  function startSensorLoop() {
    if (sensorFrame) return
    function loop() {
      const half = sensorBall.offsetWidth / 2
      const w = sensorArea.clientWidth, h = sensorArea.clientHeight

      velX = (velX + accelX * ACCEL) * FRICTION
      velY = (velY + accelY * ACCEL) * FRICTION
      ballX += velX; ballY += velY

      if (ballX < half)     { ballX = half;     velX =  Math.abs(velX) * BOUNCE }
      if (ballX > w - half) { ballX = w - half; velX = -Math.abs(velX) * BOUNCE }
      if (ballY < half)     { ballY = half;     velY =  Math.abs(velY) * BOUNCE }
      if (ballY > h - half) { ballY = h - half; velY = -Math.abs(velY) * BOUNCE }

      sensorBall.style.left      = ballX + "px"
      sensorBall.style.top       = ballY + "px"
      sensorBall.style.transform = "translate(-50%, -50%)"

      // Track game logic (only count when ball is moving)
      if (trackActive && (Math.abs(velX) + Math.abs(velY)) > 0.05) {
        const wps = pixelWaypoints()
        totalF++
        if (isOnTrack(ballX, ballY, wps)) onTrackF++
        if (totalF % 15 === 0) trackAccuracyEl.textContent = Math.round(onTrackF / totalF * 100) + "%"

        const [cx, cy] = wps[nextCp]
        if (Math.hypot(ballX - cx, ballY - cy) < CP_RADIUS) {
          nextCp++
          renderTrack(wps, nextCp)
          if (nextCp >= wps.length) finishTrack()
        }
      }

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

  // --- Fish: 3D goldfish controlled by tilt ---
  const fishData  = document.getElementById("fish-data")
  const fishQrEl  = document.getElementById("fish-qr")
  if (fishData && fishQrEl && typeof QRCode !== "undefined") {
    new QRCode(fishQrEl, { text: fishData.dataset.fishUrl, width: 200, height: 200 })
  }

  const fishSessionId = fishData?.dataset.sessionId
  const fishChannel   = socket.channel(`fish:${fishSessionId}`, {})

  fishChannel.on("fish_connected",    () => window.dispatchEvent(new CustomEvent("fish:connected")))
  fishChannel.on("fish_disconnected", () => window.dispatchEvent(new CustomEvent("fish:disconnected")))
  fishChannel.on("accel", ({ x, y, z }) => window.dispatchEvent(new CustomEvent("fish:accel", { detail: { x, y, z } })))

  fishChannel
    .join()
    .receive("ok",    () => console.log("[CS] joined fish:" + fishSessionId))
    .receive("error", (err) => console.error("[CS] fish join error", err))
}
