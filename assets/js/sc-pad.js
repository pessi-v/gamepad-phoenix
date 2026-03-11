import nipplejs from "nipplejs"
import { smartcontroller } from "smartcontroller"

const el = document.getElementById("sc-pad-data")
if (el) {
  const phone = new smartcontroller.SmartPhoneController()

  // --- Tab switching ---
  const tabs  = document.querySelectorAll("[data-tab]")
  const zones = document.querySelectorAll("[data-zone]")
  const zoneDisplay = { joystick: "block", nes: "block", touchpad: "flex", scroll: "flex" }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.toggle("tab-active", b === btn))
      zones.forEach((z) => {
        z.style.display = z.dataset.zone === btn.dataset.tab ? zoneDisplay[z.dataset.zone] : "none"
      })
    })
  })

  // --- Joystick (nipplejs) ---
  const manager = nipplejs.create({
    zone: document.getElementById("joystick-zone"),
    mode: "static",
    position: { left: "50%", top: "50%" },
    color: "white",
  })

  manager.on("move", (evt, data) => {
    phone.sendMessage({
      controller: "joystick",
      state: "move",
      joystick: {
        angle: data.angle,
        force: data.force,
        distance: data.distance,
        direction: data.direction,
      },
    })
  })

  manager.on("end", () => {
    phone.sendMessage({ controller: "joystick", state: "end" })
  })

  // --- NES buttons ---
  document.querySelectorAll("[data-nes-button]").forEach((btn) => {
    const button = btn.dataset.nesButton

    btn.addEventListener("touchstart", (e) => {
      e.preventDefault()
      phone.sendMessage({ controller: "nes", button, state: "start" })
    }, { passive: false })

    btn.addEventListener("touchend", (e) => {
      e.preventDefault()
      phone.sendMessage({ controller: "nes", button, state: "end" })
    }, { passive: false })

    btn.addEventListener("mousedown",  () => phone.sendMessage({ controller: "nes", button, state: "start" }))
    btn.addEventListener("mouseup",    () => phone.sendMessage({ controller: "nes", button, state: "end" }))
    btn.addEventListener("mouseleave", () => phone.sendMessage({ controller: "nes", button, state: "end" }))
  })

  // --- Touchpad ---
  const touchpadZone = document.getElementById("touchpad-zone")

  function touchCoords(e) {
    const rect = touchpadZone.getBoundingClientRect()
    return Array.from(e.touches).map((t) => [
      t.clientX - rect.left,
      t.clientY - rect.top,
    ])
  }

  touchpadZone.addEventListener("touchstart", (e) => {
    e.preventDefault()
    phone.sendMessage({ controller: "touchpad", state: "start", coordinates: touchCoords(e), fingers: e.touches.length })
  }, { passive: false })

  touchpadZone.addEventListener("touchmove", (e) => {
    e.preventDefault()
    phone.sendMessage({ controller: "touchpad", state: "move", coordinates: touchCoords(e), fingers: e.touches.length })
  }, { passive: false })

  touchpadZone.addEventListener("touchend", (e) => {
    e.preventDefault()
    phone.sendMessage({ controller: "touchpad", state: "end", coordinates: [], fingers: 0 })
  }, { passive: false })

  // --- Scroll ---
  const scrollZone = document.getElementById("scroll-zone")

  scrollZone.addEventListener("touchstart", (e) => {
    e.preventDefault()
    const t = e.touches[0]
    phone.sendMessage({ controller: "scroll", type: "touchpad", state: "start", coordinates: [[t.clientX, t.clientY]] })
  }, { passive: false })

  scrollZone.addEventListener("touchmove", (e) => {
    e.preventDefault()
    const t = e.touches[0]
    phone.sendMessage({ controller: "scroll", type: "touchpad", state: "move", coordinates: [[t.clientX, t.clientY]] })
  }, { passive: false })

  scrollZone.addEventListener("touchend", (e) => {
    e.preventDefault()
    phone.sendMessage({ controller: "scroll", type: "touchpad", state: "end", coordinates: [[0, 0]] })
  }, { passive: false })
}
