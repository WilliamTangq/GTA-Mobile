import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  simulate,
  isLand,
  blocked,
  SPECS,
} from "../src/physics.js";
function run(s, input, seconds, env = {}) {
  let out;
  for (let i = 0; i < Math.round(seconds * 60); i++)
    out = simulate(s, input, 1 / 60, env);
  return out;
}
test("all land vehicles start on land; boat starts in water", () => {
  for (const type of Object.keys(SPECS)) {
    const s = createState(type);
    assert.equal(isLand(s.x, s.z), type !== "boat", type);
  }
});
test("car accelerates forward and steering turns right from the follow camera", () => {
  const s = createState("sport");
  run(s, { throttle: 1 }, 2);
  assert.ok(s.speed > 30);
  assert.ok(s.z < 210);
  const heading = s.heading;
  run(s, { throttle: 1, steer: 1 }, 0.5);
  assert.ok(s.heading < heading);
  assert.ok(s.x > 220);
});
test("brake first slows a moving car, then allows reverse", () => {
  const s = createState("sport");
  s.speed = 20;
  run(s, { throttle: -1 }, 0.4);
  assert.ok(s.speed > 0 && s.speed < 10);
  run(s, { throttle: -1 }, 2);
  assert.ok(s.speed < 0);
});
test("solid obstacles prevent driving through buildings", () => {
  const s = createState("sport");
  s.x = 0;
  s.z = 0;
  s.heading = 0;
  const env = { colliders: [{ x: 0, z: 15, w: 20, d: 10, h: 25 }] };
  run(s, { throttle: 1 }, 2, env);
  assert.ok(s.z < 10);
  assert.equal(
    blocked(s.x, s.z, s.y, SPECS.sport.radius, env.colliders),
    false,
  );
});
test("plane needs airspeed to climb and can descend after takeoff", () => {
  const s = createState("plane");
  run(s, { climb: 1 }, 3);
  assert.equal(s.y, 1.1);
  run(s, { throttle: 1, climb: 1 }, 5);
  assert.ok(s.y > 10);
  const h = s.y;
  run(s, { throttle: 1, climb: -1 }, 3);
  assert.ok(s.y < h);
});
test("helicopter climbs vertically, hovers and lands without negative altitude", () => {
  const s = createState("heli");
  run(s, { climb: 1 }, 3);
  assert.ok(s.y > 28);
  assert.equal(s.z, 240);
  run(s, {}, 3);
  assert.ok(Math.abs(s.vertical) < 0.01);
  run(s, { climb: -1 }, 10);
  assert.equal(s.y, 1.35);
});
test("boat sails but cannot cross the shoreline", () => {
  const s = createState("boat");
  run(s, { throttle: 1 }, 2);
  assert.ok(s.z > 225);
  s.x = 350;
  s.z = 0;
  s.heading = -Math.PI / 2;
  run(s, { throttle: 1 }, 8);
  assert.equal(isLand(s.x, s.z), false);
  assert.ok(s.x > 290);
});
test("driving into the sea triggers recovery instead of getting permanently stuck", () => {
  const s = createState("sport");
  s.x = 340;
  s.z = 240;
  s.heading = 0;
  const result = run(s, { throttle: 1 }, 2);
  assert.equal(result.recover, true);
});
test("pause-sized time deltas are capped for stable collision detection", () => {
  const s = createState("sport");
  simulate(s, { throttle: 1 }, 20);
  assert.ok(s.speed < 1);
});
