import * as jsnes from "jsnes"

export function init(channel) {
  const area        = document.getElementById("nes-area")
  const canvas      = document.getElementById("nes-canvas")
  const romPrompt   = document.getElementById("nes-rom-prompt")
  const soundPrompt = document.getElementById("nes-sound-prompt")
  if (!area || !canvas) return

  canvas.width  = 256
  canvas.height = 240
  const ctx       = canvas.getContext("2d")
  const imageData = ctx.createImageData(256, 240)
  const buf       = new ArrayBuffer(256 * 240 * 4)
  const buf8      = new Uint8ClampedArray(buf)
  const buf32     = new Uint32Array(buf)

  // Audio — plain ScriptProcessorNode avoids Blob URL / CSP issues with
  // AudioWorklet. Created on first click to satisfy the autoplay policy.
  const sampleQueue = []
  let audioCtx = null

  function startAudio() {
    audioCtx = new AudioContext()
    const processor = audioCtx.createScriptProcessor(4096, 0, 1)
    processor.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0)
      for (let i = 0; i < out.length; i++) {
        out[i] = sampleQueue.length > 0 ? sampleQueue.shift() : 0
      }
    }
    processor.connect(audioCtx.destination)
  }

  const nes = new jsnes.NES({
    emulateSound: true,
    sampleRate: 44100,
    onAudioSample: (left, right) => {
      sampleQueue.push((left + right) / 2)
      // Prevent unbounded growth if audio isn't started yet
      if (sampleQueue.length > 8192) sampleQueue.splice(0, 4096)
    },
    onFrame(frameBuffer) {
      for (let i = 0; i < 256 * 240; i++) {
        buf32[i] = 0xff000000 | frameBuffer[i]
      }
      imageData.data.set(buf8)
      ctx.putImageData(imageData, 0, 0)
    },
  })

  // Stick → D-pad with threshold
  const THRESHOLD = 0.5
  let dpad = { up: false, down: false, left: false, right: false }
  const DPAD_BTNS = {
    up:    jsnes.Controller.BUTTON_UP,
    down:  jsnes.Controller.BUTTON_DOWN,
    left:  jsnes.Controller.BUTTON_LEFT,
    right: jsnes.Controller.BUTTON_RIGHT,
  }

  function applyDpad(x, y) {
    const next = {
      up:    y < -THRESHOLD,
      down:  y >  THRESHOLD,
      left:  x < -THRESHOLD,
      right: x >  THRESHOLD,
    }
    for (const dir of Object.keys(DPAD_BTNS)) {
      if (next[dir] && !dpad[dir]) nes.buttonDown(1, DPAD_BTNS[dir])
      if (!next[dir] && dpad[dir])  nes.buttonUp(1,   DPAD_BTNS[dir])
    }
    dpad = next
  }

  area.addEventListener("click", () => {
    startAudio()
    soundPrompt.classList.add("hidden")
  }, { once: true })

  fetch("/assets/mario-adventure-3.nes")
    .then(r => r.arrayBuffer())
    .then(romBuf => {
      const bytes = new Uint8Array(romBuf)
      let str = ""
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
      nes.loadROM(str)
      romPrompt.classList.add("hidden")
      soundPrompt.classList.remove("hidden")
      startLoop()
    })

  channel.on("pad_connected",    () => area.classList.remove("hidden"))
  channel.on("pad_disconnected", () => { stopLoop(); area.classList.add("hidden") })
  channel.on("stick", ({ x, y }) => applyDpad(x, y))

  const BUTTON_MAP = {
    a:      jsnes.Controller.BUTTON_A,
    b:      jsnes.Controller.BUTTON_B,
    start:  jsnes.Controller.BUTTON_START,
    select: jsnes.Controller.BUTTON_SELECT,
  }

  channel.on("button_down", ({ button }) => {
    const btn = BUTTON_MAP[button]
    if (btn !== undefined) nes.buttonDown(1, btn)
  })

  channel.on("button_up", ({ button }) => {
    const btn = BUTTON_MAP[button]
    if (btn !== undefined) nes.buttonUp(1, btn)
  })

  let animFrame = null

  function startLoop() {
    if (animFrame) return
    function loop() {
      nes.frame()
      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  }
}
