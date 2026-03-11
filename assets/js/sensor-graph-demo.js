import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Bone names in spine order, head → tail
const SPINE_BONES = [
  "Bone001_01", "Bone002_02", "Bone003_03", "Bone004_04",
  "Bone005_05", "Bone006_06", "Bone007_07", "Bone008_08",
];
const FIN_BONES = [
  "Bone008UP_09", "Bone008DOWN_010",
  "Left_fin_013", "Right_fin_014",
  "Left_down_fin_011", "Right_down_fin_012",
];

export function init(channel) {
  const graphArea = document.getElementById("graph-area");
  const graphCanvas = document.getElementById("graph-canvas");
  const fishCanvas = document.getElementById("fish-canvas");

  // ── Graph ─────────────────────────────────────────────────────────────────

  const MAX_POINTS = 200;
  const ROWS = [
    {
      label: "Orientation (°)",
      keys: ["beta", "gamma", "alpha"],
      seriesLabels: ["β", "γ", "α"],
      min: -180,
      max: 360,
      colors: ["#f87171", "#4ade80", "#60a5fa"],
    },
    {
      label: "Acceleration (m/s²)",
      keys: ["ax", "ay", "az"],
      seriesLabels: ["x", "y", "z"],
      min: -20,
      max: 20,
      colors: ["#f87171", "#4ade80", "#60a5fa"],
    },
    {
      label: "Rotation (°/s)",
      keys: ["rx", "ry", "rz"],
      seriesLabels: ["x", "y", "z"],
      min: -360,
      max: 360,
      colors: ["#f87171", "#4ade80", "#60a5fa"],
    },
  ];

  const data = {};
  for (const row of ROWS)
    for (const key of row.keys) data[key] = new Array(MAX_POINTS).fill(0);

  function push(key, val) {
    data[key].push(val != null ? val : 0);
    if (data[key].length > MAX_POINTS) data[key].shift();
  }

  function renderGraph() {
    const W = graphArea.clientWidth;
    const H = graphArea.clientHeight;
    if (graphCanvas.width !== W) graphCanvas.width = W;
    if (graphCanvas.height !== H) graphCanvas.height = H;

    const ctx = graphCanvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const LEFT = 46;
    const RIGHT = 12;
    const LABEL_H = 16;
    const ROW_GAP = 8;
    const plotW = W - LEFT - RIGHT;
    const rowH = Math.floor((H - ROW_GAP * (ROWS.length - 1)) / ROWS.length);
    const plotH = rowH - LABEL_H;

    ROWS.forEach((row, ri) => {
      const rowTop = ri * (rowH + ROW_GAP);
      const plotTop = rowTop + LABEL_H;
      const span = row.max - row.min;
      const zeroY = plotTop + plotH * (1 - (0 - row.min) / span);

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(LEFT, plotTop, plotW, plotH);

      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(LEFT, zeroY);
      ctx.lineTo(LEFT + plotW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(row.max, LEFT - 2, plotTop + 8);
      ctx.fillText(row.min, LEFT - 2, plotTop + plotH);
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "11px monospace";
      ctx.fillText(row.label, LEFT, rowTop + 11);

      let xCursor = LEFT + ctx.measureText(row.label + "   ").width;
      row.keys.forEach((key, ki) => {
        const cur = data[key][data[key].length - 1];
        const valStr = `${row.seriesLabels[ki]}:${cur >= 0 ? "+" : ""}${cur.toFixed(1)}  `;
        ctx.fillStyle = row.colors[ki];
        ctx.fillText(valStr, xCursor, rowTop + 11);
        xCursor += ctx.measureText(valStr).width;
      });

      row.keys.forEach((key, ki) => {
        const vals = data[key];
        ctx.strokeStyle = row.colors[ki];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        vals.forEach((v, i) => {
          const x = LEFT + (i / (MAX_POINTS - 1)) * plotW;
          const y =
            plotTop +
            plotH * (1 - Math.max(0, Math.min(1, (v - row.min) / span)));
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    });
  }

  // ── Fish (Three.js) ───────────────────────────────────────────────────────

  const renderer = new THREE.WebGLRenderer({
    canvas: fishCanvas,
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

  let fish = null;
  const orientation = { alpha: 0, beta: 0, gamma: 0 };

  // Procedural bone animation state
  const clock = new THREE.Clock();
  let wigglePhase = 0;
  const bones = {};       // name → Object3D
  const restQ = {};       // name → Quaternion (rest pose)
  const _tmpQ = new THREE.Quaternion();
  const _X = new THREE.Vector3(1, 0, 0);
  const _Z = new THREE.Vector3(0, 0, 1);

  // Fish position (world units) + scalar forward speed (always >= 0)
  let posX = 0,
    posY = 1.2,
    posZ = 0;
  let fishSpeed = 0;
  const FISH_SPEED = 0.002; // speed added per frame at full wiggle
  const FISH_FRICTION = 0.99; // speed decay per frame

  // Wiggle detection: count yaw direction-reversals in a rolling window.
  // Only deltas above WIGGLE_THRESHOLD are counted to reject sensor noise.
  const WIGGLE_WINDOW = 16; // ~0.5 s at 30 Hz
  const WIGGLE_THRESHOLD = 3; // degrees — below this is considered noise
  let prevAlpha = 0;
  const alphaDeltas = [];
  let wiggleEnergy = 0;

  const loader = new GLTFLoader();
  loader.load("/assets/yellow_tang_fish.glb", (gltf) => {
    const pivot = new THREE.Group();
    gltf.scene.rotation.y = Math.PI;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    gltf.scene.position.sub(centre);
    gltf.scene.scale.setScalar(0.5 / size);
    pivot.add(gltf.scene);
    scene.add(pivot);
    fish = pivot;

    // Collect bone refs directly from the SkinnedMesh skeleton
    gltf.scene.traverse((obj) => {
      if (obj.isSkinnedMesh) {
        obj.skeleton.bones.forEach((bone) => { bones[bone.name] = bone; });
      }
    });
    [...SPINE_BONES, ...FIN_BONES].forEach((name) => {
      if (bones[name]) restQ[name] = bones[name].quaternion.clone();
    });
  });

  function frustumHalfSize() {
    const depth = camera.position.z - posZ;
    const halfH = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return { halfH, halfW: halfH * camera.aspect };
  }

  let rendererW = 0,
    rendererH = 0;
  function resizeFish() {
    const W = window.innerWidth,
      H = window.innerHeight;
    if (rendererW !== W || rendererH !== H) {
      rendererW = W;
      rendererH = H;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
  }

  function renderFish() {
    resizeFish();

    if (fish) {
      // Scalar speed along current heading — fish can only move forward.
      // Forward direction from YXZ Euler (same order as fish.rotation.order):
      //   fwd = Ry(α) · Rx(β) · [0, 0, 1] = (sin α cos β, -sin β, cos α cos β)
      const a = THREE.MathUtils.degToRad(orientation.alpha);
      const b = THREE.MathUtils.degToRad(orientation.beta);
      const fwdX = -Math.sin(a) * Math.cos(b);
      const fwdY = Math.sin(b);
      const fwdZ = -Math.cos(a) * Math.cos(b);
      fishSpeed = fishSpeed * FISH_FRICTION + wiggleEnergy * FISH_SPEED;
      posX += fwdX * fishSpeed;
      posY += fwdY * fishSpeed;
      posZ += fwdZ * fishSpeed;

      // Z bounds: keep fish between z=-12 (far) and z=4.5 (close, still in front of camera at z=5)
      if (posZ < -12) {
        posZ = -12;
        fishSpeed = 0;
      }
      if (posZ > 4.5) {
        posZ = 4.5;
        fishSpeed = 0;
      }

      // XY bounds scale with depth so the fish stays in the visible frustum
      const { halfW, halfH } = frustumHalfSize();
      const bx = halfW,
        by = halfH;
      if (posX < -bx) {
        posX = -bx;
        fishSpeed = 0;
      }
      if (posX > bx) {
        posX = bx;
        fishSpeed = 0;
      }
      if (posY < -by) {
        posY = -by;
        fishSpeed = 0;
      }
      if (posY > by) {
        posY = by;
        fishSpeed = 0;
      }

      fish.position.set(posX, posY, posZ);

      fish.rotation.order = "YXZ";
      fish.rotation.y = THREE.MathUtils.degToRad(orientation.alpha);
      fish.rotation.x = THREE.MathUtils.degToRad(orientation.beta * 0.5);
      fish.rotation.z = THREE.MathUtils.degToRad(-orientation.gamma * 0.5);

      // ── Procedural bone animation ────────────────────────────────────────
      const dt = Math.min(clock.getDelta(), 0.1); // clamp to avoid jumps

      // Phase advances faster when the user wiggles more
      const IDLE_FREQ = 1.5;   // rad/s — gentle idle undulation
      const SWIM_FREQ = 6.0;   // rad/s added at full wiggle energy
      wigglePhase += dt * (IDLE_FREQ + wiggleEnergy * SWIM_FREQ);

      // Spine: traveling sine wave, head→tail.
      // Bone-local X is the lateral axis (confirmed from Swim Animation keyframes).
      // Amplitude envelope: near-zero at head, peaks at tail.
      SPINE_BONES.forEach((name, i) => {
        const bone = bones[name];
        if (!bone || !restQ[name]) return;
        const t = i / (SPINE_BONES.length - 1); // 0 = head, 1 = tail
        const phase = wigglePhase - t * Math.PI * 1.5;
        const amp = (0.05 + t * 0.35) * (0.3 + wiggleEnergy * 0.7);
        _tmpQ.setFromAxisAngle(_X, Math.sin(phase) * amp);
        bone.quaternion.copy(restQ[name]).multiply(_tmpQ);
      });

      // Tail lobes: spread outward with speed
      ["Bone.008UP_09", "Bone.008DOWN_010"].forEach((name, i) => {
        const bone = bones[name];
        if (!bone || !restQ[name]) return;
        const sign = i === 0 ? 1 : -1;
        _tmpQ.setFromAxisAngle(_Z, sign * 0.25 * wiggleEnergy);
        bone.quaternion.copy(restQ[name]).multiply(_tmpQ);
      });

      // Pectoral fins: alternating flap in phase with the swim cycle
      ["Left_fin_013", "Right_fin_013"].forEach((name, i) => {
        const bone = bones[name];
        if (!bone || !restQ[name]) return;
        const side = i === 0 ? 1 : -1;
        const flap = side * Math.sin(wigglePhase * 0.7 + i * Math.PI) * 0.3 * (0.3 + wiggleEnergy * 0.7);
        _tmpQ.setFromAxisAngle(_Z, flap);
        bone.quaternion.copy(restQ[name]).multiply(_tmpQ);
      });

      // Ventral fins: subtle flutter
      ["Left_down_fin_011", "Right_down_fin_012"].forEach((name, i) => {
        const bone = bones[name];
        if (!bone || !restQ[name]) return;
        const side = i === 0 ? 1 : -1;
        const flutter = side * Math.sin(wigglePhase * 1.1 + i * Math.PI) * 0.12 * (0.2 + wiggleEnergy * 0.5);
        _tmpQ.setFromAxisAngle(_Z, flutter);
        bone.quaternion.copy(restQ[name]).multiply(_tmpQ);
      });
    }

    renderer.render(scene, camera);
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  let rafId = null;
  let fadingOut = false;

  fishCanvas.style.transition = "opacity 1.5s ease";

  function startLoop() {
    fadingOut = false; // cancel any in-progress fade-out
    if (rafId) return;
    fishCanvas.style.display = "block";
    fishCanvas.style.opacity = "0";
    fishCanvas.getBoundingClientRect(); // force reflow so transition fires
    fishCanvas.style.opacity = "1";
    function loop() {
      // renderGraph();
      renderFish();
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
    fishCanvas.style.opacity = "0";
    fishCanvas.addEventListener(
      "transitionend",
      () => {
        if (fadingOut) fishCanvas.style.display = "none";
      },
      { once: true },
    );
    for (const row of ROWS) for (const key of row.keys) data[key].fill(0);
    orientation.alpha = orientation.beta = orientation.gamma = 0;
    posX = posY = posZ = fishSpeed = wiggleEnergy = prevAlpha = 0;
    alphaDeltas.length = 0;
    posY = 1.2;
    wigglePhase = 0;
    if (fish) fish.position.set(0, 1.2, 0);
    [...SPINE_BONES, ...FIN_BONES].forEach((name) => {
      if (bones[name] && restQ[name]) bones[name].quaternion.copy(restQ[name]);
    });
  }

  // ── Channel ───────────────────────────────────────────────────────────────

  channel.on("sensor_graph_connected", () => {
    // graphArea.classList.remove("hidden");
    startLoop();
  });
  channel.on("sensor_graph_disconnected", () => {
    stopLoop();
    graphArea.classList.add("hidden");
  });

  channel.on("orient", ({ alpha, beta, gamma }) => {
    const a = alpha || 0;
    orientation.alpha = a;
    orientation.beta = beta || 0;
    orientation.gamma = gamma || 0;

    // Detect yaw oscillation: wrap-safe delta, then count direction reversals
    let delta = ((((a - prevAlpha) % 360) + 540) % 360) - 180;
    prevAlpha = a;
    alphaDeltas.push(delta);
    if (alphaDeltas.length > WIGGLE_WINDOW) alphaDeltas.shift();

    let reversals = 0;
    for (let i = 1; i < alphaDeltas.length; i++) {
      const d0 = alphaDeltas[i - 1],
        d1 = alphaDeltas[i];
      if (
        d0 * d1 < 0 &&
        Math.abs(d0) > WIGGLE_THRESHOLD &&
        Math.abs(d1) > WIGGLE_THRESHOLD
      )
        reversals++;
    }
    wiggleEnergy = reversals / Math.max(1, alphaDeltas.length - 1);

    push("beta", beta);
    push("gamma", gamma);
    push("alpha", alpha);
  });

  channel.on("motion", ({ ax, ay, az, rx, ry, rz }) => {
    push("ax", ax);
    push("ay", ay);
    push("az", az);
    push("rx", rx);
    push("ry", ry);
    push("rz", rz);
  });
}
