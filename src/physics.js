// Pure simulation: metres, seconds, radians. Models face local +Z.
export const COAST = [
  [-450, -500],
  [-220, -570],
  [220, -540],
  [330, -430],
  [340, -160],
  [295, 50],
  [300, 230],
  [235, 440],
  [80, 535],
  [-150, 520],
  [-370, 410],
  [-465, 160],
  [-470, -220],
];
export const SPECS = {
  sport: {
    name: "Comet GT",
    label: "跑车",
    kind: "car",
    max: 61,
    accel: 17,
    drag: 0.85,
    turn: 1.65,
    radius: 1.45,
    spawn: [220, 0.7, 240, Math.PI],
    color: 0xff694c,
  },
  suv: {
    name: "Trailrunner",
    label: "越野车",
    kind: "car",
    max: 43,
    accel: 11,
    drag: 1,
    turn: 1.4,
    radius: 1.7,
    spawn: [220, 0.9, 260, Math.PI],
    color: 0xeee8d9,
  },
  bike: {
    name: "Nightshift",
    label: "摩托车",
    kind: "bike",
    max: 68,
    accel: 21,
    drag: 0.9,
    turn: 1.9,
    radius: 0.7,
    spawn: [214, 0.65, 230, Math.PI],
    color: 0xecc96c,
  },
  plane: {
    name: "Skylark",
    label: "螺旋桨飞机",
    kind: "plane",
    max: 85,
    accel: 12,
    drag: 0.55,
    turn: 0.64,
    radius: 3.5,
    spawn: [-335, 1.1, 185, Math.PI],
    color: 0xece8de,
  },
  heli: {
    name: "Dragonfly",
    label: "直升机",
    kind: "heli",
    max: 42,
    accel: 9,
    drag: 2.5,
    turn: 1.3,
    radius: 2.4,
    spawn: [-265, 1.35, 240, Math.PI],
    color: 0x52c4bf,
  },
  boat: {
    name: "Daybreaker",
    label: "快艇",
    kind: "boat",
    max: 36,
    accel: 8,
    drag: 1.9,
    turn: 1.1,
    radius: 2,
    spawn: [362, -0.45, 215, 0],
    color: 0xf2e7cf,
  },
  foot: {
    name: "自由探索",
    label: "步行",
    kind: "foot",
    max: 6,
    accel: 28,
    drag: 12,
    turn: 2.8,
    radius: 0.5,
    spawn: [215, 0, 240, Math.PI],
    color: 0xffffff,
  },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const approach = (v, target, rate, dt) =>
  v + (target - v) * (1 - Math.exp(-rate * dt));
export function isLand(x, z) {
  let inside = false;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i++) {
    const a = COAST[i],
      b = COAST[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function createState(type) {
  const [x, y, z, heading] = SPECS[type].spawn;
  return {
    type,
    x,
    y,
    z,
    heading,
    speed: 0,
    pitch: 0,
    roll: 0,
    vertical: 0,
    waterTime: 0,
    distance: 0,
    hit: false,
  };
}
export function blocked(x, z, y, r, colliders = []) {
  return colliders.some(
    (b) =>
      y < b.h &&
      x + r > b.x - b.w / 2 &&
      x - r < b.x + b.w / 2 &&
      z + r > b.z - b.d / 2 &&
      z - r < b.z + b.d / 2,
  );
}
export function simulate(s, input, dt, env = {}) {
  dt = clamp(dt, 0, 0.05);
  const spec = SPECS[s.type],
    kind = spec.kind;
  s.hit = false;
  const throttle = clamp(input.throttle || 0, -1, 1),
    steer = clamp(input.steer || 0, -1, 1),
    climb = clamp(input.climb || 0, -1, 1);
  const ground = isLand(s.x, s.z),
    flying = kind === "plane" || kind === "heli";
  if (kind === "foot") {
    const max = ground ? (input.boost ? 11 : 6) : 3;
    s.speed = approach(s.speed, throttle * max, 10, dt);
  } else {
    let force = throttle * spec.accel;
    if (throttle < 0 && s.speed > 1)
      force = throttle * (kind === "plane" ? 19 : 27);
    if (input.brake) force = -Math.sign(s.speed) * 35;
    if (!throttle && !input.brake)
      force =
        -Math.sign(s.speed) *
        Math.min(
          Math.abs(s.speed) / Math.max(dt, 0.001),
          spec.drag +
            (kind === "heli"
              ? Math.abs(s.speed) * 0.8
              : Math.abs(s.speed) * 0.018),
        );
    if (input.boost && throttle > 0 && ["car", "bike", "boat"].includes(kind))
      force *= 1.35;
    s.speed = clamp(
      s.speed + force * dt,
      -(flying ? 0 : spec.max * 0.28),
      spec.max * (input.boost ? 1.17 : 1),
    );
  }
  const turnFactor =
    kind === "foot" || kind === "heli"
      ? 1
      : Math.min(Math.abs(s.speed) / 7, 1) * (s.speed < 0 ? -1 : 1);
  s.heading -=
    steer *
    spec.turn *
    turnFactor *
    dt *
    (kind === "car" ? 1 - 0.55 * Math.min(Math.abs(s.speed) / spec.max, 1) : 1);
  if (kind === "plane") {
    const lift = clamp((s.speed - 23) / 20, 0, 1);
    s.pitch = approach(
      s.pitch,
      climb > 0 ? 0.27 : climb < 0 ? -0.24 : s.y > 3 ? 0.015 : 0.12,
      2.4,
      dt,
    );
    s.vertical = approach(
      s.vertical,
      lift * (s.pitch * s.speed + 1.1) - (1 - lift) * 9,
      2,
      dt,
    );
    s.y += s.vertical * dt;
    if (s.y < 1.1) {
      if (!ground || s.vertical < -11) s.hit = true;
      s.y = 1.1;
      s.vertical = 0;
    }
    s.y = clamp(s.y, 1.1, 260);
  } else if (kind === "heli") {
    s.vertical = approach(s.vertical, climb * 12, 3, dt);
    s.y = clamp(s.y + s.vertical * dt, 1.35, 260);
    if (!ground && s.y < 1.5) s.hit = true;
    s.pitch = approach(s.pitch, throttle * 0.13, 3, dt);
  } else if (kind === "boat") s.y = -0.45;
  else if (kind === "foot") s.y = ground ? 0.25 : -0.85;
  s.roll = approach(
    s.roll,
    -steer *
      (kind === "plane"
        ? 0.45
        : kind === "bike"
          ? 0.28
          : kind === "heli"
            ? 0.15
            : 0.025) *
      Math.min(Math.abs(s.speed) / 10, 1),
    4,
    dt,
  );
  const velocity = s.speed * (kind === "plane" ? Math.cos(s.pitch) : 1),
    dx = Math.sin(s.heading) * velocity * dt,
    dz = Math.cos(s.heading) * velocity * dt;
  const nx = s.x + dx,
    nz = s.z + dz;
  if (kind === "boat" && isLand(nx, nz)) {
    s.speed *= -0.25;
    s.hit = true;
  } else if (blocked(nx, nz, s.y, spec.radius, env.colliders)) {
    if (kind === "foot") {
      if (!blocked(nx, s.z, s.y, spec.radius, env.colliders)) s.x = nx;
      if (!blocked(s.x, nz, s.y, spec.radius, env.colliders)) s.z = nz;
    } else {
      s.speed *= -0.22;
      s.hit = true;
    }
  } else {
    s.x = nx;
    s.z = nz;
  }
  if (["car", "bike"].includes(kind)) {
    s.waterTime = !isLand(s.x, s.z) ? s.waterTime + dt : 0;
    if (s.waterTime > 0) {
      s.speed *= Math.exp(-3 * dt);
      s.y = approach(s.y, -1.5, 2, dt);
    }
  }
  s.distance += Math.hypot(dx, dz);
  return {
    recover:
      s.waterTime > 1.2 ||
      Math.abs(s.x) > 1700 ||
      Math.abs(s.z) > 1700 ||
      (flying && s.hit),
    hit: s.hit,
  };
}
