export function init(channel) {
  const drawArea = document.getElementById("draw-area")
  const canvas   = document.getElementById("draw-canvas-desktop")
  const ctx      = canvas.getContext("2d")

  function setupCanvas() {
    // Preserve drawing content across resize
    const offscreen = document.createElement("canvas")
    offscreen.width  = canvas.width
    offscreen.height = canvas.height
    offscreen.getContext("2d").drawImage(canvas, 0, 0)

    canvas.width  = canvas.clientWidth
    canvas.height = canvas.clientHeight

    if (offscreen.width > 0 && offscreen.height > 0) {
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height)
    }

    ctx.strokeStyle = "#6366f1"
    ctx.lineWidth   = 3
    ctx.lineCap     = "round"
    ctx.lineJoin    = "round"
  }

  function toPixels(nx, ny) {
    return { x: nx * canvas.width, y: ny * canvas.height }
  }

  channel.on("draw_connected", () => {
    drawArea.classList.remove("hidden")
  })

  channel.on("draw_disconnected", () => {
    drawArea.classList.add("hidden")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  })

  channel.on("orientation", ({ portrait, ratio }) => {
    requestAnimationFrame(() => {
      if (portrait) {
        drawArea.style.flex  = "none"
        drawArea.style.width = Math.round(drawArea.clientHeight * ratio) + "px"
      } else {
        drawArea.style.flex  = ""
        drawArea.style.width = ""
      }
      setupCanvas()
    })
  })

  channel.on("draw_start", ({ x, y }) => {
    const p = toPixels(x, y)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  })

  channel.on("draw_move", ({ x, y }) => {
    const p = toPixels(x, y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  })

  channel.on("draw_end", () => {
    ctx.beginPath()
  })

  channel.on("draw_clear", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  })
}
