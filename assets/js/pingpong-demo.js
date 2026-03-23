import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function init(channel) {
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

  // ── Ball ──────────────────────────────────────────────────────────────────

  let ball = null;
  const HIT_RADIUS   = 1.1;   // world-unit radius for paddle–ball collision
  const PADDLE_Z     = 0.0;   // z-plane of the paddle face
  const BALL_START_Z = -10;   // spawn distance
  const INIT_VZ      = 0.07;  // initial approach speed (world units / frame @ 60 fps)

  // Ball physics state
  const bs = { x: 0, y: 0, z: BALL_START_Z, vx: 0, vy: 0, vz: INIT_VZ, speed: INIT_VZ };

  function resetBall() {
    bs.x  = (Math.random() - 0.5) * 1.5;
    bs.y  = (Math.random() - 0.5) * 0.8;
    bs.z  = BALL_START_Z;
    bs.vx = (Math.random() - 0.5) * 0.03;
    bs.vy = (Math.random() - 0.5) * 0.02;
    bs.vz = bs.speed;
  }

  function updateBall() {
    if (!ball) return;

    bs.x += bs.vx;
    bs.y += bs.vy;
    bs.z += bs.vz;

    // Collision: ball crosses the paddle plane while still approaching
    if (bs.vz > 0 && bs.z >= PADDLE_Z - 0.2 && bs.z <= PADDLE_Z + 0.5) {
      const dx = bs.x - trackPos.x;
      const dy = bs.y - trackPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
        bs.speed  = Math.min(bs.speed * 1.08, 0.25); // rally: speed up each hit, cap at 0.25
        bs.vz     = -bs.speed;
        bs.vx     = dx * 0.04;                        // deflect off-centre hits
        bs.vy     = dy * 0.04;
      }
    }

    // Miss: ball flew past the camera — brief pause then respawn
    if (bs.z > camera.position.z + 2) {
      ball.visible = false;
      bs.speed = INIT_VZ;
      setTimeout(() => { if (ball) { ball.visible = true; resetBall(); } }, 1200);
    }

    ball.position.set(bs.x, bs.y, bs.z);
    ball.rotation.x += 0.03;
    ball.rotation.y += 0.02;
  }

  loader.load("/assets/ball.glb", (gltf) => {
    const pivot = new THREE.Group();
    const box   = new THREE.Box3().setFromObject(gltf.scene);
    const centre = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3()).length();
    const scale  = 0.7 / size;
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale);
    pivot.add(gltf.scene);
    scene.add(pivot);
    ball = pivot;
    resetBall();
  }, undefined, (err) => {
    console.error("[Pingpong] Failed to load ball.glb:", err);
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
    updateBall();
    renderer.render(scene, camera);
  }

  // ── Webcam Position Tracking (frame differencing, no calibration needed) ──
  //
  // Compares each frame against the previous frame. Pixels that changed more
  // than DIFF_THRESH are "motion pixels". The centroid of all motion pixels
  // is where the phone is. When no motion is detected the last position holds.

  const webcamVideo   = document.getElementById("webcam-video");
  let webcamActive    = false;
  let webcamStream    = null;

  const CAM_W = 320, CAM_H = 240;
  const offscreen = document.createElement("canvas");
  offscreen.width  = CAM_W;
  offscreen.height = CAM_H;
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });

  const fgCanvas  = document.createElement("canvas");
  fgCanvas.width  = CAM_W;
  fgCanvas.height = CAM_H;
  const fgCtx     = fgCanvas.getContext("2d");
  const fgImgData = fgCtx.createImageData(CAM_W, CAM_H);

  let prevData      = null;
  const DIFF_THRESH  = 30;    // per-channel threshold to mark a pixel as motion
  const MIN_AREA     = 400;   // minimum blob area (px²) to count as the phone
  const SMOOTH       = 0.08;  // EMA factor: lower = smoother but more lag
  const DEAD_ZONE    = 0.01;  // normalised units; ignore centroid shifts smaller than this
  const trackSmooth  = { x: 0.5, y: 0.5 };

  // Reusable typed arrays (allocated once, not per frame)
  const mask     = new Uint8Array(CAM_W * CAM_H);
  const visited  = new Uint8Array(CAM_W * CAM_H);
  const bfsQueue = new Int32Array(CAM_W * CAM_H);

  // Find the largest 4-connected blob in `mask` using BFS.
  // Returns { area, cx, cy } of the largest blob, or { area: 0 } if none.
  function largestBlob() {
    visited.fill(0);
    let bestArea = 0, bestCx = 0, bestCy = 0;

    for (let start = 0; start < CAM_W * CAM_H; start++) {
      if (!mask[start] || visited[start]) continue;

      // BFS
      let head = 0, tail = 0;
      bfsQueue[tail++] = start;
      visited[start] = 1;
      let area = 0, sumX = 0, sumY = 0;

      while (head < tail) {
        const idx = bfsQueue[head++];
        area++;
        sumX += idx % CAM_W;
        sumY  = sumY + ((idx / CAM_W) | 0);

        const x = idx % CAM_W, y = (idx / CAM_W) | 0;
        if (x > 0          && mask[idx - 1]       && !visited[idx - 1])       { visited[idx - 1]       = 1; bfsQueue[tail++] = idx - 1; }
        if (x < CAM_W - 1  && mask[idx + 1]       && !visited[idx + 1])       { visited[idx + 1]       = 1; bfsQueue[tail++] = idx + 1; }
        if (y > 0          && mask[idx - CAM_W]   && !visited[idx - CAM_W])   { visited[idx - CAM_W]   = 1; bfsQueue[tail++] = idx - CAM_W; }
        if (y < CAM_H - 1  && mask[idx + CAM_W]   && !visited[idx + CAM_W])   { visited[idx + CAM_W]   = 1; bfsQueue[tail++] = idx + CAM_W; }
      }

      if (area > bestArea) {
        bestArea = area;
        bestCx = sumX / area;
        bestCy = sumY / area;
      }
    }
    return bestArea >= MIN_AREA ? { area: bestArea, cx: bestCx, cy: bestCy } : { area: 0 };
  }

  function processWebcamFrame() {
    if (!webcamActive) return;

    offCtx.drawImage(webcamVideo, 0, 0, CAM_W, CAM_H);
    const { data } = offCtx.getImageData(0, 0, CAM_W, CAM_H);

    if (!prevData) {
      prevData = new Uint8ClampedArray(data);
      requestAnimationFrame(processWebcamFrame);
      return;
    }

    // Build binary motion mask and debug overlay in one pass
    for (let i = 0; i < CAM_W * CAM_H; i++) {
      const p = i * 4;
      const diff = Math.abs(data[p]   - prevData[p])
                 + Math.abs(data[p+1] - prevData[p+1])
                 + Math.abs(data[p+2] - prevData[p+2]);
      mask[i] = diff > DIFF_THRESH ? 1 : 0;

      fgImgData.data[p]     = 50;
      fgImgData.data[p + 1] = 220;
      fgImgData.data[p + 2] = 50;
      fgImgData.data[p + 3] = mask[i] ? Math.min(255, diff * 2) : 0;
    }

    prevData.set(data);

    const blob     = largestBlob();
    const detected = blob.area > 0;

    if (detected) {
      const nx = 1 - blob.cx / CAM_W; // mirror X
      const ny = blob.cy / CAM_H;
      const dx = nx - trackSmooth.x, dy = ny - trackSmooth.y;
      // Dead zone: ignore micro-shifts so stationary phone doesn't jitter
      if (Math.abs(dx) > DEAD_ZONE) trackSmooth.x += dx * SMOOTH;
      if (Math.abs(dy) > DEAD_ZONE) trackSmooth.y += dy * SMOOTH;
    }
    // When not detected: hold last position.

    const aspect = rendererW > 0 ? rendererW / rendererH : camera.aspect;
    const halfH  = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW  = halfH * aspect;
    trackPos.x = (trackSmooth.x - 0.5) * 2 * halfW;
    trackPos.y = (0.5 - trackSmooth.y) * 2 * halfH;

    // ── Debug view (commented out) ───────────────────────────────────────────
    // const DW = dbgCanvas.clientWidth, DH = dbgCanvas.clientHeight;
    // if (dbgCanvas.width !== DW || dbgCanvas.height !== DH) {
    //   dbgCanvas.width = DW; dbgCanvas.height = DH;
    // }
    // // Webcam feed, mirrored
    // dbgCtx.save();
    // dbgCtx.translate(DW, 0);
    // dbgCtx.scale(-1, 1);
    // dbgCtx.drawImage(offscreen, 0, 0, DW, DH);
    // dbgCtx.restore();
    // // Motion overlay, mirrored to match feed
    // fgCtx.putImageData(fgImgData, 0, 0);
    // dbgCtx.save();
    // dbgCtx.translate(DW, 0);
    // dbgCtx.scale(-1, 1);
    // dbgCtx.drawImage(fgCanvas, 0, 0, DW, DH);
    // dbgCtx.restore();
    // // Crosshair — green = detecting largest blob, gray = holding position
    // const cx = trackSmooth.x * DW;
    // const cy = trackSmooth.y * DH;
    // dbgCtx.strokeStyle = detected ? "#00ff00" : "rgba(255,255,255,0.4)";
    // dbgCtx.lineWidth = 2;
    // dbgCtx.beginPath();
    // dbgCtx.arc(cx, cy, 14, 0, Math.PI * 2);
    // dbgCtx.stroke();
    // dbgCtx.beginPath();
    // dbgCtx.moveTo(cx - 22, cy); dbgCtx.lineTo(cx + 22, cy);
    // dbgCtx.moveTo(cx, cy - 22); dbgCtx.lineTo(cx, cy + 22);
    // dbgCtx.stroke();
    // dbgCtx.fillStyle = detected ? "#00ff00" : "rgba(255,255,255,0.5)";
    // dbgCtx.font = "bold 12px monospace";
    // dbgCtx.fillText(`blob: ${blob.area}px²  min: ${MIN_AREA}`, 8, DH - 8);

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
    paddleCanvas.style.display = "block";
    paddleCanvas.style.opacity = "0";
    paddleCanvas.getBoundingClientRect();
    paddleCanvas.style.opacity = "1";
    if (ball) { ball.visible = true; resetBall(); }
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
    paddleCanvas.style.opacity = "0";
    paddleCanvas.addEventListener(
      "transitionend",
      () => { if (fadingOut) paddleCanvas.style.display = "none"; },
      { once: true },
    );
    orientation.alpha = orientation.beta = orientation.gamma = 0;
    if (paddle) { paddle.rotation.set(0, 0, 0); paddle.position.set(0, 0, 0); }
    if (ball)   { ball.visible = false; bs.speed = INIT_VZ; }
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
