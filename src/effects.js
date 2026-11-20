import * as T from "../vendor/three.module.js";
import { isRoad } from "./physics.js";
export function createEffects(scene) {
  const dummy = new T.Object3D(),
    color = new T.Color(),
    roadColor = new T.Color(0x3d4b51);
  const tracks = new T.InstancedMesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
    100,
  );
  const foam = new T.InstancedMesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      color: 0xd5eee3,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
    64,
  );
  const smoke = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshBasicMaterial({
      color: 0xe7e5d7,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
    24,
  );
  const buffers = [
    { mesh: tracks, items: Array(100).fill(null), cursor: 0, live: 0 },
    { mesh: foam, items: Array(64).fill(null), cursor: 0, live: 0 },
    { mesh: smoke, items: Array(24).fill(null), cursor: 0, live: 0 },
  ];
  for (const b of buffers) {
    b.mesh.userData.dynamic = true;
    b.mesh.frustumCulled = false;
    b.mesh.visible = false;
    scene.add(b.mesh);
  }
  let timer = 0;
  function put(buffer, item) {
    if (!buffer.items[buffer.cursor] || buffer.items[buffer.cursor].life <= 0)
      buffer.live++;
    buffer.items[buffer.cursor] = item;
    buffer.mesh.visible = true;
    buffer.cursor = (buffer.cursor + 1) % buffer.items.length;
  }
  return {
    update(dt, s, control = {}, running = true) {
      timer += dt;
      if (running && timer > 0.085) {
        timer = 0;
        const wheeled = [
            "sport",
            "suv",
            "bike",
            "police",
            "taxi",
            "truck",
          ].includes(s.type),
          speed = Math.abs(s.speed),
          sn = Math.sin(s.heading),
          cs = Math.cos(s.heading);
        if (
          wheeled &&
          isRoad(s.x, s.z) &&
          speed > 7 &&
          (s.drift > 0.15 || control.brake)
        )
          for (const side of [-0.8, 0.8]) {
            const x = s.x - sn * 1.3 + cs * side,
              z = s.z - cs * 1.3 - sn * side;
            put(buffers[0], {
              x,
              z,
              y: 0.16,
              heading: s.heading,
              life: 7,
              max: 7,
              length: Math.min(3, speed * 0.12),
            });
            put(buffers[2], {
              x,
              z,
              y: 0.5,
              heading: s.heading,
              life: 1.1,
              max: 1.1,
            });
          }
        if (s.type === "boat" && speed > 2)
          for (const side of [-1.1, 1.1])
            put(buffers[1], {
              x: s.x - sn * 3 + cs * side,
              z: s.z - cs * 3 - sn * side,
              y: -1.07,
              heading: s.heading,
              life: 3,
              max: 3,
              length: Math.min(4, speed * 0.18),
            });
      }
      for (const [bi, b] of buffers.entries()) {
        if (b.live === 0) {
          b.mesh.visible = false;
          continue;
        }
        for (let i = 0; i < b.items.length; i++) {
          const p = b.items[i];
          if (p && p.life > 0 && running) {
            p.life = Math.max(0, p.life - dt);
            if (p.life === 0) b.live--;
          }
          if (!p || p.life <= 0) {
            dummy.position.set(0, -100, 0);
            dummy.scale.setScalar(0);
          } else {
            const age = 1 - p.life / p.max;
            dummy.position.set(p.x, p.y + (bi === 2 ? age * 1.8 : 0), p.z);
            dummy.rotation.set(-Math.PI / 2, p.heading, 0, "YXZ");
            if (bi === 0) {
              dummy.scale.set(0.21, p.length, 1);
              color.set(0x1a3039).lerp(roadColor, age);
              tracks.setColorAt(i, color);
            } else if (bi === 1)
              dummy.scale.set(0.4 + age * 1.8, p.length * (1 - age * 0.7), 1);
            else {
              dummy.rotation.set(0, 0, 0);
              dummy.scale.setScalar(0.2 + age * 0.7);
            }
          }
          dummy.updateMatrix();
          b.mesh.setMatrixAt(i, dummy.matrix);
        }
        b.mesh.visible = b.live > 0;
        b.mesh.instanceMatrix.needsUpdate = true;
      }
      if (tracks.instanceColor) tracks.instanceColor.needsUpdate = true;
    },
  };
}
