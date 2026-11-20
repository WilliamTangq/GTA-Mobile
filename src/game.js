import * as T from "../vendor/three.module.js";
import {
  SPECS,
  createState,
  simulate,
  isLand,
  blocked,
  clamp,
  approach,
} from "./physics.js";
import { createWorld, drawMap, district, DESTINATIONS } from "./world.js";
import { makeVehicle, makePerson } from "./vehicles.js";
import { createInput } from "./input.js";
import { SoftwareRenderer } from "./software-renderer.js";

const $ = (s) => document.querySelector(s),
  canvas = $("#game");
let renderer;
try {
  const context = canvas.getContext("webgl2", {
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer = context
    ? new T.WebGLRenderer({ canvas, context, antialias: false })
    : new SoftwareRenderer(canvas);
} catch {
  $("#fatal").hidden = false;
  throw new Error("Graphics context is unavailable.");
}
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.background = new T.Color(0xb9c7c2);
scene.fog = new T.Fog(0xb9c7c2, 360, 1400);
const camera = new T.PerspectiveCamera(58, 1, 0.2, 3000);
const hemi = new T.HemisphereLight(0xd6ecf0, 0xb09a78, 2.5);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffd4a5, 3.0);
sun.position.set(-130, 180, 130);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 480;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);
const sunDisc = new T.Mesh(
  new T.SphereGeometry(29, 16, 12),
  new T.MeshBasicMaterial({ color: 0xffe9b3, fog: false }),
);
sunDisc.position.set(680, 155, -1100);
scene.add(sunDisc);
const world = createWorld(scene),
  states = {},
  models = {};
for (const type of Object.keys(SPECS).filter((t) => t !== "foot")) {
  states[type] = createState(type);
  models[type] = makeVehicle(type);
  scene.add(models[type]);
}
const person = makePerson();
scene.add(person);
person.visible = false;
let active = states.sport,
  started = false,
  menu = null,
  previousFocus = null,
  elapsed = 0,
  trip = 0,
  cameraMode = 0,
  orbit = 0,
  zoom = 1,
  quality = "low",
  daytime = "sunset",
  last = 0,
  mapTick = 0,
  hudTick = 0,
  toastTimer = 0,
  collisionCool = 0;
const vPos = new T.Vector3(),
  vTarget = new T.Vector3(),
  look = new T.Vector3(),
  smoothLook = new T.Vector3();
let snapCamera = true;
let sound = false,
  audio = null;
try {
  quality = localStorage.getItem("island-quality") || "low";
  if (!["low", "high"].includes(quality)) quality = "low";
} catch {}
$("#quality").value = quality;
function resize() {
  const w = window.innerWidth,
    h = window.innerHeight;
  renderer.setPixelRatio(
    Math.min(devicePixelRatio || 1, quality === "high" ? 1.75 : 1.15),
  );
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.shadowMap.enabled = quality === "high";
}
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);
resize();
function toast(message, duration = 3800) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), duration);
}
function clearControls() {
  input.reset();
}
function closeMenu() {
  for (const e of document.querySelectorAll(".modal"))
    if (e.id !== "fatal") e.hidden = true;
  menu = null;
  clearControls();
  previousFocus?.focus({ preventScroll: true });
}
function openMenu(name) {
  if (!started) return;
  if (menu === name) {
    closeMenu();
    return;
  }
  previousFocus = document.activeElement;
  closeMenu();
  menu = name;
  $("#" + name).hidden = false;
  clearControls();
  if (name === "garage") refreshGarage();
  if (name === "map-modal")
    drawMap($("#bigmap"), states, active, { large: true });
  $("#" + name + " button")?.focus({ preventScroll: true });
}
// Focus stays inside the open dialog, including when navigating with a keyboard.
document.addEventListener("keydown", (e) => {
  if (!menu || e.code !== "Tab") return;
  const els = [...$("#" + menu).querySelectorAll("button,select")];
  const first = els[0],
    last = els.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
});
function syncMode() {
  const s = SPECS[active.type],
    fly = ["plane", "heli"].includes(s.kind);
  document.body.classList.toggle("flying", fly);
  $("#vehicle-kind").textContent = s.label;
  $("#vehicle-name").textContent = s.name.toUpperCase();
  $("#enter-label").textContent = s.kind === "foot" ? "上车" : "下车";
  person.visible = s.kind === "foot";
}
function chooseVehicle(type, notify = true) {
  // The parked vehicle remains where it was left; selecting it again recovers to its spawn.
  if (active.type !== "foot") active.speed = 0;
  const distance = states[type].distance;
  Object.assign(states[type], createState(type));
  states[type].distance = distance;
  active = states[type];
  syncMode();
  snapCamera = true;
  orbit = 0;
  closeMenu();
  if (notify) {
    const kind = SPECS[type].kind;
    toast(
      `${SPECS[type].label}已就绪${kind === "plane" ? " · 加速后按住上升起飞" : kind === "heli" ? " · 按住上升，离地后再前进" : kind === "boat" ? " · 前方就是开阔海域" : " · 自由出发"}`,
    );
  }
}
function recover() {
  const type = active.type;
  if (type === "foot") {
    active = { ...createState("foot") };
    syncMode();
  } else chooseVehicle(type, false);
  snapCamera = true;
  orbit = 0;
  clearControls();
  toast("已返回安全出发点");
}
function enterExit() {
  if (active.type !== "foot") {
    if (["plane", "heli"].includes(active.type) && active.y > 3.0) {
      toast("请先降落，再离开载具");
      return;
    }
    const old = active;
    old.speed = 0;
    const offset = old.type === "plane" ? 7 : old.type === "boat" ? 4 : 3.5;
    let p = null;
    for (const angle of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
      const x = old.x + Math.sin(old.heading + angle) * offset,
        z = old.z + Math.cos(old.heading + angle) * offset;
      if (!blocked(x, z, 0, 0.5, world.colliders)) {
        p = { x, z };
        break;
      }
    }
    if (!p) {
      toast("附近没有下车空间，请移动后再试");
      return;
    }
    active = {
      ...createState("foot"),
      ...p,
      y: isLand(p.x, p.z) ? 0.25 : -0.85,
      heading: old.heading,
    };
    syncMode();
    toast(
      isLand(p.x, p.z)
        ? "已下车 · 靠近载具可以重新上车"
        : "现在可以游泳 · 靠近快艇重新上船",
    );
  } else {
    let near = null,
      best = 12;
    for (const s of Object.values(states)) {
      const d = Math.hypot(s.x - active.x, s.z - active.z);
      if (d < best && s.y < 3) {
        near = s;
        best = d;
      }
    }
    if (!near) {
      toast("靠近一辆载具，或打开「换载具」快速出发");
      return;
    }
    active = near;
    syncMode();
    toast(`已进入 ${SPECS[active.type].name}`);
  }
  snapCamera = true;
  orbit = 0;
  clearControls();
}
function handleAction(name, value) {
  if (name === "orbit") {
    if (!menu) orbit += value;
    return;
  }
  if (name === "zoom") {
    zoom = clamp(zoom + value, 0.7, 2.5);
    return;
  }
  if (!started) return;
  if (name === "pause") {
    menu ? closeMenu() : openMenu("pause");
    return;
  }
  if (name === "garage") {
    openMenu("garage");
    return;
  }
  if (name === "map") {
    openMenu("map-modal");
    return;
  }
  if (menu) return;
  if (name === "enter") enterExit();
  if (name === "reset") recover();
  if (name === "camera") {
    cameraMode = (cameraMode + 1) % 3;
    orbit = 0;
    snapCamera = true;
    toast(["跟随镜头", "贴近镜头", "俯瞰镜头"][cameraMode], 1700);
  }
}
const input = createInput(canvas, handleAction);
$("#garage-btn").onclick = () => handleAction("garage");
$("#pause-btn").onclick = () => handleAction("pause");
$("#minimap-btn").onclick = () => handleAction("map");
$("#camera-btn").onclick = () => handleAction("camera");
$("#reset-btn").onclick = () => handleAction("reset");
$("#enter-btn").onclick = () => handleAction("enter");
$("#resume-btn").onclick = closeMenu;
for (const b of document.querySelectorAll("[data-close]"))
  b.onclick = closeMenu;
for (const e of document.querySelectorAll(".modal"))
  e.addEventListener("click", (ev) => {
    if (ev.target === e && e.id !== "fatal") closeMenu();
  });
const iconNames = {
  sport: "car",
  suv: "suv",
  bike: "bike",
  plane: "plane",
  heli: "heli",
  boat: "boat",
};
const locations = {
  sport: "海岸公路",
  suv: "海岸公路",
  bike: "海岸公路",
  plane: "海岛机场",
  heli: "直升机坪",
  boat: "日落码头",
};
function refreshGarage() {
  document.querySelectorAll(".vehicle-card").forEach((b) => {
    const on = b.dataset.type === active.type;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-pressed", String(on));
  });
}
for (const [i, type] of Object.keys(states).entries()) {
  const spec = SPECS[type],
    b = document.createElement("button");
  b.className = "vehicle-card";
  b.dataset.type = type;
  b.innerHTML = `<span class="card-number">0${i + 1}</span><svg viewBox="0 0 120 64"><use href="#i-${iconNames[type]}"/></svg><span class="card-type">${spec.label}</span><strong>${spec.name}</strong><span class="card-meta"><span>${locations[type]}</span><span>${Math.round(spec.max * 3.6)} KM/H</span></span>`;
  b.onclick = () => chooseVehicle(type);
  $("#vehicle-grid").append(b);
}
for (const d of DESTINATIONS) {
  const b = document.createElement("button");
  b.className = "destination";
  b.innerHTML = `<strong>${d.name}</strong><small>${d.en}</small><p>${d.hint}</p>`;
  b.onclick = () => {
    chooseVehicle(d.type, false);
    active.x = d.x;
    active.z = d.z;
    toast(d.hint);
  };
  $("#destinations").append(b);
}
$("#quality").onchange = (e) => {
  quality = e.target.value;
  try {
    localStorage.setItem("island-quality", quality);
  } catch {}
  resize();
};
$("#daytime").onchange = (e) => {
  daytime = e.target.value;
  const themes = {
    sunset: [0xb9c7c2, 0xd6ecf0, 0xb09a78, 0xffd4a5, 2.5, 3, 1.24],
    day: [0x9ccfe0, 0xc6e9ff, 0x9aab83, 0xfff5dd, 2.8, 3.2, 1.2],
    night: [0x263d5b, 0x6d9bcb, 0x273944, 0x90b4da, 1.0, 1.1, 1.15],
  };
  const [sky, hi, lo, sc, h, s, exposure] = themes[daytime];
  scene.background.set(sky);
  scene.fog.color.set(sky);
  hemi.color.set(hi);
  hemi.groundColor.set(lo);
  hemi.intensity = h;
  sun.color.set(sc);
  sun.intensity = s;
  renderer.toneMappingExposure = exposure;
  sunDisc.visible = daytime !== "night";
};
$("#fullscreen-btn").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Safari 分享菜单 · 添加到主屏幕，可获得更完整的屏幕空间", 6000);
    if (screen.orientation?.lock)
      await screen.orientation.lock("landscape").catch(() => {});
  } catch {
    toast("可将手机横放，或从 Safari 添加到主屏幕");
  }
};
function initAudio() {
  if (audio) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC(),
    gain = ctx.createGain(),
    osc = ctx.createOscillator(),
    sub = ctx.createOscillator(),
    filter = ctx.createBiquadFilter();
  osc.type = "sawtooth";
  sub.type = "triangle";
  filter.type = "lowpass";
  filter.frequency.value = 350;
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = 0;
  osc.start();
  sub.start();
  audio = { ctx, gain, osc, sub, filter };
}
$("#sound-btn").onclick = () => {
  try {
    initAudio();
    if (!audio) {
      toast("当前浏览器暂不支持游戏声音");
      return;
    }
    sound = !sound;
    audio.ctx.resume().catch(() => {});
    $("#sound-btn").setAttribute("aria-label", sound ? "关闭声音" : "开启声音");
    $(".sound-slash").hidden = sound;
    toast(sound ? "引擎声音已开启" : "声音已关闭", 1600);
  } catch {
    toast("声音暂不可用，仍可继续游玩");
  }
};
function updateAudio() {
  if (!audio) return;
  const n = Math.abs(active.speed) / SPECS[active.type].max;
  const base = active.type === "heli" ? 70 : active.type === "plane" ? 110 : 38;
  const on =
    sound && started && !menu && !document.hidden && active.type !== "foot";
  audio.gain.gain.setTargetAtTime(
    on ? 0.025 + n * 0.025 : 0,
    audio.ctx.currentTime,
    0.1,
  );
  audio.osc.frequency.setTargetAtTime(
    base + n * 150,
    audio.ctx.currentTime,
    0.1,
  );
  audio.sub.frequency.setTargetAtTime(
    base * 0.5 + n * 80,
    audio.ctx.currentTime,
    0.1,
  );
}
function updateModels(t) {
  for (const [type, s] of Object.entries(states)) {
    const model = models[type],
      body = model.userData.body;
    model.position.set(s.x, s.y, s.z);
    model.rotation.y = s.heading;
    body.rotation.set(-s.pitch, 0, s.roll);
    if (type === "boat") {
      body.position.y = Math.sin(t * 2 + s.x) * 0.07;
      body.rotation.z += Math.sin(t * 1.6) * 0.035;
      body.rotation.x += Math.sin(t * 1.8) * 0.02;
    }
    if (type === "bike") body.rotation.z = s.roll;
    for (const w of model.userData.wheels) w.rotation.x = -s.distance * 2;
    for (const { mesh, axis } of model.userData.rotors)
      mesh.rotation[axis] =
        t * (s === active ? (active.type === "heli" ? 38 : 48) : 4);
  }
  if (active.type === "foot") {
    person.position.set(active.x, active.y, active.z);
    person.rotation.y = active.heading;
    const a =
      Math.sin(active.distance * 1.3) *
      Math.min(Math.abs(active.speed) / 5, 1) *
      0.6;
    person.userData.limbs.forEach(
      (l, i) => (l.rotation.x = a * (i % 2 ? -1 : 1)),
    );
  }
}
function updateCamera(dt, t) {
  if (!started) {
    vPos.set(236 + Math.sin(t * 0.09) * 1, 5.5 + Math.sin(t * 0.12) * 0.2, 257);
    vTarget.set(208, 1.1, 240);
    camera.position.copy(vPos);
    camera.lookAt(vTarget);
    return;
  }
  const spec = SPECS[active.type],
    fly = ["plane", "heli"].includes(spec.kind),
    h = active.heading + orbit;
  let distance =
      spec.kind === "foot" ? 8 : fly ? 24 : spec.kind === "boat" ? 16 : 12,
    height = fly ? 8 : spec.kind === "foot" ? 4 : 5;
  if (cameraMode === 1) {
    distance = fly ? 13 : spec.kind === "foot" ? 4 : 6;
    height = fly ? 4 : 2.5;
  }
  if (cameraMode === 2) {
    distance = 20;
    height = fly ? 45 : 36;
  }
  const n = Math.abs(active.speed) / spec.max;
  distance = (distance + n * 3) * zoom;
  vPos.set(
    active.x - Math.sin(h) * distance,
    active.y + height * zoom,
    active.z - Math.cos(h) * distance,
  );
  vTarget.set(
    active.x + Math.sin(active.heading) * 4,
    active.y + (fly ? 1 : 0.8),
    active.z + Math.cos(active.heading) * 4,
  );
  // If a building is behind the player, lift the camera above its roof.
  for (const b of world.colliders) {
    if (
      vPos.x > b.x - b.w / 2 - 1 &&
      vPos.x < b.x + b.w / 2 + 1 &&
      vPos.z > b.z - b.d / 2 - 1 &&
      vPos.z < b.z + b.d / 2 + 1 &&
      vPos.y < b.h + 2
    )
      vPos.y = b.h + 3;
  }
  const k = snapCamera ? 1 : 1 - Math.exp(-6 * dt);
  camera.position.lerp(vPos, k);
  smoothLook.lerp(vTarget, k);
  camera.lookAt(smoothLook);
  snapCamera = false;
  const fov = 58 + n * 7;
  if (Math.abs(camera.fov - fov) > 0.1) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  sun.position.set(active.x - 100, active.y + 160, active.z + 120);
  sun.target.position.set(active.x, active.y, active.z);
}
function updateHUD(dt) {
  hudTick += dt;
  mapTick += dt;
  if (hudTick > 0.09) {
    hudTick = 0;
    const km = Math.round(Math.abs(active.speed) * 3.6),
      kind = SPECS[active.type].kind;
    $("#speed").textContent = km;
    $("#gear").textContent =
      kind === "foot"
        ? "·"
        : active.speed < -0.4
          ? "R"
          : Math.abs(active.speed) < 0.4
            ? "N"
            : kind === "car" || kind === "bike"
              ? Math.min(6, 1 + Math.floor(km / 45))
              : "D";
    $("#rev-fill").style.width =
      Math.min(100, (Math.abs(active.speed) / SPECS[active.type].max) * 100) +
      "%";
    $("#trip").textContent = (trip / 1000).toFixed(2) + " KM";
    $("#district").textContent = district(active.x, active.z);
    $("#altitude").textContent = ["plane", "heli"].includes(kind)
      ? `${Math.round(active.y)} M 高度`
      : kind === "foot"
        ? !isLand(active.x, active.z)
          ? "游泳中"
          : "步行探索"
        : "自由驾驶";
  }
  if (mapTick > 0.2) {
    mapTick = 0;
    drawMap($("#minimap"), states, active);
  }
}
let accumulator = 0;
function animate(ms) {
  if (!last) last = ms;
  const frame = clamp(
    (ms - last) / 1000,
    0,
    renderer.isSoftwareRenderer ? 0.5 : 0.15,
  );
  last = ms;
  if (document.hidden) {
    updateAudio();
    return;
  }
  elapsed += frame;
  const running = started && !menu;
  collisionCool = Math.max(0, collisionCool - frame);
  if (running) {
    const control = input.read();
    accumulator += frame;
    let recoverNeeded = false;
    while (accumulator >= 1 / 60) {
      const before = active.distance;
      const result = simulate(active, control, 1 / 60, world);
      trip += active.distance - before;
      accumulator -= 1 / 60;
      if (result.recover) {
        recoverNeeded = true;
        break;
      }
      if (result.hit && collisionCool <= 0) {
        collisionCool = 2.5;
        toast(
          active.type === "boat"
            ? "这里是浅滩，转向开阔水面"
            : "碰到障碍物了 · 倒退或按复位继续",
          2300,
        );
      }
    }
    if (recoverNeeded) {
      accumulator = 0;
      recover();
    }
  } else accumulator = 0;
  updateModels(elapsed);
  world.update(elapsed);
  updateCamera(frame, elapsed);
  if (started) updateHUD(frame);
  updateAudio();
  const renderStart = performance.now();
  renderer.render(scene, camera);
  document.body.dataset.frameMs = Math.round(performance.now() - renderStart);
  document.body.dataset.renderer = renderer.isSoftwareRenderer
    ? "software"
    : "webgl";
}
renderer.setAnimationLoop(animate);
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  $("#fatal").hidden = false;
  $("#fatal-message").textContent =
    "画面连接中断。请重新加载，或关闭其他占用较多资源的应用后重试。";
});
document.addEventListener("visibilitychange", () => {
  last = 0;
  if (document.hidden && started && !menu) openMenu("pause");
});
$("#start-btn").onclick = () => {
  started = true;
  $("#intro").hidden = true;
  $("#hud").hidden = false;
  syncMode();
  snapCamera = true;
  clearControls();
  toast(
    renderer.isSoftwareRenderer
      ? "已启用兼容画面 · 随时点「换载具」探索陆海空"
      : "欢迎来到你的海岛 · 左侧转向，右侧加速 · 随时点「换载具」",
    6000,
  );
};
$("#start-label").textContent = "开始自由探索";
$("#start-btn").disabled = false;
syncMode();
updateModels(0);
drawMap($("#minimap"), states, active);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
}
