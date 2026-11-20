import {
  EntityManager,
  Vehicle,
  Path,
  FollowPathBehavior,
  Vector3,
} from "yuka";
import { clamp, SPECS } from "./physics.js";

export const JUNCTIONS = [20, 120, 220].flatMap((x) =>
  [-150, 50, 250].map((z) => ({ x, z })),
);
export function signalState(time) {
  const phase = ((time % 32) + 32) % 32;
  return {
    ns: phase < 14 ? "green" : phase < 16 ? "amber" : "red",
    ew: phase >= 16 && phase < 30 ? "green" : phase >= 30 ? "amber" : "red",
  };
}
function rectangle(x1, z1, x2, z2, reverse = false) {
  const lane = reverse ? 3.5 : -3.5;
  const corners = [
    [x2 + lane, z2 + lane],
    [x2 + lane, z1 - lane],
    [x1 - lane, z1 - lane],
    [x1 - lane, z2 + lane],
  ];
  if (reverse) corners.reverse();
  const points = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4],
      steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 18);
    for (let j = 0; j < steps; j++)
      points.push([
        a[0] + ((b[0] - a[0]) * j) / steps,
        a[1] + ((b[1] - a[1]) * j) / steps,
      ]);
  }
  return points;
}
const carRoutes = [
  rectangle(-180, -350, 220, 350),
  rectangle(-180, -350, 220, 350, true),
  rectangle(-80, -250, 120, 250),
  rectangle(-80, -250, 120, 250, true),
];
const walkRoutes = [
  rectangle(-180, -350, 220, 350),
  rectangle(-80, -150, 120, 150),
];
function makeAgent(points, offset, speed, kind, type, index) {
  const agent = new Vehicle(),
    path = new Path();
  path.loop = true;
  const at = ((offset % points.length) + points.length) % points.length;
  const first = points[at];
  agent.position.set(
    first[0],
    kind === "car" ? SPECS[type].spawn[1] : 0.2,
    first[1],
  );
  for (let i = 1; i <= points.length; i++) {
    const p = points[(at + i) % points.length];
    path.add(new Vector3(p[0], agent.position.y, p[1]));
  }
  const next = points[(at + 1) % points.length],
    dx = next[0] - first[0],
    dz = next[1] - first[1],
    length = Math.hypot(dx, dz);
  agent.velocity.set((dx / length) * speed, 0, (dz / length) * speed);
  agent.maxSpeed = speed;
  agent.maxForce = kind === "car" ? 45 : 12;
  agent.maxTurnRate = 3.8;
  agent.steering.add(new FollowPathBehavior(path, kind === "car" ? 2.5 : 0.8));
  return {
    agent,
    path,
    kind,
    type,
    index,
    baseSpeed: speed,
    heading: Math.atan2(dx, dz),
    distance: 0,
    enabled: true,
    stopped: false,
    collider: {
      x: first[0],
      z: first[1],
      w: 2.1,
      d: 4.6,
      h: 2.5,
      enabled: kind === "car",
    },
  };
}
export function createTrafficSimulation() {
  const manager = new EntityManager(),
    actors = [];
  const carTypes = [
    "taxi",
    "suv",
    "police",
    "sport",
    "truck",
    "taxi",
    "suv",
    "sport",
  ];
  for (let i = 0; i < 16; i++) {
    const route = carRoutes[i % 4];
    // Two cars are visible from the initial coastal spawn, with room to pass it.
    let offset = Math.floor(route.length * ((i * 0.231 + 0.055) % 1));
    if (i === 0) offset = 8;
    if (i === 1) offset = carRoutes[1].length - 7;
    const a = makeAgent(
      route,
      offset,
      8 + (i % 4) * 1.4,
      "car",
      carTypes[i % carTypes.length],
      i,
    );
    actors.push(a);
    manager.add(a.agent);
  }
  for (let i = 0; i < 12; i++) {
    const base = walkRoutes[i % 2];
    // Follow pavements outside the driving lanes, never the road centre.
    const route = base.map(([x, z]) => [
      x + (x > 20 ? 13.5 : -13.5),
      z + (z > 0 ? 13.5 : -13.5),
    ]);
    const a = makeAgent(
      route,
      Math.floor(route.length * ((i * 0.173 + 0.12) % 1)),
      1.2 + (i % 3) * 0.18,
      "person",
      "foot",
      i,
    );
    actors.push(a);
    manager.add(a.agent);
  }
  const cars = actors.filter((a) => a.kind === "car");
  const simulation = {
    actors,
    time: 0,
    density: "low",
    setDensity(value) {
      this.density = ["off", "low", "high"].includes(value) ? value : "low";
      for (const a of actors) {
        a.enabled =
          this.density !== "off" &&
          (this.density === "high" || a.index < (a.kind === "car" ? 8 : 6));
        a.agent.active = a.enabled;
        a.collider.enabled = a.enabled && a.kind === "car";
      }
    },
    step(dt, player) {
      dt = clamp(dt, 0, 0.05);
      this.time += dt;
      const lights = signalState(this.time);
      for (const a of actors) {
        if (!a.enabled || a.kind !== "car") continue;
        const p = a.agent.position,
          fx = Math.sin(a.heading),
          fz = Math.cos(a.heading);
        let limit = a.baseSpeed;
        for (const b of cars) {
          if (!b.enabled || b === a) continue;
          const q = b.agent.position,
            dx = q.x - p.x,
            dz = q.z - p.z,
            ahead = dx * fx + dz * fz,
            side = Math.abs(dx * fz - dz * fx);
          if (ahead > 0 && ahead < 21 && side < 2.8)
            limit = Math.min(
              limit,
              a.baseSpeed * clamp((ahead - 5) / 15, 0, 1),
            );
        }
        if (player && player.y < 3) {
          const dx = player.x - p.x,
            dz = player.z - p.z,
            ahead = dx * fx + dz * fz,
            side = Math.abs(dx * fz - dz * fx);
          if (ahead > 0 && ahead < 21 && side < 2.8)
            limit = Math.min(
              limit,
              a.baseSpeed * clamp((ahead - 5) / 15, 0, 1),
            );
        }
        const axis =
          Math.abs(fz) > 0.8 ? "ns" : Math.abs(fx) > 0.8 ? "ew" : null;
        if (axis && lights[axis] !== "green")
          for (const j of JUNCTIONS) {
            const ahead = (j.x - p.x) * fx + (j.z - p.z) * fz,
              side = Math.abs((j.x - p.x) * fz - (j.z - p.z) * fx);
            if (ahead > 7 && ahead < 24 && side < 7)
              limit = Math.min(
                limit,
                a.baseSpeed * clamp((ahead - 10) / 12, 0, 1),
              );
          }
        a.agent.maxSpeed = limit;
        a.stopped = limit < 0.25;
      }
      manager.update(dt);
      for (const a of actors) {
        if (!a.enabled) continue;
        const velocity = a.agent.velocity,
          speed = velocity.length();
        if (speed > 0.05) a.heading = Math.atan2(velocity.x, velocity.z);
        a.distance += speed * dt;
        const p = a.agent.position,
          c = a.collider;
        c.x = p.x;
        c.z = p.z;
        c.w =
          2.1 * Math.abs(Math.cos(a.heading)) +
          4.6 * Math.abs(Math.sin(a.heading));
        c.d =
          4.6 * Math.abs(Math.cos(a.heading)) +
          2.1 * Math.abs(Math.sin(a.heading));
      }
    },
  };
  simulation.setDensity("low");
  return simulation;
}
