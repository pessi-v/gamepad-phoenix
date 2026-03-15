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

  // Create AudioContext immediately so we can read its native sample rate and
  // pass it to jsnes — mismatched rates (e.g. jsnes 44100 vs ctx 48000) cause
  // chronic underruns and crackling. It starts suspended; resumed on gesture.
  const sampleQueue = []
  const audioCtx = new AudioContext()

  function startAudio() {
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
    sampleRate: audioCtx.sampleRate,
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

  // Resume audio on any user interaction — satisfies autoplay policy without
  // requiring a dedicated click prompt.
  function resumeAudio() {
    audioCtx.resume()
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
      romPrompt.classList.add("hidden")
      soundPrompt?.classList.remove("hidden")
      startAudio()
      startLoop()
    })

  channel.on("pad_connected", () => {
    area.classList.remove("hidden")
    audioCtx.resume()
  })
  channel.on("pad_disconnected", () => {
    area.classList.add("hidden")
    audioCtx.suspend()
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
