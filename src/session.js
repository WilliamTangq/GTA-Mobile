import {
  SPECS,
  createState,
  isLand,
  isRoad,
  blocked,
  clamp,
  wrapAngle,
  FOOT_GROUND,
  FOOT_SWIM,
  updateParkedCollider,
} from "./physics.js";
export const SAVE_KEY = "island-drive-session-v1";
const types = Object.keys(SPECS).filter((t) => t !== "foot");
const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);
function cleanState(value, type, colliders) {
  const fallback = createState(type),
    spec = SPECS[type];
  if (
    !value ||
    !["x", "y", "z", "heading"].every((k) => Number.isFinite(value[k]))
  )
    return fallback;
  if (Math.abs(value.x) > 1650 || Math.abs(value.z) > 1650) return fallback;
  const land = isLand(value.x, value.z);
  if (
    (["car", "bike"].includes(spec.kind) && !land) ||
    (type === "boat" && land) ||
    (["plane", "heli"].includes(type) && value.y < 3 && !land)
  )
    return fallback;
  const s = {
    ...fallback,
    x: value.x,
    z: value.z,
    heading: wrapAngle(value.heading),
    distance: clamp(finite(value.distance, 0), 0, 1e8),
  };
  s.y = ["plane", "heli"].includes(type)
    ? clamp(value.y, spec.spawn[1], 260)
    : type === "foot"
      ? land
        ? FOOT_GROUND
        : FOOT_SWIM
      : spec.spawn[1];
  if (blocked(s.x, s.z, s.y, spec.radius, colliders)) return fallback;
  s.speed = clamp(
    finite(value.speed, 0),
    type === "foot" ? 0 : -spec.max * 0.28,
    spec.max * 1.17,
  );
  if (type !== "plane" || s.y < 3) s.speed = 0;
  s.travelHeading = wrapAngle(finite(value.travelHeading, s.heading));
  s.pitch = clamp(finite(value.pitch, 0), -0.3, 0.3);
  s.vertical = clamp(finite(value.vertical, 0), -12, 12);
  if (type !== "plane") {
    s.vertical = 0;
    s.pitch = 0;
  }
  return s;
}
export function encodeSession(states, active, trip, camera, settings) {
  const snapshot = (s) =>
    Object.fromEntries(
      [
        "type",
        "x",
        "y",
        "z",
        "heading",
        "speed",
        "travelHeading",
        "pitch",
        "vertical",
        "distance",
      ].map((k) => [k, s[k]]),
    );
  return JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    vehicles: Object.fromEntries(types.map((t) => [t, snapshot(states[t])])),
    active: snapshot(active),
    trip,
    camera,
    settings,
  });
}
export function decodeSession(text, colliders = []) {
  try {
    const data = JSON.parse(text);
    if (
      data?.version !== 1 ||
      !data.vehicles ||
      !data.active ||
      !Object.hasOwn(SPECS, data.active.type)
    )
      return null;
    const states = Object.fromEntries(
      types.map((t) => [t, cleanState(data.vehicles[t], t, colliders)]),
    );
    const active =
      data.active.type === "foot"
        ? cleanState(data.active, "foot", [
            ...colliders,
            ...Object.values(states).map((s) => updateParkedCollider(s)),
          ])
        : states[data.active.type];
    const c = data.camera || {},
      o = data.settings || {};
    return {
      states,
      active,
      trip: clamp(finite(data.trip, 0), 0, 1e8),
      camera: {
        mode: clamp(Math.floor(finite(c.mode, 0)), 0, 2),
        zoom: clamp(finite(c.zoom, 1), 0.7, 2.5),
        footYaw: wrapAngle(finite(c.footYaw, active.heading)),
        elevation: clamp(finite(c.elevation, 0), -0.15, 1),
      },
      settings: {
        daytime: ["sunset", "day", "night"].includes(o.daytime)
          ? o.daytime
          : "sunset",
      },
      savedAt: finite(data.savedAt, 0),
    };
  } catch {
    return null;
  }
}
export function readSession(storage, colliders = []) {
  try {
    return decodeSession(storage.getItem(SAVE_KEY), colliders);
  } catch {
    return null;
  }
}
export function writeSession(storage, text) {
  try {
    storage.setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;
  }
}
export function createRecoveryTracker(colliders = []) {
  const history = new Map(),
    timers = new Map();
  function eligible(s) {
    const land = isLand(s.x, s.z),
      kind = SPECS[s.type].kind;
    if (blocked(s.x, s.z, s.y, SPECS[s.type].radius + 1, colliders))
      return false;
    if (kind === "boat")
      return (
        !land &&
        [
          [7, 0],
          [-7, 0],
          [0, 7],
          [0, -7],
        ].every(([x, z]) => !isLand(s.x + x, s.z + z))
      );
    if (["plane", "heli"].includes(kind)) return land && s.y < 2.5;
    if (kind === "foot") return land && s.y < 0.4;
    return land && isRoad(s.x, s.z) && s.waterTime === 0;
  }
  return {
    seed(s) {
      history.set(s.type, [eligible(s) ? { ...s } : createState(s.type)]);
      timers.set(s.type, 0);
    },
    record(s, dt) {
      const time = (timers.get(s.type) || 0) + dt;
      if (time < 1) {
        timers.set(s.type, time);
        return;
      }
      timers.set(s.type, 0);
      if (!eligible(s)) return;
      const points = history.get(s.type) || [createState(s.type)],
        last = points.at(-1);
      if (Math.hypot(s.x - last.x, s.z - last.z) < 3) return;
      points.push({ ...s });
      if (points.length > 12) points.shift();
      history.set(s.type, points);
    },
    recover(s) {
      const points = history.get(s.type) || [createState(s.type)],
        point = points.length > 2 ? points.at(-3) : points.at(-1);
      return {
        ...createState(s.type),
        ...point,
        speed: 0,
        vertical: 0,
        pitch: 0,
        roll: 0,
        steering: 0,
        travelHeading: point.heading,
        waterTime: 0,
        drift: 0,
        distance: s.distance,
      };
    },
  };
}
