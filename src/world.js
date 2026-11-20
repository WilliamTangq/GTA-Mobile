import * as T from "../vendor/three.module.js";
import { COAST, isLand } from "./physics.js";

export const DESTINATIONS = [
  {
    name: "海岸公路",
    en: "SUNDOWN COAST",
    x: 220,
    z: 240,
    type: "sport",
    hint: "海风、棕榈树和一条没有终点的路。",
  },
  {
    name: "城市中心",
    en: "PALM DISTRICT",
    x: 20,
    z: -145,
    type: "suv",
    hint: "在街区之间，找到自己的路线。",
  },
  {
    name: "海岛机场",
    en: "SKYLARK AIRFIELD",
    x: -335,
    z: 185,
    type: "plane",
    hint: "沿跑道加速，按住上升，去云层上面。",
  },
  {
    name: "日落码头",
    en: "DAYBREAK MARINA",
    x: 362,
    z: 215,
    type: "boat",
    hint: "离开陆地，向开阔的海面出发。",
  },
];
export function district(x, z) {
  if (!isLand(x, z)) return "开阔海域 / OPEN WATER";
  if (x < -240) return "海岛机场 / SKYLARK AIRFIELD";
  if (x > 190) return "海岸公路 / SUNDOWN COAST";
  if (Math.abs(x - 20) < 90 && Math.abs(z) < 70)
    return "棕榈公园 / PALM GARDENS";
  return "城市中心 / PALM DISTRICT";
}
export function createWorld(scene) {
  let seed = 188;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const colliders = [],
    batches = new Map();
  const geos = {
    box: new T.BoxGeometry(1, 1, 1),
    cyl: new T.CylinderGeometry(1, 1, 1, 7),
    cone: new T.ConeGeometry(1, 1, 6),
    sphere: new T.IcosahedronGeometry(1, 0),
  };
  function add(kind, color, x, y, z, w, h, d, ry = 0, rz = 0, rx = 0) {
    const key = `${kind}:${color}`;
    if (!batches.has(key)) batches.set(key, { kind, color, items: [] });
    batches.get(key).items.push({ x, y, z, w, h, d, ry, rz, rx });
  }
  const box = (color, x, y, z, w, h, d, ry = 0) =>
    add("box", color, x, y, z, w, h, d, ry);
  function flatPoly(points, color, y, scale = 1) {
    const shape = new T.Shape();
    points.forEach(([x, z], i) =>
      i
        ? shape.lineTo(x * scale, -z * scale)
        : shape.moveTo(x * scale, -z * scale),
    );
    shape.closePath();
    const mesh = new T.Mesh(
      new T.ShapeGeometry(shape),
      new T.MeshStandardMaterial({ color, roughness: 1 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  // Flat, readable terrain makes the low-poly city inexpensive on phones.
  const water = new T.Mesh(
    new T.PlaneGeometry(5500, 5500),
    new T.MeshStandardMaterial({
      color: 0x398f9b,
      roughness: 0.36,
      metalness: 0.15,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.18;
  scene.add(water);
  flatPoly(COAST, 0xdbcca2, -0.32, 1.045);
  flatPoly(COAST, 0x809c76, 0);
  // Shallow-water border follows the island rather than a rectangular tile.
  const shallows = flatPoly(COAST, 0x5baaa6, -1.14, 1.13);
  shallows.material.roughness = 0.85;
  const waveGeo = new T.PlaneGeometry(1, 1),
    waveMat = new T.MeshBasicMaterial({
      color: 0xd2f0df,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
  const waves = new T.InstancedMesh(waveGeo, waveMat, 400),
    dummy = new T.Object3D();
  for (let i = 0; i < 400; i++) {
    let x, z;
    do {
      x = (rand() - 0.5) * 2500;
      z = (rand() - 0.5) * 2500;
    } while (isLand(x, z));
    dummy.position.set(x, -1.1, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0.15);
    dummy.scale.set(4 + rand() * 12, 0.12 + rand() * 0.25, 1);
    dummy.updateMatrix();
    waves.setMatrixAt(i, dummy.matrix);
  }
  scene.add(waves);
  // Streets and sidewalks share a handful of instanced draw calls.
  const roadColor = 0x3d4b51,
    curbColor = 0xc6bfa9;
  const xs = [-180, -80, 20, 120, 220],
    zs = [-350, -250, -150, -50, 50, 150, 250, 350];
  for (const x of xs) {
    box(curbColor, x, 0.035, 0, 23, 0.09, 758);
    box(roadColor, x, 0.095, 0, 16, 0.035, 758);
    for (let z = -369; z < 375; z += 12)
      if (!zs.some((a) => Math.abs(z - a) < 13))
        box(0xe7c782, x, 0.12, z, 0.22, 0.015, 5);
  }
  for (const z of zs) {
    box(curbColor, 20, 0.045, z, 451, 0.09, 23);
    box(roadColor, 20, 0.102, z, 451, 0.035, 16);
    for (let x = -195; x < 240; x += 12)
      if (!xs.some((a) => Math.abs(x - a) < 13))
        box(0xe7c782, x, 0.13, z, 5, 0.015, 0.22);
  }
  for (const x of xs)
    for (const z of zs)
      for (let i = 0; i < 6; i++) {
        box(0xd6d5c2, x - 5 + i * 2, 0.135, z + 12, 1, 0.015, 3);
        box(0xd6d5c2, x + 12, 0.135, z - 5 + i * 2, 3, 0.015, 1);
      }
  // Connection to the airport, away from the runway threshold.
  box(curbColor, -250, 0.04, 310, 140, 0.08, 23);
  box(roadColor, -250, 0.1, 310, 140, 0.04, 16);
  function palm(x, z, size = 1) {
    if (!isLand(x, z)) return;
    const h = (7 + rand() * 3) * size;
    add("cyl", 0x84644b, x, h / 2, z, 0.28 * size, h, 0.28 * size, 0, 0.05);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + rand() * 0.2;
      add(
        "cone",
        i % 2 ? 0x3b765c : 0x497f5c,
        x + Math.sin(a) * 1.6 * size,
        h - 0.5 * size,
        z + Math.cos(a) * 1.6 * size,
        0.8 * size,
        4 * size,
        0.35 * size,
        a,
        0,
        1.2,
      );
    }
    add("sphere", 0x3e795d, x, h, z, 0.9 * size, 0.7 * size, 0.9 * size);
  }
  function tree(x, z) {
    add("cyl", 0x846b4d, x, 1.7, z, 0.3, 3.4, 0.3);
    add("sphere", 0x4f7e62, x, 4.4, z, 3, 3.1, 3);
  }
  const colors = [0xddd4bb, 0xc8c9bb, 0xc9947b, 0xa7bec0, 0xd2b799, 0xe4dbc7];
  const windowColors = [0x41616c, 0x587581, 0x8b9d9a];
  for (const x of [-130, -30, 70, 170])
    for (const z of [-300, -200, -100, 0, 100, 200, 300]) {
      if ((x === -30 || x === 70) && z === 0) continue;
      for (const dx of [-22, 22])
        for (const dz of [-22, 22]) {
          const bx = x + dx,
            bz = z + dz,
            w = 20 + rand() * 10,
            d = 20 + rand() * 10;
          const h =
            (x === 170 ? 9 + rand() * 14 : 14 + rand() * 52) *
            (z < 0 ? 1.15 : 0.8);
          const color = colors[Math.floor(rand() * colors.length)];
          box(color, bx, h / 2, bz, w, h, d);
          colliders.push({ x: bx, z: bz, w, d, h: h + 0.2 });
          box(0xe4ddc9, bx, h + 0.35, bz, w + 0.7, 0.6, d + 0.7);
          const wc = windowColors[Math.floor(rand() * windowColors.length)];
          for (let y = 3; y < h - 1; y += 3.5) {
            box(wc, bx, y, bz + d / 2 + 0.02, w * 0.78, 1.35, 0.06);
            box(wc, bx, y, bz - d / 2 - 0.02, w * 0.78, 1.35, 0.06);
            box(wc, bx + w / 2 + 0.02, y, bz, 0.06, 1.35, d * 0.78);
            box(wc, bx - w / 2 - 0.02, y, bz, 0.06, 1.35, d * 0.78);
            for (let k = -1; k <= 1; k++) {
              box(
                color,
                bx + (k * w) / 4,
                y,
                bz + d / 2 + 0.06,
                0.55,
                1.5,
                0.1,
              );
              box(
                color,
                bx + (k * w) / 4,
                y,
                bz - d / 2 - 0.06,
                0.55,
                1.5,
                0.1,
              );
            }
          }
          box(0x89979a, bx - 3, h + 1.4, bz, 4, 2, 4);
          if (rand() > 0.65) {
            add("cyl", 0x70818a, bx + 4, h + 3, bz - 4, 2.3, 5, 2.3);
            add("cone", 0x516975, bx + 4, h + 6, bz - 4, 2.7, 1.3, 2.7);
          }
        }
      for (const dz of [-37, 37]) palm(x, z + dz, 0.75);
    }
  // Park: a break in the grid, with a small fountain and shaded paths.
  box(0x759a6c, 20, 0.06, 0, 172, 0.12, 70);
  box(0xd5c6a2, 20, 0.14, 0, 6, 0.05, 70);
  box(0xd5c6a2, 20, 0.14, 0, 172, 0.05, 5);
  add("cyl", 0xd7d2bc, 20, 0.6, 0, 10, 1.2, 10);
  add("cyl", 0x64b4ba, 20, 1.22, 0, 8.7, 0.07, 8.7);
  add("cyl", 0xe5ddc8, 20, 2.0, 0, 1.3, 2, 1.3);
  colliders.push({ x: 20, z: 0, w: 20, d: 20, h: 2.8 });
  for (let i = 0; i < 24; i++)
    tree(-58 + rand() * 153, (i % 2 ? -1 : 1) * (13 + rand() * 16));
  // Airport: runway, centreline, hangars, apron and a clear helicopter pad.
  box(0xb7b69d, -335, 0.04, -70, 104, 0.08, 575);
  box(roadColor, -335, 0.11, -70, 46, 0.06, 530);
  for (const x of [-356, -314]) box(0xdedec9, x, 0.16, -70, 0.7, 0.02, 520);
  for (let z = -310; z < 180; z += 23)
    box(0xe9ead4, -335, 0.17, z, 0.8, 0.02, 12);
  for (const z of [-307, 168])
    for (let i = -3; i <= 3; i++)
      box(0xe5e4cd, -335 + i * 4, 0.18, z, 1.8, 0.02, 19);
  box(0x849399, -265, 0.1, 238, 56, 0.08, 68);
  const ring = new T.Mesh(
    new T.RingGeometry(14, 15, 32),
    new T.MeshBasicMaterial({ color: 0xf2ddb1, side: T.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-265, 0.18, 240);
  scene.add(ring);
  box(0xf2ddb1, -265, 0.18, 240, 15, 0.02, 2);
  for (const x of [-272, -258]) box(0xf2ddb1, x, 0.18, 240, 2, 0.02, 14);
  for (const z of [-200, -120, -40, 40]) {
    box(0xa7b4b2, -263, 7, z, 38, 14, 54);
    box(0x647a82, -263, 14.6, z, 41, 1.2, 58);
    box(0x344f59, -283, 5, z, 0.12, 10, 35);
    colliders.push({ x: -263, z, w: 38, d: 54, h: 15 });
  }
  box(0xd7cab2, -275, 12, -290, 17, 24, 17);
  box(0x355d6e, -275, 25, -290, 22, 5, 22);
  colliders.push({ x: -275, z: -290, w: 22, d: 22, h: 28 });
  // Marina boardwalk: only docks are solid, boats have open water immediately ahead.
  box(0xa57e59, 327, 0.1, 172, 115, 0.6, 7);
  box(0xa57e59, 380, 0.1, 170, 8, 0.6, 96);
  for (const z of [135, 175, 210]) box(0xcea170, 358, 0.1, z, 48, 0.6, 4);
  for (const x of [285, 315, 345, 375])
    for (const z of [169, 175])
      add("cyl", 0x5d6554, x, -0.6, z, 0.35, 2.8, 0.35);
  box(0xe4c8a4, 271, 2.6, 170, 14, 5, 15);
  box(0xdb7f61, 271, 5.5, 170, 18, 0.4, 19);
  colliders.push({ x: 271, z: 170, w: 14, d: 15, h: 6 });
  // The coastal avenue is lined with palms, warm lights and beach umbrellas.
  for (let z = -390; z <= 380; z += 24) {
    palm(239, z, 1.1);
    if (z % 48 === 0) palm(202, z, 0.9);
  }
  for (let z = 260; z < 400; z += 27) {
    add("cone", 0xe4a17f, 262, 3, z, 3.3, 1.2, 3.3);
    add("cyl", 0xb89870, 262, 1.4, z, 0.09, 2.8, 0.09);
    box(0xe9d0a2, 265, 0.3, z, 1.5, 0.4, 3.5);
  }
  for (const x of [-194, 6, 234])
    for (let z = -330; z < 350; z += 50) {
      box(0x53636b, x, 4, z, 0.15, 8, 0.15);
      box(0x53636b, x + 1, 8, z, 2.2, 0.15, 0.2);
      box(0xffe1a0, x + 1.7, 7.9, z, 1, 0.15, 0.6);
    }
  // Distant low-poly islets and hills frame the horizon.
  for (let i = 0; i < 14; i++) {
    const x = -900 + rand() * 1800,
      z = i % 2 ? -1050 : 1100;
    add(
      "cone",
      0x708f83,
      x,
      22,
      z,
      95 + rand() * 100,
      45 + rand() * 70,
      90 + rand() * 100,
    );
  }
  function sign(text, x, y, z, ry = 0, w = 19) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#244651";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#ede9cd";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64, 480);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(
      new T.PlaneGeometry(w, w / 4),
      new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
  }
  sign("SUNDOWN COAST", 235, 6, 208, Math.PI, 17);
  sign("SKYLARK AIRFIELD", -297, 5, 296, Math.PI, 23);
  sign("DAYBREAK MARINA", 285, 5.4, 169, Math.PI / 2, 15);
  // Submit static objects in batches; hundreds of buildings need few draw calls.
  for (const { kind, color, items } of batches.values()) {
    const mesh = new T.InstancedMesh(
      geos[kind],
      new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
      items.length,
    );
    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      dummy.position.set(v.x, v.y, v.z);
      dummy.rotation.set(v.rx, v.ry, v.rz);
      dummy.scale.set(v.w, v.h, v.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = kind !== "box" || items.some((v) => v.h > 2);
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  const clouds = new T.Group();
  const cm = new T.MeshBasicMaterial({
    color: 0xf9e6cd,
    transparent: true,
    opacity: 0.8,
  });
  for (let i = 0; i < 22; i++) {
    const g = new T.Mesh(new T.IcosahedronGeometry(1, 1), cm);
    g.position.set(
      (rand() - 0.5) * 2500,
      160 + rand() * 90,
      (rand() - 0.5) * 2500,
    );
    g.scale.set(60 + rand() * 70, 7 + rand() * 8, 22 + rand() * 25);
    clouds.add(g);
  }
  scene.add(clouds);
  return {
    colliders,
    update(t) {
      waves.position.x = Math.sin(t * 0.12) * 3;
      clouds.position.x = Math.sin(t * 0.005) * 50;
    },
  };
}

export function drawMap(canvas, states, active, { large = false } = {}) {
  const ctx = canvas.getContext("2d"),
    size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#204b59";
  ctx.fillRect(0, 0, size, size);
  const scale = size / 1350,
    cx = size / 2 + 35 * scale,
    cy = size / 2;
  const point = (x, z) => [cx + x * scale, cy + z * scale];
  ctx.fillStyle = "#9aab8a";
  ctx.beginPath();
  COAST.forEach(([x, z], i) => {
    const p = point(x, z);
    i ? ctx.lineTo(...p) : ctx.moveTo(...p);
  });
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d3c5a0";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "#4f5c5c";
  ctx.lineWidth = large ? 4 : 2;
  for (const x of [-180, -80, 20, 120, 220]) {
    ctx.beginPath();
    ctx.moveTo(...point(x, -379));
    ctx.lineTo(...point(x, 379));
    ctx.stroke();
  }
  for (const z of [-350, -250, -150, -50, 50, 150, 250, 350]) {
    ctx.beginPath();
    ctx.moveTo(...point(-205, z));
    ctx.lineTo(...point(245, z));
    ctx.stroke();
  }
  ctx.lineWidth = large ? 9 : 4;
  ctx.beginPath();
  ctx.moveTo(...point(-335, -335));
  ctx.lineTo(...point(-335, 195));
  ctx.stroke();
  ctx.strokeStyle = "#d4b58a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(...point(280, 172));
  ctx.lineTo(...point(380, 172));
  ctx.stroke();
  if (large) {
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1b4246";
    for (const d of DESTINATIONS) {
      const p = point(d.x, d.z);
      ctx.fillText(d.name, p[0], p[1] - 18);
    }
  }
  for (const s of Object.values(states)) {
    if (s === active) continue;
    const p = point(s.x, s.z);
    ctx.fillStyle = "#eadcba";
    ctx.beginPath();
    ctx.arc(...p, large ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = point(active.x, active.z);
  ctx.save();
  ctx.translate(...p);
  ctx.rotate(-active.heading);
  ctx.fillStyle = "#ff7959";
  ctx.strokeStyle = "#ffe9d2";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-5, -5);
  ctx.lineTo(0, -2);
  ctx.lineTo(5, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#dce2ce";
  ctx.font = `bold ${large ? 16 : 20}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("N", size - 22, 25);
}
