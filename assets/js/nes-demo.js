import * as jsnes from "jsnes"

export function init(channel) {
  const wrapper     = document.getElementById("nes-wrapper")
  const area        = document.getElementById("nes-area")
  const canvas      = document.getElementById("nes-canvas")
  const romPrompt   = document.getElementById("nes-rom-prompt")
  const soundPrompt = document.getElementById("nes-sound-prompt")
  const saveBtn     = document.getElementById("nes-save-btn")
  const loadBtn     = document.getElementById("nes-load-btn")
  if (!area || !canvas) return

  const SAVE_KEY = "nes-quicksave"

  // State received from phone before ROM is ready is held here and applied on load.
  let pendingState = null
  let romReady = false

  function applyState(json) {
    if (romReady) nes.fromJSON(JSON.parse(json))
    else pendingState = json
  }

  function quickSave() {
    const json = JSON.stringify(nes.toJSON())
    localStorage.setItem(SAVE_KEY, json)
    channel.send("nes_save_state", { state: json })
    loadBtn.disabled = false
  }

  function quickLoad() {
    const data = localStorage.getItem(SAVE_KEY)
    if (data) applyState(data)
  }

  channel.on("nes_save_state", ({ state }) => {
    localStorage.setItem(SAVE_KEY, state)
    loadBtn.disabled = false
    applyState(state)
  })

  saveBtn.addEventListener("click", quickSave)
  loadBtn.addEventListener("click", quickLoad)

  // Check for an existing save on init
  if (localStorage.getItem(SAVE_KEY)) loadBtn.disabled = false

  document.addEventListener("keydown", (e) => {
    if (e.key === "s" || e.key === "S") quickSave()
    if (e.key === "r" || e.key === "R") quickLoad()
  })

  canvas.width  = 256
  canvas.height = 240
  const ctx       = canvas.getContext("2d")
  const imageData = ctx.createImageData(256, 240)
  const buf       = new ArrayBuffer(256 * 240 * 4)
  const buf8      = new Uint8ClampedArray(buf)
  const buf32     = new Uint32Array(buf)

  // AudioContext is created lazily on the first user gesture to avoid the
  // hardware-init pop that occurs when constructing it at page load.
  // We fix the NES sample rate at 44100 and force the context to match,
  // preventing the underrun/crackling from a rate mismatch.
  const NES_SAMPLE_RATE = 44100
  const sampleQueue = []
  let audioCtx = null
  let audioStarted = false

  function ensureAudioCtx() {
    if (!audioCtx) audioCtx = new AudioContext({ sampleRate: NES_SAMPLE_RATE })
    return audioCtx
  }

  function startAudio() {
    const ctx = ensureAudioCtx()
    const processor = ctx.createScriptProcessor(4096, 0, 1)
    processor.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0)
      for (let i = 0; i < out.length; i++) {
        out[i] = sampleQueue.length > 0 ? sampleQueue.shift() : 0
      }
    }
    processor.connect(ctx.destination)
  }

  const nes = new jsnes.NES({
    emulateSound: true,
    sampleRate: NES_SAMPLE_RATE,
    onAudioSample: (left, right) => {
      sampleQueue.push((left + right) / 2)
      // Prevent unbounded growth while audio is suspended
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

  // On the first user gesture: create the AudioContext, start the audio
  // pipeline, and resume playback. Subsequent calls just resume.
  function resumeAudio() {
    if (wrapper.classList.contains("hidden")) return
    if (!audioStarted && romReady) {
      startAudio()
      audioStarted = true
    }
    ensureAudioCtx().resume()
    soundPrompt?.classList.add("hidden")
  }
  window.addEventListener("pointerdown", resumeAudio)
  window.addEventListener("keydown",     resumeAudio)

  fetch("/roms/mario-adventure-3.nes")
    .then(r => r.arrayBuffer())
    .then(romBuf => {
      const bytes = new Uint8Array(romBuf)
      let str = ""
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
      nes.loadROM(str)
      romReady = true
      if (pendingState) { nes.fromJSON(JSON.parse(pendingState)); pendingState = null }
      romPrompt.classList.add("hidden")
      soundPrompt?.classList.remove("hidden")
      // startAudio() is deferred to the first user gesture via resumeAudio()
      startLoop()
    })

  channel.on("pad_connected", () => {
    wrapper.classList.remove("hidden")
    wrapper.classList.add("flex")
    audioCtx?.resume()
  })
  channel.on("pad_disconnected", () => {
    wrapper.classList.add("hidden")
    wrapper.classList.remove("flex")
    audioCtx?.suspend()
  })
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
      try {
        nes.frame()
      } catch (e) {
        console.error("[NES] emulator error:", e)
      }
      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }
}
