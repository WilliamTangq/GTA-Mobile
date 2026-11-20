import * as T from "../vendor/three.module.js";
import {
  createTrafficSimulation,
  JUNCTIONS,
  signalState,
} from "./traffic-ai.js";
import { makeVehicle, makePerson } from "./vehicles.js";
import { upgradeVehicle } from "./asset-vehicles.js";
export function createTraffic(scene) {
  const simulation = createTrafficSimulation(),
    visuals = [];
  for (const actor of simulation.actors) {
    const model = actor.kind === "car" ? makeVehicle(actor.type) : makePerson(actor.index+1);
    scene.add(model);
    visuals.push({ actor, model });
  }
  const dummy = new T.Object3D(),
    bulbs = [];
  const poles = new T.InstancedMesh(
    new T.BoxGeometry(0.18, 5, 0.18),
    new T.MeshStandardMaterial({ color: 0x33464c }),
    JUNCTIONS.length * 2,
  );
  const housings = new T.InstancedMesh(
    new T.BoxGeometry(0.7, 1.7, 0.5),
    new T.MeshStandardMaterial({ color: 0x24363c }),
    JUNCTIONS.length * 2,
  );
  const lights = new T.InstancedMesh(
    new T.SphereGeometry(0.21, 6, 4),
    new T.MeshBasicMaterial(),
    JUNCTIONS.length * 6,
  );
  const color = new T.Color();
  let pi = 0,
    li = 0;
  for (const j of JUNCTIONS)
    for (const [axis, dx, dz, ry] of [
      ["ns", 10, 10, 0],
      ["ew", -10, -10, Math.PI / 2],
    ]) {
      dummy.position.set(j.x + dx, 2.5, j.z + dz);
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(pi, dummy.matrix);
      dummy.position.y = 4.2;
      dummy.updateMatrix();
      housings.setMatrixAt(pi++, dummy.matrix);
      for (const [i, state] of ["red", "amber", "green"].entries()) {
        dummy.position.y = 4.75 - i * 0.55;
        dummy.position.x = j.x + dx + (axis === "ew" ? 0.3 : 0);
        dummy.position.z = j.z + dz + (axis === "ns" ? 0.3 : 0);
        dummy.updateMatrix();
        lights.setMatrixAt(li, dummy.matrix);
        bulbs.push({ index: li++, axis, state });
      }
    }
  lights.userData.dynamic = true;
  scene.add(poles, housings, lights);
  let tick = -1;
  return {
    simulation,
    colliders: simulation.actors
      .filter((a) => a.kind === "car")
      .map((a) => a.collider),
    upgrade() {
      for (const { actor, model } of visuals)
        if (actor.kind === "car") upgradeVehicle(model, actor.type);
    },
    setDensity(v) {
      simulation.setDensity(v);
    },
    update(player, software = false) {
      for (const { actor: a, model: m } of visuals) {
        const p = a.agent.position;
        m.visible =
          a.enabled &&
          (!player ||
            Math.hypot(p.x - player.x, p.z - player.z) <
              (software ? 125 : 420));
        if (!m.visible) continue;
        m.position.set(p.x, p.y, p.z);
        m.rotation.y = a.heading;
        for (const w of m.userData.wheels || []) w.rotation.x = a.distance * 2;
        for (const [i, l] of (m.userData.limbs || []).entries())
          l.rotation.x = Math.sin(a.distance * (a.fleeing ? 3 : 1.3)) * (i % 2 ? -1 : 1) * 0.45;
        if (m.userData.tailMat)
          m.userData.tailMat.color.set(a.stopped ? 0xff3f2c : 0x963d36);
      }
      const next = Math.floor(simulation.time * 2);
      if (tick !== next) {
        tick = next;
        const phase = signalState(simulation.time);
        for (const b of bulbs) {
          color.set(
            phase[b.axis] === b.state
              ? { red: 0xff5845, amber: 0xffce66, green: 0x88d6a7 }[b.state]
              : 0x25383c,
          );
          lights.setColorAt(b.index, color);
        }
        lights.instanceColor.needsUpdate = true;
      }
    },
  };
}
