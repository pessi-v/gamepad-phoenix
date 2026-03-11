import { smartcontroller } from "smartcontroller";
import QRCode from "easyqrcodejs";

export function init(scPadUrl) {
  const scArea = document.getElementById("sc-area");
  const scObj = document.getElementById("sc-object");

  const SPEED = 5;
  const stick = { x: 0, y: 0 };
  const nesButtons = { up: false, down: false, left: false, right: false };
  let objX = 0, objY = 0, animFrame = null;

  const sc = new smartcontroller.SmartController();

  sc.peerConnection.on("open", (id) => {
    const scQrEl = document.getElementById("sc-qr");
    const url = scPadUrl + "?id=" + id + "&playerid=null&throttle=0";
    new QRCode(scQrEl, { text: url, width: 200, height: 200 });
  });

  function spawnObject() {
    scArea.classList.remove("hidden");
    requestAnimationFrame(() => {
      objX = scArea.clientWidth / 2;
      objY = scArea.clientHeight / 2;
      startLoop();
    });
  }

  function despawnObject() {
    stopLoop();
    scArea.classList.add("hidden");
    stick.x = stick.y = 0;
    Object.keys(nesButtons).forEach((k) => (nesButtons[k] = false));
  }

  function startLoop() {
    if (animFrame) return;
    function loop() {
      const half = scObj.offsetWidth / 2;
      objX = Math.max(
        half,
        Math.min(scArea.clientWidth - half, objX + stick.x * SPEED),
      );
      objY = Math.max(
        half,
        Math.min(scArea.clientHeight - half, objY + stick.y * SPEED),
      );
      scObj.style.left = objX + "px";
      scObj.style.top = objY + "px";
      scObj.style.transform = `translate(-50%, -50%)`;
      animFrame = requestAnimationFrame(loop);
    }
    animFrame = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  sc.on("connection", () => spawnObject());
  sc.on("close", () => despawnObject());

  sc.on("data", ({ data }) => {
    const msg = data.data;

    if (msg.controller === "joystick") {
      if (msg.state === "move") {
        stick.x = Math.cos(msg.joystick.angle.radian) * Math.min(msg.joystick.force, 1);
        stick.y = -Math.sin(msg.joystick.angle.radian) * Math.min(msg.joystick.force, 1);
      } else if (msg.state === "end") {
        stick.x = stick.y = 0;
      }
    }

    if (msg.controller === "nes") {
      if (msg.button in nesButtons) {
        nesButtons[msg.button] = msg.state === "start";
        stick.x = (nesButtons.right ? 1 : 0) - (nesButtons.left ? 1 : 0);
        stick.y = (nesButtons.down  ? 1 : 0) - (nesButtons.up   ? 1 : 0);
      }
    }

    if (msg.controller === "touchpad" && msg.state === "move" && msg.coordinates.length > 0) {
      const [fx, fy] = msg.coordinates[0];
      objX = (fx / (scArea.clientWidth  || 1)) * scArea.clientWidth;
      objY = (fy / (scArea.clientHeight || 1)) * scArea.clientHeight;
    }

    if (msg.controller === "scroll") {
      if (msg.state === "move" && msg.coordinates.length > 0) {
        stick.y = msg.coordinates[0][1] > (scArea.clientHeight / 2) ? 1 : -1;
      } else if (msg.state === "end") {
        stick.y = 0;
      }
    }
  });
}
