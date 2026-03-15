// Installs a synthetic Gamepad into navigator.getGamepads() driven by the
// given channel (same interface as gamepad-rtc.js).
//
// After installation, any code that uses the standard Gamepad API will see
// the phone controller at index 0 — no knowledge of the channel required.
export function installGamepadShim(channel) {
  const NUM_BUTTONS = 17

  function makeButton(pressed = false) {
    return { pressed, touched: pressed, value: pressed ? 1.0 : 0.0 }
  }

  const gp = {
    id: "Phone Gamepad (WebRTC Shim)",
    index: 0,
    connected: false,
    mapping: "standard",
    timestamp: 0,
    axes: [0.0, 0.0, 0.0, 0.0],
    buttons: Array.from({ length: NUM_BUTTONS }, () => makeButton()),
  }

  // Shadow navigator.getGamepads on the instance so the prototype method is
  // still reachable for real hardware gamepads at slots 1–3.
  const originalGetGamepads = navigator.getGamepads.bind(navigator)

  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    writable: true,
    value() {
      const real = originalGetGamepads()
      return [
        gp.connected ? gp : null,
        real[1] ?? null,
        real[2] ?? null,
        real[3] ?? null,
      ]
    },
  })

  function dispatchGamepadEvent(name) {
    const event = new Event(name)
    Object.defineProperty(event, "gamepad", { value: gp })
    window.dispatchEvent(event)
  }

  channel.on("pad_connected", () => {
    gp.connected = true
    gp.axes = [0.0, 0.0, 0.0, 0.0]
    gp.buttons = Array.from({ length: NUM_BUTTONS }, () => makeButton())
    gp.timestamp = performance.now()
    dispatchGamepadEvent("gamepadconnected")
  })

  channel.on("pad_disconnected", () => {
    gp.connected = false
    gp.timestamp = performance.now()
    dispatchGamepadEvent("gamepaddisconnected")
  })

  channel.on("stick", ({ x, y }) => {
    gp.axes[0] = x
    gp.axes[1] = y
    gp.timestamp = performance.now()
  })

  channel.on("button_down", ({ button }) => {
    const idx = BUTTON_MAP[button]
    if (idx !== undefined) {
      gp.buttons[idx] = makeButton(true)
      gp.timestamp = performance.now()
    }
  })

  channel.on("button_up", ({ button }) => {
    const idx = BUTTON_MAP[button]
    if (idx !== undefined) {
      gp.buttons[idx] = makeButton(false)
      gp.timestamp = performance.now()
    }
  })
}

// Standard gamepad mapping (https://www.w3.org/TR/gamepad/#remapping)
const BUTTON_MAP = {
  a: 0,   // Bottom face button
  b: 1,   // Right face button
  x: 2,   // Left face button
  y: 3,   // Top face button
}
