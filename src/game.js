import * as T from "../vendor/three.module.js";
import {
  SPECS,
  createState,
  simulate,
  isLand,
  blocked,
  clamp,
  approach,
  isRoad,
  wrapAngle,
  FOOT_GROUND,
  FOOT_SWIM,
  updateParkedCollider,
} from "./physics.js";
import { createWorld, drawMap, district, DESTINATIONS } from "./world.js";
import { makeVehicle, makePerson } from "./vehicles.js";
import { resolveCamera } from "./camera.js";
import { createInput } from "./input.js";
import { SoftwareRenderer } from "./software-renderer.js";
import { createInteractions, takeTrafficCar } from "./interactions.js";
import { createAtmosphere } from "./visuals.js";
import { createTraffic } from "./traffic.js";
import { createEffects } from "./effects.js";
import { loadVehicleAssets, upgradeVehicle } from "./asset-vehicles.js";
import { createAdaptiveQuality } from "./performance.js";
import {
  readSession,
  writeSession,
  encodeSession,
  createRecoveryTracker,
} from "./session.js";

const $ = (s) => document.querySelector(s),
  canvas = $("#game");
let gameInput = null,
  sceneDirty = true;
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
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.background = new T.Color(0xb9c7c2);
scene.fog = new T.Fog(0xc8c7bd, 160, 1050);
const atmosphere=createAtmosphere(scene,renderer);
const camera = new T.PerspectiveCamera(58, 1, 0.2, 3000);
const hemi = new T.HemisphereLight(0xd6ecf0, 0xb09a78, 2.5);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffd4a5, 3.0);
sun.position.set(-130, 100, 130);
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
const traffic = createTraffic(scene),
  effects = createEffects(scene);
const interactions = createInteractions();
const pursuitModels = interactions.police.map(() => {const m=makeVehicle("police");scene.add(m);return m;});
const parkedColliders = Object.fromEntries(
  Object.keys(states).map((t) => [
    t,
    updateParkedCollider(states[t], {}, false),
  ]),
);
const simulationEnv = {
  colliders: [
    ...world.colliders,
    ...traffic.colliders,
    ...Object.values(parkedColliders),
  ],
};
const recovery = createRecoveryTracker(world.colliders);
for (const state of Object.values(states)) recovery.seed(state);
let savedSession = null;
try {
  savedSession = readSession(localStorage, world.colliders);
} catch {}
const adaptiveQuality = createAdaptiveQuality();
let trafficDensity = "low";
try {
  trafficDensity = localStorage.getItem("island-traffic") || "low";
} catch {}
traffic.setDensity(trafficDensity);
loadVehicleAssets()
  .then((count) => {
    for (const [type, model] of Object.entries(models))
      upgradeVehicle(model, type);
    traffic.upgrade();
    pursuitModels.forEach(m=>upgradeVehicle(m,"police"));
    document.body.dataset.assetModels = String(count);
  })
  .catch(() => {});
let active = states.sport,
  started = false,
  menu = null,
  previousFocus = null,
  elapsed = 0,
  trip = 0,
  cameraMode = 0,
  orbit = 0,
  zoom = 1,
  quality = "auto",
  daytime = "sunset",
  last = 0,
  mapTick = 0,
  hudTick = 0,
  toastTimer = 0,
  collisionCool = 0,
  footCameraYaw = Math.PI,
  cameraElevation = 0,
  lastCameraGesture = 0,
  saveTimer = 0,
  renderCount = 0;
const vPos = new T.Vector3(),
  vTarget = new T.Vector3(),
  smoothLook = new T.Vector3();
let snapCamera = true;
let sound = false,
  audio = null;
try {
  quality = localStorage.getItem("island-quality") || "auto";
  if (!["auto", "low", "high"].includes(quality)) quality = "auto";
} catch {}
$("#quality").value = quality;
function resize(resetControls = true) {
  const w = window.innerWidth,
    h = window.innerHeight;
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio || 1,
      quality === "high" ? 1.75 : quality === "low" ? 1 : adaptiveQuality.scale,
    ),
  );
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.shadowMap.enabled = quality === "high";
  sceneDirty = true;
  if (resetControls) gameInput?.reset();
}
window.addEventListener("resize", () => resize());
window.visualViewport?.addEventListener("resize", () => resize());
resize();
function toast(message, duration = 3800) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), duration);
}
function saveProgress() {
  if (!started) return false;
  let ok = false;
  try {
    ok = writeSession(
      localStorage,
      encodeSession(
        states,
        active,
        trip,
        {
          mode: cameraMode,
          zoom,
          footYaw: footCameraYaw,
          elevation: cameraElevation,
        },
        { daytime },
      ),
    );
  } catch {}
  $("#save-status").textContent = ok
    ? "进度已保存在此设备"
    : "此浏览器暂时无法保存进度";
  return ok;
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
  saveProgress();
  sceneDirty = true;
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
  document.body.classList.toggle("wheeled", ["car", "bike"].includes(s.kind));
  const walking = s.kind === "foot";
  document.body.classList.toggle("walking", walking);
  if (walking) footCameraYaw = wrapAngle(active.heading + orbit);
  $("#jump-btn").hidden = !walking || !isLand(active.x, active.z);
  $("#control-caption").textContent = walking ? "移动方向" : "转向";
  $("#gas-label").textContent = walking ? "前进" : "加速";
  $("#brake-label").textContent = walking ? "后退" : "刹车 / 倒退";
  $(".keyboard-help > span:first-child").innerHTML =
    "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> " +
    (walking ? "移动" : "驾驶");
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
  const safe = recovery.recover(active);
  if (type === "foot") active = safe;
  else {
    Object.assign(states[type], safe);
    active = states[type];
  }
  syncMode();
  snapCamera = true;
  orbit = 0;
  clearControls();
  toast("已回到附近的安全位置");
}
function nearbyVehicle() {
  let near=null,best=8;
  for(const state of Object.values(states)) {
    const d=Math.hypot(state.x-active.x,state.z-active.z);
    if(d<best && state.y<3){near={state};best=d;}
  }
  for(const actor of traffic.simulation.actors) {
    if(actor.kind!=="car" || !actor.enabled) continue;
    const d=Math.hypot(actor.agent.position.x-active.x,actor.agent.position.z-active.z);
    if(d<best){near={actor};best=d;}
  }
  return near;
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
      y: isLand(p.x, p.z) ? FOOT_GROUND : FOOT_SWIM,
      heading: old.heading,
    };
    syncMode();
    toast(
      isLand(p.x, p.z)
        ? "已下车 · 靠近载具可以重新上车"
        : "现在可以游泳 · 靠近快艇重新上船",
    );
    recovery.seed(active);
  } else {
    const near=nearbyVehicle();
    if(!near) {toast("靠近路上的车辆，按上车接管；也可以打开换载具");return;}
    if(near.actor) {
      const stolen=takeTrafficCar(near.actor);
      if(!stolen) return;
      Object.assign(states[stolen.type],stolen);
      active=states[stolen.type];
      interactions.report(near.actor.type==="police"?2:1);
      recovery.seed(active);
    } else active=near.state;
    syncMode();
    toast(`已进入 ${SPECS[active.type].name}`);
  }
  snapCamera = true;
  orbit = 0;
  clearControls();
}
function handleAction(name, value) {
  if (name === "orbit") {
    if (started && !menu) {
      if (active.type === "foot")
        footCameraYaw = wrapAngle(footCameraYaw + value);
      else orbit = wrapAngle(orbit + value);
      lastCameraGesture = elapsed;
      sceneDirty = true;
    }
    return;
  }
  if (name === "look-pitch") {
    if (started && !menu) {
      cameraElevation = clamp(cameraElevation + value, -0.15, 1);
      lastCameraGesture = elapsed;
      sceneDirty = true;
    }
    return;
  }
  if (name === "zoom") {
    if (started && !menu) {
      zoom = clamp(zoom + value, 0.7, 2.5);
      lastCameraGesture = elapsed;
      sceneDirty = true;
    }
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
    cameraElevation = 0;
    snapCamera = true;
    toast(["跟随镜头", "贴近镜头", "俯瞰镜头"][cameraMode], 1700);
  }
}
const input = createInput(canvas, handleAction, () => active.type);
gameInput = input;
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
  taxi: "car",
  police: "car",
  truck: "suv",
};
const locations = {
  sport: "海岸公路",
  suv: "海岸公路",
  bike: "海岸公路",
  plane: "海岛机场",
  heli: "直升机坪",
  boat: "日落码头",
  taxi: "城市中心",
  police: "城市中心",
  truck: "城市中心",
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
  resize(false);
};
$("#daytime").onchange = (e) => {
  daytime = e.target.value;
  const themes = {
    sunset: [0xd5bda6, 0xc1d7ed, 0x7c6855, 0xffcca0, 1.8, 3.5, 1.05],
    day: [0x9ccfe0, 0xc6e9ff, 0x9aab83, 0xfff5dd, 2.8, 3.2, 1.2],
    night: [0x263d5b, 0x6d9bcb, 0x273944, 0x90b4da, 1.0, 1.1, 1.15],
  };
  const [sky, hi, lo, sc, h, s, exposure] = themes[daytime];
  atmosphere.setTime(daytime);
  world.setTime(daytime);
  scene.background.set(sky);
  scene.fog.color.set(sky);
  hemi.color.set(hi);
  hemi.groundColor.set(lo);
  hemi.intensity = h;
  sun.color.set(sc);
  sun.intensity = s;
  renderer.toneMappingExposure = exposure;
  sunDisc.visible = daytime !== "night";
  sceneDirty = true;
};
$("#daytime").onchange({target:{value:daytime}});
$("#traffic-density").value = traffic.simulation.density;
$("#traffic-density").onchange = (e) => {
  traffic.setDensity(e.target.value);
  try {
    localStorage.setItem("island-traffic", e.target.value);
  } catch {}
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
    if (["car", "bike"].includes(SPECS[type].kind))
      body.position.y =
        Math.sin(s.distance * 2) *
        Math.min(Math.abs(s.speed) / 15, 1) *
        (isRoad(s.x, s.z) ? 0.006 : 0.025);
    for (const w of model.userData.wheels) w.rotation.x = s.distance * 2;
    for (const pivot of model.userData.steering || [])
      pivot.rotation.y = -s.steering * 0.4;
    if (model.userData.tailMat)
      model.userData.tailMat.color.set(s.braking ? 0xff5438 : 0x923a33);
    if (model.userData.siren)
      model.userData.siren.children.forEach(
        (m, i) =>
          (m.visible = active === s ? Math.floor(t * 7) % 2 === i : true),
      );
    for (const { mesh, axis } of model.userData.rotors)
      mesh.rotation[axis] =
        t * (s === active ? (active.type === "heli" ? 38 : 48) : 4);
  }
  if (active.type === "foot") {
    person.position.set(active.x, active.y, active.z);
    const swimming = !isLand(active.x, active.z);
    person.rotation.set(swimming ? -0.45 : 0, active.heading, 0, "YXZ");
    const a =
      Math.sin(active.distance * 1.3) *
      Math.min(Math.abs(active.speed) / 5, 1) *
      0.6;
    person.userData.limbs.forEach(
      (l, i) =>
        (l.rotation.x = a * (i % 2 ? -1 : 1) + (swimming && i > 1 ? 1.4 : 0)),
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
    fly = ["plane", "heli"].includes(spec.kind);
  if (
    active.type !== "foot" &&
    Math.abs(active.speed) > 3 &&
    t - lastCameraGesture > 3
  ) {
    orbit = approach(orbit, 0, 1.2, dt);
    cameraElevation = approach(cameraElevation, 0, 1.2, dt);
  }
  const h = active.type === "foot" ? footCameraYaw : active.heading + orbit;
  let distance =
      spec.kind === "foot" ? 6 : fly ? 24 : spec.kind === "boat" ? 14 : 10,
    height = fly ? 8 : spec.kind === "foot" ? 2.8 : 3.3;
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
  height = Math.max(1.3, height + distance * cameraElevation);
  vPos.set(
    active.x - Math.sin(h) * distance,
    active.y + height * zoom,
    active.z - Math.cos(h) * distance,
  );
  vTarget.set(
    active.x + Math.sin(active.heading) * (active.type === "foot" ? 0 : 4),
    active.y +
      (active.type === "foot"
        ? !isLand(active.x, active.z)
          ? 1.9
          : 1.15
        : fly
          ? 1
          : 0.8),
    active.z + Math.cos(active.heading) * (active.type === "foot" ? 0 : 4),
  );
  const intendedDistance=vPos.distanceTo(vTarget);
  const clear=resolveCamera(vTarget,vPos,world.colliders);
  vPos.set(clear.x,clear.y,clear.z);
  // Pull inward immediately at walls, ease outward when the view clears.
  const obstructed=vPos.distanceTo(vTarget)<intendedDistance-.1;
  const k=snapCamera || obstructed ? 1 : 1-Math.exp(-5*dt);
  camera.position.lerp(vPos,k);
  const final=resolveCamera(vTarget,camera.position,world.colliders);
  camera.position.set(final.x,final.y,final.z);
  smoothLook.lerp(vTarget,snapCamera?1:1-Math.exp(-9*dt));
  camera.lookAt(smoothLook);
  snapCamera = false;
  const fov = 55 + n * 6;
  if (Math.abs(camera.fov - fov) > 0.1) {
    camera.fov = approach(camera.fov,fov,4,dt);
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
        : active.drift > 0.16
          ? "漂移中"
          : !isRoad(active.x, active.z) && kind === "car"
            ? "草地行驶"
            : "自由驾驶";
    const chase=interactions;
    $("#wanted").hidden=!chase.level;
    $("#wanted").textContent="★".repeat(chase.level)+"☆".repeat(3-chase.level)+" · "+(chase.phase==="search"?`搜索中 ${Math.ceil(18-chase.unseen)}s`:chase.arrest>0?"即将被拦截 · 加速离开":"警察追逐 · 拉开距离");
    document.body.dataset.wanted=String(chase.level);
    if(kind==="foot") $("#enter-label").textContent=nearbyVehicle()?.actor?"接管车辆":"上车";
    if(kind!=="foot") $("#brake-label").textContent=active.speed>1?"刹车":active.speed<-.15?"倒退":"长按倒退";
    $("#jump-btn").hidden = kind !== "foot" || !isLand(active.x, active.z);
  }
  if (mapTick > 0.2) {
    mapTick = 0;
    drawMap($("#minimap"), states, active);
  }
}
let accumulator = 0;
let fpsMs = 40;
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
  if (started && menu && !sceneDirty) {
    updateAudio();
    return;
  }
  if (!menu) elapsed += frame;
  const running = started && !menu;
  const currentControl = running ? input.read() : {};
  if (active.type === "foot") currentControl.cameraHeading = footCameraYaw;
  if (running && frame > 0) {
    fpsMs += (frame * 1000 - fpsMs) * 0.05;
    if (
      !renderer.isSoftwareRenderer &&
      adaptiveQuality.sample(frame * 1000) &&
      quality === "auto"
    )
      resize(false);
  }
  collisionCool = Math.max(0, collisionCool - frame);
  if (running) {
    for (const [type, state] of Object.entries(states))
      updateParkedCollider(state, parkedColliders[type], state !== active);
    const control = currentControl;
    accumulator += frame;
    let recoverNeeded = false;
    while (accumulator >= 1 / 60) {
      const before = active.distance, impactSpeed=Math.abs(active.speed);
      traffic.simulation.step(1 / 60, active);
      const result = simulate(active, control, 1 / 60, simulationEnv);
      if(result.hit && impactSpeed>5 && active.type!=="foot" && traffic.simulation.actors.some(a=>a.kind==="car" && a.enabled && Math.hypot(a.agent.position.x-active.x,a.agent.position.z-active.z)<9)) interactions.report(1);
      const event=interactions.step(1/60,active);
      if(event==="caught") {active.speed=0;toast("被警察拦截 · 通缉已解除，可以继续探索",3500);}
      if(event==="escaped") toast("成功甩开警察 · 通缉已解除",3000);
      recovery.record(active, 1 / 60);
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
  for(const [i,p] of interactions.police.entries()) {
    const m=pursuitModels[i];m.visible=p.enabled;
    if(!p.enabled) continue;
    m.position.set(p.x,p.y,p.z);m.rotation.y=p.heading;
    for(const w of m.userData.wheels||[]) w.rotation.x=p.distance*2;
    for(const [j,l] of (m.userData.siren?.children||[]).entries()) l.visible=Math.floor(elapsed*8+j)%2===0;
  }
  traffic.update(active, renderer.isSoftwareRenderer);
  effects.update(frame, active, currentControl, running);
  world.update(elapsed);
  atmosphere.update(active);
  updateCamera(frame, elapsed);
  if (started) updateHUD(frame);
  if (running) {
    saveTimer += frame;
    if (saveTimer >= 5) {
      saveTimer = 0;
      saveProgress();
    }
  }
  $("#performance-status").textContent =
    `游玩 ${Math.round(1000 / Math.max(fpsMs, 1))} FPS · ${quality === "auto" ? "自动画质" : quality === "low" ? "流畅画质" : "清晰画质"}`;
  updateAudio();
  const renderStart = performance.now();
  renderer.render(scene, camera);
  document.body.dataset.frameMs = Math.round(performance.now() - renderStart);
  document.body.dataset.renderer = renderer.isSoftwareRenderer
    ? "software"
    : "webgl";
  document.body.dataset.renderCount = String(++renderCount);
  sceneDirty = false;
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
  if (document.hidden && started) {
    saveProgress();
    if (!menu) openMenu("pause");
  }
});
window.addEventListener("pagehide", saveProgress);
function beginExploration(resume) {
  const restored = resume ? savedSession : null;
  if (restored) {
    for (const [type, state] of Object.entries(restored.states))
      Object.assign(states[type], state);
    active =
      restored.active.type === "foot"
        ? restored.active
        : states[restored.active.type];
    trip = restored.trip;
    cameraMode = restored.camera.mode;
    zoom = restored.camera.zoom;
    cameraElevation = restored.camera.elevation;
    daytime = restored.settings.daytime;
    $("#daytime").value = daytime;
    $("#daytime").onchange({ target: { value: daytime } });
  }
  started = true;
  $("#intro").hidden = true;
  $("#hud").hidden = false;
  syncMode();
  if (restored?.active.type === "foot") footCameraYaw = restored.camera.footYaw;
  for (const state of Object.values(states)) recovery.seed(state);
  recovery.seed(active);
  snapCamera = true;
  clearControls();
  saveProgress();
  sceneDirty = true;
  toast(
    restored
      ? "已继续上次探索 · 镜头支持拖动与双指缩放"
      : renderer.isSoftwareRenderer
        ? "已启用兼容画面 · 随时点「换载具」探索陆海空"
        : "欢迎来到你的海岛 · 左侧转向，右侧加速 · 随时点「换载具」",
    6000,
  );
}
$("#start-btn").onclick = () => beginExploration(!!savedSession);
$("#new-session-btn").onclick = () => {
  savedSession = null;
  beginExploration(false);
};
$("#new-session-btn").hidden = !savedSession;
$("#start-label").textContent = savedSession ? "继续上次探索" : "开始自由探索";
$("#start-btn").disabled = false;
syncMode();
updateModels(0);
drawMap($("#minimap"), states, active);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
}
