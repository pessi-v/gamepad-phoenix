import { Socket } from "phoenix"

const el = document.getElementById("draw-data")
if (!el) {
  // Not on the draw page
} else {
  const sessionId = el.dataset.sessionId

  const socket = new Socket("/socket", {})
  socket.connect()

  const channel = socket.channel(`draw:${sessionId}`, {})

  function pushOrientation() {
    channel.push("orientation", {
      portrait: window.matchMedia("(orientation: portrait)").matches,
      ratio: window.screen.width / window.screen.height,
    })
  }

  channel
    .join()
    .receive("ok", () => {
      console.log("[Draw] joined draw:" + sessionId)
      channel.push("draw_join", {})
      pushOrientation()
    })
    .receive("error", (err) => console.error("[Draw] join error", err))

  window.addEventListener("orientationchange", pushOrientation)

  window.addEventListener("beforeunload", () => channel.leave())

  const canvas = document.getElementById("draw-canvas")
  const ctx = canvas.getContext("2d")

  function resize() {
    // Preserve drawing across resize by saving/restoring image data
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    canvas.width  = canvas.clientWidth
    canvas.height = canvas.clientHeight
    ctx.putImageData(img, 0, 0)
    ctx.strokeStyle = "#6366f1"
    ctx.lineWidth   = 3
    ctx.lineCap     = "round"
    ctx.lineJoin    = "round"
  }

  resize()
  window.addEventListener("resize", resize)

  function normalizedPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top)  / rect.height,
    }
  }

  function localPos(nx, ny) {
    return { x: nx * canvas.width, y: ny * canvas.height }
  }

  // Local drawing
  let drawing = false

  function localStart(nx, ny) {
    drawing = true
    const { x, y } = localPos(nx, ny)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function localMove(nx, ny) {
    if (!drawing) return
    const { x, y } = localPos(nx, ny)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function localEnd() {
    drawing = false
    ctx.beginPath()
  }

  function localClear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Touch events
  let activeTouchId = null

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault()
    if (activeTouchId !== null) return
    const t = e.changedTouches[0]
    activeTouchId = t.identifier
    const { x, y } = normalizedPos(t.clientX, t.clientY)
    localStart(x, y)
    channel.push("draw_start", { x, y })
  }, { passive: false })

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault()
    const t = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
    if (!t) return
    const { x, y } = normalizedPos(t.clientX, t.clientY)
    localMove(x, y)
    channel.push("draw_move", { x, y })
  }, { passive: false })

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault()
    const t = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
    if (!t) return
    activeTouchId = null
    localEnd()
    channel.push("draw_end", {})
  }, { passive: false })

  // Mouse (desktop testing)
  canvas.addEventListener("mousedown", (e) => {
    const { x, y } = normalizedPos(e.clientX, e.clientY)
    localStart(x, y)
    channel.push("draw_start", { x, y })
  })

  window.addEventListener("mousemove", (e) => {
    if (!drawing) return
    const { x, y } = normalizedPos(e.clientX, e.clientY)
    localMove(x, y)
    channel.push("draw_move", { x, y })
  })

  window.addEventListener("mouseup", () => {
    if (!drawing) return
    localEnd()
    channel.push("draw_end", {})
  })

  // Clear button
  document.getElementById("clear-btn").addEventListener("click", () => {
    localClear()
    channel.push("draw_clear", {})
  })
}
