import * as T from "../vendor/three.module.js";
import { SPECS } from "./physics.js";
const types = ["sport", "suv", "taxi", "police", "truck"],
  cache = new Map();
const material = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.72,
  metalness: 0.05,
});
function prepare(data, type) {
  const all = data.parts.flatMap((p) => p.positions),
    xs = [],
    ys = [],
    zs = [];
  for (let i = 0; i < all.length; i += 3) {
    xs.push(all[i]);
    ys.push(all[i + 1]);
    zs.push(all[i + 2]);
  }
  const minX = Math.min(...xs) / 1000,
    maxX = Math.max(...xs) / 1000,
    minY = Math.min(...ys) / 1000,
    minZ = Math.min(...zs) / 1000,
    maxZ = Math.max(...zs) / 1000;
  const scale =
      (type === "truck" ? 5.8 : type === "suv" ? 4.8 : 4.5) / (maxZ - minZ),
    cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2;
  const parts = data.parts.map((p) => {
    const positions = new Float32Array(p.positions.length),
      normals = new Float32Array(p.normals.length),
      colors = new Float32Array(p.colors.length),
      color = new T.Color();
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (p.positions[i] / 1000 - cx) * scale;
      positions[i + 1] =
        (p.positions[i + 1] / 1000 - minY) * scale +
        0.12 -
        SPECS[type].spawn[1];
      positions[i + 2] = (p.positions[i + 2] / 1000 - cz) * scale;
      color.setRGB(
        p.colors[i] / 255,
        p.colors[i + 1] / 255,
        p.colors[i + 2] / 255,
        T.SRGBColorSpace,
      );
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
      normals[i] = p.normals[i] / 1000;
      normals[i + 1] = p.normals[i + 1] / 1000;
      normals[i + 2] = p.normals[i + 2] / 1000;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new T.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    geometry.setIndex(p.indices);
    geometry.computeBoundingBox();
    const center = new T.Vector3();
    if (p.name.includes("wheel")) {
      geometry.boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
    }
    geometry.computeBoundingSphere();
    return { geometry, name: p.name, center };
  });
  cache.set(type, parts);
}
export async function loadVehicleAssets() {
  const results = await Promise.allSettled(
    types.map(async (type) => {
      const response = await fetch(
        new URL(`../assets/kenney/${type}.json`, import.meta.url),
      );
      if (!response.ok) throw new Error(`Model unavailable: ${type}`);
      prepare(await response.json(), type);
    }),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}
export function upgradeVehicle(root, type) {
  const parts = cache.get(type);
  if (!parts) return false;
  // Only replace this model's nodes. Geometry/material caches are shared by traffic.
  root.clear();
  const body = new T.Group();
  root.add(body);
  const wheels = [],
    steering = [];
  for (const p of parts) {
    const mesh = new T.Mesh(p.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (p.name.includes("wheel")) {
      const pivot = new T.Group();
      pivot.position.copy(p.center);
      pivot.add(mesh);
      body.add(pivot);
      wheels.push(mesh);
      if (p.name.includes("front")) steering.push(pivot);
    } else body.add(mesh);
  }
  const tailMat = new T.MeshBasicMaterial({ color: 0xff4e36 });
  const brakeLights = [];
  for (const x of [-0.66, 0.66]) {
    const light = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.05), tailMat);
    light.position.set(
      x,
      0.17,
      -(type === "truck" ? 2.92 : type === "suv" ? 2.42 : 2.27),
    );
    body.add(light);
    brakeLights.push(light);
  }
  const siren = type === "police" ? new T.Group() : null;
  if (siren) {
    for (const [x, c] of [
      [-0.3, 0x36a7ff],
      [0.3, 0xff4c4c],
    ]) {
      const m = new T.Mesh(
        new T.BoxGeometry(0.45, 0.12, 0.28),
        new T.MeshBasicMaterial({ color: c }),
      );
      m.position.x = x;
      siren.add(m);
    }
    siren.position.y = 1.25;
    body.add(siren);
  }
  root.userData = {
    type,
    body,
    wheels,
    steering,
    rotors: [],
    brakeLights,
    tailMat,
    siren,
    kenney: true,
  };
  return true;
}
