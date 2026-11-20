import test from "node:test";
import assert from "node:assert/strict";
import { composeControls, deadZone } from "../src/controls.js";
import {
  SPECS,
  createState,
  simulate,
  FOOT_GROUND,
  FOOT_SWIM,
  updateParkedCollider,
  blocked,
} from "../src/physics.js";
import {
  encodeSession,
  decodeSession,
  readSession,
  writeSession,
  createRecoveryTracker,
} from "../src/session.js";
import { createAdaptiveQuality } from "../src/performance.js";
const set = (...s) => new Set(s);
function advance(s, input, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) simulate(s, input, 1 / 60);
  return s;
}
const fleet = () =>
  Object.fromEntries(
    Object.keys(SPECS)
      .filter((t) => t !== "foot")
      .map((t) => [t, createState(t)]),
  );
test("diagonal steering cannot accidentally cancel the accelerator", () => {
  for (const y of [-1, -0.5, 0, 0.5, 1]) {
    const c = composeControls({ x: 0.6, y }, set(), set("gas"), "sport");
    assert.equal(c.throttle, 1);
    assert.equal(c.steer, 0.6);
  }
});
test("braking wins when both pedals are held", () => {
  assert.equal(
    composeControls({ x: 0, y: 0 }, set(), set("gas", "brake"), "sport")
      .throttle,
    -1,
  );
});
test("small joystick drift is ignored without losing full steering range", () => {
  assert.deepEqual(deadZone(0.03, 0.04), { x: 0, y: 0 });
  assert.deepEqual(deadZone(1, 0), { x: 1, y: 0 });
});
test("space means jump on foot and handbrake in a car", () => {
  const foot = composeControls({ x: 0, y: 0 }, set("Space"), set(), "foot"),
    car = composeControls({ x: 0, y: 0 }, set("Space"), set(), "sport");
  assert.equal(foot.jump, true);
  assert.equal(foot.brake, false);
  assert.equal(car.jump, false);
  assert.equal(car.brake, true);
});
test("walking right moves right relative to a north-facing camera", () => {
  const s = createState("foot");
  s.y = FOOT_GROUND;
  advance(s, { moveX: 1, moveZ: 0, cameraHeading: Math.PI }, 1);
  assert.ok(s.x > 219);
  assert.ok(Math.abs(s.z - 240) < 0.01);
});
test("diagonal walking has the same top speed as straight walking", () => {
  const a = createState("foot"),
    b = createState("foot");
  advance(a, { moveX: 0, moveZ: 1, cameraHeading: Math.PI }, 2);
  advance(b, { moveX: 1, moveZ: 1, cameraHeading: Math.PI }, 2);
  assert.ok(Math.abs(a.distance - b.distance) < 0.01);
});
test("holding jump does not automatically jump again after landing", () => {
  const s = createState("foot");
  let max = 0;
  for (let i = 0; i < 120; i++) {
    simulate(s, { jump: true }, 1 / 60);
    max = Math.max(max, s.y);
  }
  assert.ok(max > 1.2);
  assert.equal(s.y, FOOT_GROUND);
  simulate(s, { jump: false }, 1 / 60);
  simulate(s, { jump: true }, 1 / 60);
  assert.ok(s.y > FOOT_GROUND + 0.1);
});
test("a swimmer is submerged rather than standing above the water", () => {
  const s = createState("foot");
  s.x = 362;
  s.z = 215;
  advance(s, { jump: true }, 1);
  assert.equal(s.y, FOOT_SWIM);
  assert.ok(s.y + 0.1 < -1.18);
  assert.ok(s.y + 2.2 > -1.18);
});
test("walking cannot pass through a parked vehicle", () => {
  const car = createState("sport"),
    foot = createState("foot");
  foot.x = 216;
  foot.y = FOOT_GROUND;
  const env = { colliders: [updateParkedCollider(car)] };
  for (let i = 0; i < 120; i++)
    simulate(foot, { moveX: 1, moveZ: 0, cameraHeading: Math.PI }, 1 / 60, env);
  assert.ok(foot.x < 218.5);
  assert.equal(blocked(foot.x, foot.z, foot.y, 0.5, env.colliders), false);
});
test("an airborne parked aircraft does not create a wall underneath it", () => {
  const plane = createState("plane");
  plane.y = 100;
  const box = updateParkedCollider(plane);
  assert.equal(box.enabled, false);
  assert.equal(blocked(plane.x, plane.z, 0.7, 1, [box]), false);
  plane.y = 1.1;
  updateParkedCollider(plane, box);
  assert.equal(blocked(plane.x, plane.z, 0.7, 1, [box]), true);
});
test("saved pedestrians inside parked cars are restored to a safe fallback", () => {
  const states = fleet(),
    foot = createState("foot");
  foot.x = states.sport.x;
  foot.z = states.sport.z;
  foot.y = FOOT_GROUND;
  const data = decodeSession(encodeSession(states, foot, 0, {}, {}));
  assert.equal(
    blocked(data.active.x, data.active.z, data.active.y, 0.5, [
      updateParkedCollider(data.states.sport),
    ]),
    false,
  );
});
test("a saved session restores vehicle position, trip, camera and lighting", () => {
  const states = fleet();
  states.sport.z = 100;
  const text = encodeSession(
      states,
      states.sport,
      1234,
      { mode: 2, zoom: 1.4, footYaw: Math.PI, elevation: 0.2 },
      { daytime: "night" },
    ),
    restored = decodeSession(text);
  assert.equal(restored.active.type, "sport");
  assert.equal(restored.active.z, 100);
  assert.equal(restored.trip, 1234);
  assert.equal(restored.camera.zoom, 1.4);
  assert.equal(restored.settings.daytime, "night");
});
test("road vehicles resume stationary instead of driving before the player is ready", () => {
  const states = fleet();
  states.sport.speed = 45;
  const data = decodeSession(encodeSession(states, states.sport, 0, {}, {}));
  assert.equal(data.active.speed, 0);
});
test("resuming an airborne plane retains the airspeed needed to stay airborne", () => {
  const states = fleet();
  Object.assign(states.plane, { y: 100, speed: 60 });
  const data = decodeSession(encodeSession(states, states.plane, 0, {}, {}));
  advance(data.active, {}, 0.2);
  assert.ok(data.active.y > 99);
  assert.ok(data.active.speed > 55);
});
test("corrupted or unknown saves fail safely and invalid positions reset", () => {
  assert.equal(decodeSession("bad JSON"), null);
  assert.equal(
    decodeSession('{"version":1,"vehicles":{},"active":{"type":"__proto__"}}'),
    null,
  );
  const states = fleet();
  states.sport.x = NaN;
  const data = decodeSession(encodeSession(states, states.sport, 0, {}, {}));
  assert.equal(data.active.x, SPECS.sport.spawn[0]);
});
test("blocked browser storage never prevents gameplay", () => {
  const storage = {
    getItem() {
      throw Error("disabled");
    },
    setItem() {
      throw Error("quota");
    },
  };
  assert.equal(readSession(storage), null);
  assert.equal(writeSession(storage, "{}"), false);
});
test("recovery returns to a recent safe road rather than the original spawn", () => {
  const tracker = createRecoveryTracker(),
    s = createState("sport");
  tracker.seed(s);
  for (const z of [180, 170, 160, 150]) {
    s.z = z;
    tracker.record(s, 1);
  }
  s.x = 350;
  s.distance = 400;
  s.waterTime = 2;
  const back = tracker.recover(s);
  assert.equal(back.x, 220);
  assert.ok(back.z < 200);
  assert.notEqual(back.z, SPECS.sport.spawn[2]);
  assert.equal(back.speed, 0);
  assert.equal(back.distance, 400);
});
test("automatic quality reduces load, recovers slowly and ignores hidden-tab stalls", () => {
  const q = createAdaptiveQuality();
  for (let i = 0; i < 500; i++) q.sample(50);
  const low = q.scale;
  assert.ok(low < 1);
  assert.ok(low >= 0.65);
  for (let i = 0; i < 20; i++) q.sample(5000);
  assert.equal(q.scale, low);
  for (let i = 0; i < 1500; i++) q.sample(16.7);
  assert.ok(q.scale > low);
  assert.ok(q.scale <= 1.1);
});
