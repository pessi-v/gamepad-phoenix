import { Socket } from "phoenix"
import { init as initGamepadDemo } from "./gamepad-demo"
import { init as initSensorDemo } from "./sensor-demo"
import { init as initDrawDemo } from "./draw-demo"

const el = document.getElementById("cs-data")
if (!el) {
  // Not on the CS page
} else {
  const sessionId  = el.dataset.sessionId
  const padUrl     = el.dataset.padUrl
  const sensorUrl  = el.dataset.sensorUrl
  const drawUrl    = el.dataset.drawUrl

  // QR codes
  const qrEl = document.getElementById("qr-code")
  if (qrEl && typeof QRCode !== "undefined") {
    new QRCode(qrEl, { text: padUrl, width: 200, height: 200 })
  }
  const sensorQrEl = document.getElementById("sensor-qr")
  if (sensorQrEl && typeof QRCode !== "undefined") {
    new QRCode(sensorQrEl, { text: sensorUrl, width: 200, height: 200 })
  }
  const drawQrEl = document.getElementById("draw-qr")
  if (drawQrEl && typeof QRCode !== "undefined") {
    new QRCode(drawQrEl, { text: drawUrl, width: 200, height: 200 })
  }

  const socket = new Socket("/socket", {})
  socket.connect()

  const gameChannel = socket.channel(`game:${sessionId}`, {})
  gameChannel
    .join()
    .receive("ok",    () => console.log("[CS] joined game:" + sessionId))
    .receive("error", (err) => console.error("[CS] game join error", err))
  initGamepadDemo(gameChannel)

  const sensorChannel = socket.channel(`sensor:${sessionId}`, {})
  sensorChannel
    .join()
    .receive("ok",    () => console.log("[CS] joined sensor:" + sessionId))
    .receive("error", (err) => console.error("[CS] sensor join error", err))
  initSensorDemo(sensorChannel)

  const drawChannel = socket.channel(`draw:${sessionId}`, {})
  drawChannel
    .join()
    .receive("ok",    () => console.log("[CS] joined draw:" + sessionId))
    .receive("error", (err) => console.error("[CS] draw join error", err))
  initDrawDemo(drawChannel)
}
