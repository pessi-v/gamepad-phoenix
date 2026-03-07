import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

export function init(channel) {
  const graphArea   = document.getElementById("graph-area")
  const graphCanvas = document.getElementById("graph-canvas")
  const fishCanvas  = document.getElementById("fish-canvas")

  // ── Graph ─────────────────────────────────────────────────────────────────

  const MAX_POINTS = 200
  const ROWS = [
    {
      label:        "Orientation (°)",
      keys:         ["beta", "gamma", "alpha"],
      seriesLabels: ["β", "γ", "α"],
      range:        180,
      colors:       ["#f87171", "#4ade80", "#60a5fa"],
    },
    {
      label:        "Acceleration (m/s²)",
      keys:         ["ax", "ay", "az"],
      seriesLabels: ["x", "y", "z"],
      range:        20,
      colors:       ["#f87171", "#4ade80", "#60a5fa"],
    },
    {
      label:        "Rotation (°/s)",
      keys:         ["rx", "ry", "rz"],
      seriesLabels: ["x", "y", "z"],
      range:        360,
      colors:       ["#f87171", "#4ade80", "#60a5fa"],
    },
  ]

  const data = {}
  for (const row of ROWS)
    for (const key of row.keys)
      data[key] = new Array(MAX_POINTS).fill(0)

  function push(key, val) {
    data[key].push(val != null ? val : 0)
    if (data[key].length > MAX_POINTS) data[key].shift()
  }

  function renderGraph() {
    const W = graphArea.clientWidth
    const H = graphArea.clientHeight
    if (graphCanvas.width  !== W) graphCanvas.width  = W
    if (graphCanvas.height !== H) graphCanvas.height = H

    const ctx = graphCanvas.getContext("2d")
    ctx.clearRect(0, 0, W, H)

    const LEFT    = 46
    const RIGHT   = 12
    const LABEL_H = 16
    const ROW_GAP = 8
    const plotW   = W - LEFT - RIGHT
    const rowH    = Math.floor((H - ROW_GAP * (ROWS.length - 1)) / ROWS.length)
    const plotH   = rowH - LABEL_H

    ROWS.forEach((row, ri) => {
      const rowTop  = ri * (rowH + ROW_GAP)
      const plotTop = rowTop + LABEL_H
      const mid     = plotTop + plotH / 2

      ctx.fillStyle = "rgba(255,255,255,0.04)"
      ctx.fillRect(LEFT, plotTop, plotW, plotH)

      ctx.strokeStyle = "rgba(255,255,255,0.15)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(LEFT, mid)
      ctx.lineTo(LEFT + plotW, mid)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = "rgba(255,255,255,0.3)"
      ctx.font = "9px monospace"
      ctx.textAlign = "right"
      ctx.fillText(`+${row.range}`, LEFT - 2, plotTop + 8)
      ctx.fillText(`-${row.range}`, LEFT - 2, plotTop + plotH)
      ctx.textAlign = "left"

      ctx.fillStyle = "rgba(255,255,255,0.55)"
      ctx.font = "11px monospace"
      ctx.fillText(row.label, LEFT, rowTop + 11)

      let xCursor = LEFT + ctx.measureText(row.label + "   ").width
      row.keys.forEach((key, ki) => {
        const cur    = data[key][data[key].length - 1]
        const valStr = `${row.seriesLabels[ki]}:${cur >= 0 ? "+" : ""}${cur.toFixed(1)}  `
        ctx.fillStyle = row.colors[ki]
        ctx.fillText(valStr, xCursor, rowTop + 11)
        xCursor += ctx.measureText(valStr).width
      })

      row.keys.forEach((key, ki) => {
        const vals = data[key]
        ctx.strokeStyle = row.colors[ki]
        ctx.lineWidth = 1.5
        ctx.beginPath()
        vals.forEach((v, i) => {
          const x = LEFT + (i / (MAX_POINTS - 1)) * plotW
          const y = mid - Math.max(-1, Math.min(1, v / row.range)) * (plotH / 2)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
      })
    })
  }

  // ── Fish (Three.js) ───────────────────────────────────────────────────────

  const renderer = new THREE.WebGLRenderer({ canvas: fishCanvas, antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(0x000000, 0)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 0, 5)

  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const dirLight = new THREE.DirectionalLight(0xffffff, 2)
  dirLight.position.set(2, 4, 3)
  scene.add(dirLight)

  let fish = null
  const orientation = { alpha: 0, beta: 0, gamma: 0 }

  // Fish position physics (world units)
  let posX = 0, posY = 0, posZ = 0
  let velX = 0, velY = 0, velZ = 0
  let latestAx = 0, latestAy = 0, latestAz = 0
  const ACCEL    = 0.001
  const FRICTION = 0.93

  const loader = new GLTFLoader()
  loader.load("/assets/Goldfish.glb", (gltf) => {
    const pivot = new THREE.Group()
    gltf.scene.rotation.y = Math.PI
    const box    = new THREE.Box3().setFromObject(gltf.scene)
    const centre = box.getCenter(new THREE.Vector3())
    const size   = box.getSize(new THREE.Vector3()).length()
    gltf.scene.position.sub(centre)
    gltf.scene.scale.setScalar(0.5 / size)
    pivot.add(gltf.scene)
    scene.add(pivot)
    fish = pivot
  })

  function frustumHalfSize() {
    const depth = camera.position.z - posZ
    const halfH = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    return { halfH, halfW: halfH * camera.aspect }
  }

  let rendererW = 0, rendererH = 0
  function resizeFish() {
    const W = window.innerWidth, H = window.innerHeight
    if (rendererW !== W || rendererH !== H) {
      rendererW = W; rendererH = H
      renderer.setSize(W, H)
      camera.aspect = W / H
      camera.updateProjectionMatrix()
    }
  }

  function renderFish() {
    resizeFish()

    if (fish) {
      // Integrate acceleration → velocity → position in all three axes
      velX = (velX + latestAx * ACCEL) * FRICTION
      velY = (velY + latestAy * ACCEL) * FRICTION
      velZ = (velZ + latestAz * ACCEL) * FRICTION
      posX += velX
      posY += velY
      posZ += velZ

      // Z bounds: keep fish between z=-4 (far) and z=3 (close, still in front of camera at z=5)
      if (posZ < -4) { posZ = -4; velZ =  Math.abs(velZ) * 0.4 }
      if (posZ >  3) { posZ =  3; velZ = -Math.abs(velZ) * 0.4 }

      // XY bounds scale with depth so the fish stays in the visible frustum
      const { halfW, halfH } = frustumHalfSize()
      const bx = halfW * 0.85, by = halfH * 0.85
      if (posX < -bx) { posX = -bx; velX =  Math.abs(velX) * 0.4 }
      if (posX >  bx) { posX =  bx; velX = -Math.abs(velX) * 0.4 }
      if (posY < -by) { posY = -by; velY =  Math.abs(velY) * 0.4 }
      if (posY >  by) { posY =  by; velY = -Math.abs(velY) * 0.4 }

      fish.position.set(posX, posY, posZ)

      fish.rotation.order = "YXZ"
      fish.rotation.y = THREE.MathUtils.degToRad(orientation.alpha)
      fish.rotation.x = THREE.MathUtils.degToRad(orientation.beta)
      fish.rotation.z = THREE.MathUtils.degToRad(orientation.gamma)
    }

    renderer.render(scene, camera)
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  let rafId = null

  function startLoop() {
    if (rafId) return
    fishCanvas.style.display = "block"
    function loop() {
      renderGraph()
      renderFish()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    fishCanvas.style.display = "none"
    for (const row of ROWS)
      for (const key of row.keys)
        data[key].fill(0)
    orientation.alpha = orientation.beta = orientation.gamma = 0
    posX = posY = posZ = velX = velY = velZ = latestAx = latestAy = latestAz = 0
    if (fish) fish.position.set(0, 0, 0)
  }

  // ── Channel ───────────────────────────────────────────────────────────────

  channel.on("sensor_graph_connected",    () => { graphArea.classList.remove("hidden"); startLoop() })
  channel.on("sensor_graph_disconnected", () => { stopLoop(); graphArea.classList.add("hidden") })

  channel.on("orient", ({ alpha, beta, gamma }) => {
    orientation.alpha = alpha || 0
    orientation.beta  = beta  || 0
    orientation.gamma = gamma || 0
    push("beta",  beta)
    push("gamma", gamma)
    push("alpha", alpha)
  })

  channel.on("motion", ({ ax, ay, az, rx, ry, rz }) => {
    latestAx = ax || 0
    latestAy = ay || 0
    latestAz = az || 0
    push("ax", ax); push("ay", ay); push("az", az)
    push("rx", rx); push("ry", ry); push("rz", rz)
  })
}
