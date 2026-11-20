import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createTrafficSimulation, signalState } from "../src/traffic-ai.js";
import {
  createState,
  simulate,
  isLand,
  isRoad,
  blocked,
} from "../src/physics.js";
function run(s, input, seconds) {
  for (let i = 0; i < seconds * 60; i++) simulate(s, input, 1 / 60);
}
test("handbrake produces lateral slip and grip recovers after release", () => {
  const s = createState("sport");
  run(s, { throttle: 1 }, 2);
  run(s, { throttle: 1, steer: 1, brake: true }, 0.8);
  assert.ok(s.drift > 0.2);
  run(s, { throttle: 1 }, 1);
  assert.ok(s.drift < 0.08);
  assert.ok(Number.isFinite(s.x + s.z));
});
test("pavement driving, open grass and closed shoreline are distinguished", () => {
  assert.ok(isRoad(220, 200));
  assert.ok(isLand(270, 300));
  assert.equal(isRoad(270, 300), false);
  assert.equal(isLand(800, 0), false);
});
test("disabled traffic colliders do not block the player", () => {
  const c = { x: 0, z: 0, w: 4, d: 5, h: 3, enabled: false };
  assert.equal(blocked(0, 0, 0.7, 1, [c]), false);
  c.enabled = true;
  assert.equal(blocked(0, 0, 0.7, 1, [c]), true);
});
test("junctions never show conflicting green lights", () => {
  for (let t = 0; t < 96; t += 0.25) {
    const s = signalState(t);
    assert.notEqual(s.ns === "green" && s.ew === "green", true);
  }
  assert.equal(signalState(0).ns, "green");
  assert.equal(signalState(20).ew, "green");
});
test("YUKA traffic follows roads and stays on the island for two minutes", () => {
  const sim = createTrafficSimulation();
  sim.setDensity("high");
  for (let i = 0; i < 7200; i++) {
    sim.step(1 / 60, null);
    if (i % 60 === 0)
      for (const a of sim.actors) {
        const p = a.agent.position;
        assert.ok(Number.isFinite(p.x + p.z));
        assert.ok(isLand(p.x, p.z));
        if (a.kind === "car")
          assert.ok(isRoad(p.x, p.z), `left road: ${a.index}, ${p.x}, ${p.z}`);
      }
  }
  assert.ok(
    sim.actors.filter((a) => a.kind === "car" && !a.parked).every((a) => a.distance > 100),
  );
});
test("traffic slows for an obstacle ahead and resumes after it leaves", () => {
  const sim = createTrafficSimulation();
  const a = sim.actors[1],
    p = a.agent.position;
  const obstacle = {
    x: p.x + Math.sin(a.heading) * 7,
    z: p.z + Math.cos(a.heading) * 7,
    y: 0.7,
  };
  sim.step(1 / 60, obstacle);
  assert.ok(a.agent.maxSpeed < a.baseSpeed * 0.3);
  for (let i = 0; i < 60; i++) sim.step(1 / 60, null);
  assert.ok(a.agent.maxSpeed > a.baseSpeed * 0.5);
});
test("density off freezes all NPCs and disables their collision boxes", () => {
  const sim = createTrafficSimulation();
  sim.setDensity("off");
  const before = sim.actors.map((a) => [
    a.agent.position.x,
    a.agent.position.z,
  ]);
  for (let i = 0; i < 60; i++) sim.step(1 / 60, null);
  assert.deepEqual(
    sim.actors.map((a) => [a.agent.position.x, a.agent.position.z]),
    before,
  );
  assert.ok(sim.actors.every((a) => !a.collider.enabled));
});
test("converted Kenney meshes have valid indices, wheel pivots and traceable hashes", () => {
  const provenance = JSON.parse(
    readFileSync("public/assets/kenney/PROVENANCE.json"),
  );
  assert.equal(provenance.models.length, 5);
  for (const m of provenance.models) {
    const bytes = readFileSync(`public/assets/kenney/${m.file}`);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      m.converted_sha256,
    );
    const data = JSON.parse(bytes);
    assert.equal(data.license, "CC0-1.0");
    assert.equal(data.parts.filter((p) => p.name.includes("wheel")).length, 4);
    for (const p of data.parts) {
      assert.equal(p.positions.length, p.colors.length);
      assert.equal(p.positions.length, p.normals.length);
      assert.equal(p.indices.length % 3, 0);
      assert.ok(p.indices.every((i) => i >= 0 && i < p.positions.length / 3));
      assert.ok(p.positions.every(Number.isFinite));
    }
  }
});
