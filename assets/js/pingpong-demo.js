import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function init(channel) {
  const graphArea    = document.getElementById("graph-area");
  const paddleCanvas = document.getElementById("paddle-canvas");

  // ── Paddle (Three.js) ─────────────────────────────────────────────────────

  const renderer = new THREE.WebGLRenderer({
    canvas: paddleCanvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 0, 5);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(2, 4, 3);
  scene.add(dirLight);

  let paddle = null;
  const orientation = { alpha: 0, beta: 0, gamma: 0 };
  const trackPos    = { x: 0, y: 0 };

  const loader = new GLTFLoader();
  loader.load("/assets/paddle.glb", (gltf) => {
    const pivot = new THREE.Group();
    gltf.scene.rotation.z = Math.PI;
    gltf.scene.rotation.x = Math.PI;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const scale = 2.5 / size;
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale);
    pivot.add(gltf.scene);
    scene.add(pivot);
    paddle = pivot;
  }, undefined, (err) => {
    console.error("[Pingpong] Failed to load paddle.glb:", err)
  });

  let rendererW = 0, rendererH = 0;
  function resizePaddle() {
    const W = window.innerWidth, H = window.innerHeight;
    if (rendererW !== W || rendererH !== H) {
      rendererW = W;
      rendererH = H;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
  }

  function renderPaddle() {
    resizePaddle();
    if (paddle) {
      paddle.rotation.order = "YXZ";
      paddle.rotation.y = THREE.MathUtils.degToRad(orientation.alpha);
      paddle.rotation.x = THREE.MathUtils.degToRad(orientation.beta);
      paddle.rotation.z = THREE.MathUtils.degToRad(-orientation.gamma);
      paddle.position.x = trackPos.x;
      paddle.position.y = trackPos.y;
    }
    renderer.render(scene, camera);
  }

  // ── Webcam Position Tracking (frame differencing, no calibration needed) ──
  //
  // Compares each frame against the previous frame. Pixels that changed more
  // than DIFF_THRESH are "motion pixels". The centroid of all motion pixels
  // is where the phone is. When no motion is detected the last position holds.

  const webcamVideo   = document.getElementById("webcam-video");
  const dbgCanvas     = document.getElementById("webcam-debug-canvas");
  const dbgCtx        = dbgCanvas.getContext("2d");
  let webcamActive    = false;
  let webcamStream    = null;

  const CAM_W = 160, CAM_H = 120;
  const offscreen = document.createElement("canvas");
  offscreen.width  = CAM_W;
  offscreen.height = CAM_H;
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });

  const fgCanvas  = document.createElement("canvas");
  fgCanvas.width  = CAM_W;
  fgCanvas.height = CAM_H;
  const fgCtx     = fgCanvas.getContext("2d");
  const fgImgData = fgCtx.createImageData(CAM_W, CAM_H);

  let prevData      = null;   // previous frame pixel data
  const DIFF_THRESH = 20;     // sum-of-channels threshold to call a pixel "moved"
  const MIN_BLOB    = 100;    // minimum motion pixels required to trust centroid
  const SMOOTH      = 0.15;
  const trackSmooth = { x: 0.5, y: 0.5 };

  function processWebcamFrame() {
    if (!webcamActive) return;

    offCtx.drawImage(webcamVideo, 0, 0, CAM_W, CAM_H);
    const { data } = offCtx.getImageData(0, 0, CAM_W, CAM_H);

    if (!prevData) {
      prevData = new Uint8ClampedArray(data);
      requestAnimationFrame(processWebcamFrame);
      return;
    }

    let sumX = 0, sumY = 0, count = 0;

    for (let i = 0; i < CAM_W * CAM_H; i++) {
      const p = i * 4;
      const diff = Math.abs(data[p] - prevData[p])
                 + Math.abs(data[p+1] - prevData[p+1])
                 + Math.abs(data[p+2] - prevData[p+2]);
      const isFg = diff > DIFF_THRESH;

      // Build overlay: brighter green for larger differences
      fgImgData.data[p]     = 50;
      fgImgData.data[p + 1] = 220;
      fgImgData.data[p + 2] = 50;
      fgImgData.data[p + 3] = isFg ? Math.min(255, diff * 2) : 0;

      if (isFg) {
        sumX += i % CAM_W;
        sumY += Math.floor(i / CAM_W);
        count++;
      }
    }

    // Always copy current frame to prev BEFORE early-returning
    prevData.set(data);

    const detected = count > MIN_BLOB;
    if (detected) {
      const nx = 1 - sumX / count / CAM_W; // mirror X to match display
      const ny = sumY / count / CAM_H;
      trackSmooth.x += (nx - trackSmooth.x) * SMOOTH;
      trackSmooth.y += (ny - trackSmooth.y) * SMOOTH;
      const aspect = rendererW > 0 ? rendererW / rendererH : camera.aspect;
      const halfH  = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const halfW  = halfH * aspect;
      trackPos.x = (trackSmooth.x - 0.5) * 2 * halfW;
      trackPos.y = (0.5 - trackSmooth.y) * 2 * halfH;
    }

    // ── Debug view ──────────────────────────────────────────────────────────
    const DW = dbgCanvas.clientWidth, DH = dbgCanvas.clientHeight;
    if (dbgCanvas.width !== DW || dbgCanvas.height !== DH) {
      dbgCanvas.width = DW; dbgCanvas.height = DH;
    }

    // Webcam feed, mirrored
    dbgCtx.save();
    dbgCtx.translate(DW, 0);
    dbgCtx.scale(-1, 1);
    dbgCtx.drawImage(offscreen, 0, 0, DW, DH);
    dbgCtx.restore();

    // Motion overlay, mirrored to match feed
    fgCtx.putImageData(fgImgData, 0, 0);
    dbgCtx.save();
    dbgCtx.translate(DW, 0);
    dbgCtx.scale(-1, 1);
    dbgCtx.drawImage(fgCanvas, 0, 0, DW, DH);
    dbgCtx.restore();

    // Crosshair — always visible so you can see where the tracker thinks the
    // phone is even when not actively detecting. Green = detecting, gray = holding.
    const cx = trackSmooth.x * DW;
    const cy = trackSmooth.y * DH;
    dbgCtx.strokeStyle = detected ? "#00ff00" : "rgba(255,255,255,0.4)";
    dbgCtx.lineWidth = 2;
    dbgCtx.beginPath();
    dbgCtx.arc(cx, cy, 14, 0, Math.PI * 2);
    dbgCtx.stroke();
    dbgCtx.beginPath();
    dbgCtx.moveTo(cx - 22, cy); dbgCtx.lineTo(cx + 22, cy);
    dbgCtx.moveTo(cx, cy - 22); dbgCtx.lineTo(cx, cy + 22);
    dbgCtx.stroke();

    // Pixel count so you can see if detection is firing at all
    dbgCtx.fillStyle = detected ? "#00ff00" : "rgba(255,255,255,0.5)";
    dbgCtx.font = "bold 12px monospace";
    dbgCtx.fillText(`motion px: ${count}  min: ${MIN_BLOB}`, 8, DH - 8);

    requestAnimationFrame(processWebcamFrame);
  }

  async function startWebcam() {
    if (webcamActive) return;
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: CAM_W }, height: { ideal: CAM_H } },
        audio: false,
      });
      webcamVideo.srcObject = webcamStream;
      await webcamVideo.play();
      prevData = null;
      webcamActive = true;
      requestAnimationFrame(processWebcamFrame);
    } catch (e) {
      console.warn("[Pingpong] Webcam tracking unavailable:", e);
    }
  }

  function stopWebcam() {
    webcamActive = false;
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
      webcamVideo.srcObject = null;
    }
    prevData = null;
    trackSmooth.x = trackSmooth.y = 0.5;
    trackPos.x = trackPos.y = 0;
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  let rafId = null;
  let fadingOut = false;

  paddleCanvas.style.transition = "opacity 1.5s ease";

  function startLoop() {
    fadingOut = false;
    if (rafId) return;
    graphArea.classList.remove("hidden");
    paddleCanvas.style.display = "block";
    paddleCanvas.style.opacity = "0";
    paddleCanvas.getBoundingClientRect();
    paddleCanvas.style.opacity = "1";
    startWebcam();
    function loop() {
      renderPaddle();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    fadingOut = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    stopWebcam();
    graphArea.classList.add("hidden");
    paddleCanvas.style.opacity = "0";
    paddleCanvas.addEventListener(
      "transitionend",
      () => { if (fadingOut) paddleCanvas.style.display = "none"; },
      { once: true },
    );
    orientation.alpha = orientation.beta = orientation.gamma = 0;
    if (paddle) { paddle.rotation.set(0, 0, 0); paddle.position.set(0, 0, 0); }
  }

  // ── Channel ───────────────────────────────────────────────────────────────

  channel.on("sensor_graph_connected", () => startLoop());
  channel.on("sensor_graph_disconnected", () => stopLoop());

  channel.on("orient", ({ alpha, beta, gamma }) => {
    orientation.alpha = alpha || 0;
    orientation.beta  = beta  || 0;
    orientation.gamma = gamma || 0;
  });

  channel.on("motion", () => {});
}
