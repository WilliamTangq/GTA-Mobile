// Pure simulation: metres, seconds, radians. Models face local +Z.
export const FOOT_GROUND = 0.02,
  FOOT_SWIM = -2.65;
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
  taxi: {
    name: "City Cab",
    label: "出租车",
    kind: "car",
    max: 45,
    accel: 12,
    drag: 1,
    turn: 1.55,
    radius: 1.5,
    spawn: [20, 0.7, -145, 0],
    color: 0xeec957,
  },
  police: {
    name: "Interceptor",
    label: "警车",
    kind: "car",
    max: 64,
    accel: 18,
    drag: 0.9,
    turn: 1.65,
    radius: 1.5,
    spawn: [120, 0.7, -250, Math.PI / 2],
    color: 0x91b5c6,
  },
  truck: {
    name: "Cargo Van",
    label: "货车",
    kind: "car",
    max: 34,
    accel: 8,
    drag: 1.3,
    turn: 1.1,
    radius: 1.8,
    spawn: [-80, 0.7, 150, Math.PI],
    color: 0xb6cabb,
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
export const wrapAngle = (value) =>
  Math.atan2(Math.sin(value), Math.cos(value));
export function isRoad(x, z) {
  return (
    isLand(x, z) &&
    ((x >= -205 &&
      x <= 245 &&
      [-350, -250, -150, -50, 50, 150, 250, 350].some(
        (a) => Math.abs(z - a) < 8.5,
      )) ||
      (Math.abs(z) < 379 &&
        [-180, -80, 20, 120, 220].some((a) => Math.abs(x - a) < 8.5)) ||
      (Math.abs(x + 335) < 25 && z > -335 && z < 200) ||
      (x > -300 && x < -235 && z > 200 && z < 275) ||
      (x > -320 && x < -180 && Math.abs(z - 310) < 9))
  );
}
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
    steering: 0,
    travelHeading: heading,
    drift: 0,
    acceleration: 0,
  };
}
export function blocked(x, z, y, r, colliders = []) {
  return colliders.some(
    (b) =>
      b.enabled !== false &&
      y < b.h &&
      x + r > b.x - b.w / 2 &&
      x - r < b.x + b.w / 2 &&
      z + r > b.z - b.d / 2 &&
      z - r < b.z + b.d / 2,
  );
}
export function updateParkedCollider(s, out = {}, enabled = true) {
  const dimensions =
    s.type === "plane"
      ? [11.5, 8]
      : s.type === "heli"
        ? [3, 7]
        : s.type === "boat"
          ? [3.4, 7]
          : s.type === "bike"
            ? [0.8, 2.6]
            : s.type === "truck"
              ? [2.6, 5.8]
              : [2.4, 4.8];
  const c = Math.abs(Math.cos(s.heading)),
    n = Math.abs(Math.sin(s.heading));
  out.x = s.x;
  out.z = s.z;
  out.w = dimensions[0] * c + dimensions[1] * n;
  out.d = dimensions[1] * c + dimensions[0] * n;
  out.h = s.y + 2;
  out.enabled = enabled && (!["plane", "heli"].includes(s.type) || s.y < 3);
  return out;
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
  const vectorWalk = kind === "foot" && Number.isFinite(input.cameraHeading);
  let walkHeading = s.travelHeading ?? s.heading,
    walkAmount = 0;
  if (vectorWalk) {
    const mx = clamp(input.moveX || 0, -1, 1),
      mz = clamp(input.moveZ || 0, -1, 1),
      yaw = input.cameraHeading;
    walkAmount = Math.min(1, Math.hypot(mx, mz));
    if (walkAmount > 0.001) {
      walkHeading = Math.atan2(
        Math.sin(yaw) * mz - Math.cos(yaw) * mx,
        Math.cos(yaw) * mz + Math.sin(yaw) * mx,
      );
      s.heading +=
        wrapAngle(walkHeading - s.heading) * (1 - Math.exp(-14 * dt));
    }
  }
  const wheeled = kind === "car" || kind === "bike",
    onRoad = isRoad(s.x, s.z),
    previousSpeed = s.speed;
  s.braking = wheeled && (input.brake || (throttle < 0 && s.speed > 1));
  s.steering = approach(s.steering ?? 0, steer, wheeled ? 7 : 10, dt);
  if (kind === "foot") {
    const max = ground ? (input.boost ? 11 : 6) : 3;
    s.speed = approach(
      s.speed,
      (vectorWalk ? walkAmount : throttle) * max,
      10,
      dt,
    );
  } else {
    let force = throttle * spec.accel;
    if (throttle < 0 && s.speed > 1)
      force = throttle * (kind === "plane" ? 19 : 27);
    if (input.brake) force = -Math.sign(s.speed) * (wheeled ? 10 : 35);
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
    if (wheeled && !onRoad && s.type !== "suv")
      force = force > 0 ? force * 0.65 : force;
    s.speed = clamp(
      s.speed + force * dt,
      -(flying ? 0 : spec.max * 0.28),
      spec.max *
        (input.boost ? 1.17 : 1) *
        (wheeled && !onRoad && s.type !== "suv" ? 0.65 : 1),
    );
  }
  const turnFactor =
    kind === "foot" || kind === "heli"
      ? 1
      : Math.min(Math.abs(s.speed) / 7, 1) * (s.speed < 0 ? -1 : 1);
  if (!vectorWalk)
    s.heading -=
      s.steering *
      spec.turn *
      turnFactor *
      dt *
      (kind === "car"
        ? (1 - 0.55 * Math.min(Math.abs(s.speed) / spec.max, 1)) *
          (input.brake ? 1.45 : 1)
        : 1);
  s.acceleration = dt > 0 ? (s.speed - previousSpeed) / dt : 0;
  if (wheeled) {
    const grip = input.brake && Math.abs(s.speed) > 7 ? 1.5 : onRoad ? 9 : 4;
    s.travelHeading =
      (s.travelHeading ?? s.heading) +
      wrapAngle(s.heading - (s.travelHeading ?? s.heading)) *
        (1 - Math.exp(-grip * dt));
    s.drift =
      Math.abs(wrapAngle(s.heading - s.travelHeading)) *
      Math.min(Math.abs(s.speed) / 10, 1);
    s.pitch = approach(
      s.pitch,
      clamp(s.acceleration * 0.002, -0.045, 0.035),
      5,
      dt,
    );
  } else {
    s.travelHeading = vectorWalk ? walkHeading : s.heading;
    s.drift = 0;
  }
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
  else if (kind === "foot") {
    const floor = ground ? FOOT_GROUND : FOOT_SWIM;
    if (!ground) {
      s.y = floor;
      s.vertical = 0;
      s.grounded = true;
    } else {
      s.grounded = s.y <= floor + 0.01;
      if (input.jump && !s.jumpHeld && s.grounded) {
        s.vertical = 7.2;
        s.grounded = false;
      }
      s.vertical -= 18 * dt;
      s.y = Math.max(floor, s.y + s.vertical * dt);
      if (s.y <= floor) {
        s.vertical = 0;
        s.grounded = true;
      }
    }
    s.jumpHeld = !!input.jump;
  }
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
    dx = Math.sin(s.travelHeading) * velocity * dt,
    dz = Math.cos(s.travelHeading) * velocity * dt;
  const nx = s.x + dx,
    nz = s.z + dz;
  if (kind === "boat" && isLand(nx, nz)) {
    s.speed *= -0.25;
    s.hit = true;
  } else if (blocked(nx, nz, s.y, spec.radius, env.colliders)) {
    if (kind === "foot") {
      const oldX = s.x,
        oldZ = s.z;
      if (!blocked(nx, s.z, s.y, spec.radius, env.colliders)) s.x = nx;
      if (!blocked(s.x, nz, s.y, spec.radius, env.colliders)) s.z = nz;
      if (Math.hypot(s.x - oldX, s.z - oldZ) < 0.00001) s.speed = 0;
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
  // Count only movement actually accepted by collision handling.
  s.distance += Math.hypot(s.x - (nx - dx), s.z - (nz - dz));
  return {
    recover:
      s.waterTime > 1.2 ||
      Math.abs(s.x) > 1700 ||
      Math.abs(s.z) > 1700 ||
      (flying && s.hit),
    hit: s.hit,
  };
}
