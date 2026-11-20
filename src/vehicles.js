import * as T from "../vendor/three.module.js";
import { SPECS } from "./physics.js";
const mats = new Map();
function mat(color, metal = 0) {
  const key = `${color}/${metal}`;
  if (!mats.has(key))
    mats.set(
      key,
      new T.MeshStandardMaterial({
        color,
        roughness: metal ? 0.35 : 0.7,
        metalness: metal,
        flatShading: true,
      }),
    );
  return mats.get(key);
}
const boxGeo = new T.BoxGeometry(1, 1, 1);
function box(g, w, h, d, x, y, z, color) {
  const m = new T.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function cyl(g, r1, r2, h, x, y, z, color, axis = "y", sides = 12) {
  const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, sides), mat(color));
  m.position.set(x, y, z);
  if (axis === "x") m.rotation.z = Math.PI / 2;
  if (axis === "z") m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  g.add(m);
  return m;
}
function wheel(g, x, y, z, r = 0.48) {
  const tire = cyl(g, r, r, 0.28, x, y, z, 0x17232c, "x");
  cyl(g, r * 0.52, r * 0.52, 0.3, x, y, z, 0x9aabb4, "x");
  return tire;
}
function shadow(g, w, d) {
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, d),
    new T.MeshBasicMaterial({
      color: 0x10252d,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.58;
  g.add(mesh);
}
export function makeVehicle(type) {
  const root = new T.Group(),
    g = new T.Group();
  root.add(g);
  const c = SPECS[type].color;
  const moving = { wheels: [], rotors: [], steering: [], body: g };
  if (["sport", "suv", "taxi", "police", "truck"].includes(type)) {
    const suv = type === "suv" || type === "truck",
      w = suv ? 2.4 : 2.2,
      d = suv ? 4.7 : 4.5;
    box(g, w, 0.55, d, 0, 0.05, 0, c);
    box(g, w * 0.94, 0.27, d * 0.97, 0, 0.4, 0, c);
    const cabin = box(
      g,
      w * 0.8,
      suv ? 0.95 : 0.65,
      2.25,
      0,
      suv ? 0.95 : 0.81,
      -0.25,
      0x173e4b,
    );
    cabin.rotation.x = 0.03;
    box(g, w * 0.84, 0.13, 1.8, 0, suv ? 1.48 : 1.17, -0.4, c);
    box(
      g,
      0.11,
      suv ? 0.94 : 0.65,
      2.25,
      -w * 0.42,
      suv ? 0.95 : 0.81,
      -0.25,
      c,
    );
    box(
      g,
      0.11,
      suv ? 0.94 : 0.65,
      2.25,
      w * 0.42,
      suv ? 0.95 : 0.81,
      -0.25,
      c,
    );
    for (const x of [-w / 2, w / 2])
      for (const z of [-1.4, 1.38])
        moving.wheels.push(wheel(g, x, -0.25, z, suv ? 0.56 : 0.44));
    box(g, w * 0.9, 0.18, 0.12, 0, -0.05, d / 2 + 0.02, 0x18232b);
    box(g, w * 0.9, 0.18, 0.12, 0, -0.05, -d / 2 - 0.02, 0x18232b);
    for (const x of [-w * 0.35, w * 0.35]) {
      box(g, 0.48, 0.16, 0.08, x, 0.3, d / 2 + 0.03, 0xffedb0);
      box(g, 0.5, 0.13, 0.08, x, 0.3, -d / 2 - 0.03, 0xff343d);
      box(g, 0.24, 0.17, 0.4, x * 1.45, 0.7, 0.35, c);
    }
    if (!suv) {
      box(g, 2.1, 0.1, 0.46, 0, 0.95, -1.99, 0x152b37);
      for (const x of [-0.7, 0.7])
        box(g, 0.1, 0.35, 0.12, x, 0.7, -1.99, 0x17252a);
      box(g, 0.14, 0.015, 1.3, -0.15, 0.545, 1.45, 0xf7dbb7);
      box(g, 0.14, 0.015, 1.3, 0.15, 0.545, 1.45, 0xf7dbb7);
    } else {
      box(g, 1.95, 0.12, 2.1, 0, 1.6, -0.4, 0x182d37);
      wheel(g, 0, 0.5, -2.4, 0.57).rotation.z = 0;
    }
    shadow(g, 3, 5.4);
  } else if (type === "bike") {
    box(g, 0.5, 0.4, 1.4, 0, 0.05, 0, 0x19252d);
    box(g, 0.62, 0.48, 0.9, 0, 0.4, 0.25, c);
    box(g, 0.55, 0.15, 0.85, 0, 0.5, -0.5, 0x222a31);
    for (const z of [-1.0, 1.0]) moving.wheels.push(wheel(g, 0, -0.1, z, 0.5));
    for (const x of [-0.2, 0.2]) {
      const fork = box(g, 0.09, 0.9, 0.1, x, 0.3, 0.9, 0xb7c7ca);
      fork.rotation.x = 0.24;
    }
    box(g, 1.05, 0.08, 0.12, 0, 0.9, 0.67, 0x24323b);
    box(g, 0.35, 0.23, 0.12, 0, 0.72, 1.05, 0xffedab);
    // A rider keeps the motorcycle recognisable from a follow camera.
    box(g, 0.58, 0.75, 0.4, 0, 1.05, -0.35, 0xede8d8);
    cyl(g, 0.29, 0.29, 0.4, 0, 1.64, -0.2, 0x263b47);
    for (const x of [-0.38, 0.38]) {
      box(g, 0.17, 0.48, 0.22, x, 0.32, -0.42, 0x263745);
      const arm = box(g, 0.16, 0.6, 0.18, x, 1.05, 0.1, 0xd9b08c);
      arm.rotation.x = -0.65;
    }
    shadow(g, 1.5, 3);
  } else if (type === "plane") {
    const body = cyl(g, 0.7, 0.38, 7.2, 0, 0.25, 0, c, "z");
    body.rotation.x = -Math.PI / 2;
    box(g, 2.1, 0.32, 2.8, 0, 0.4, 0.5, c);
    box(g, 1.3, 0.7, 1.8, 0, 0.85, 0.8, 0x1c5363);
    box(g, 11.5, 0.17, 1.7, 0, 0.35, 0.45, c);
    for (const x of [-5, 5]) box(g, 1.25, 0.19, 1.7, x, 0.35, 0.45, 0xff744d);
    box(g, 4.8, 0.14, 1.05, 0, 0.48, -2.7, c);
    const tail = box(g, 0.15, 1.8, 1.4, 0, 1.1, -2.6, 0xff744d);
    tail.rotation.x = -0.22;
    cyl(g, 0.65, 0.36, 0.9, 0, 0.3, 3.4, 0x253641, "z");
    const rotor = new T.Group();
    rotor.position.set(0, 0.3, 3.95);
    box(rotor, 0.14, 3.7, 0.07, 0, 0, 0, 0x182a34);
    box(rotor, 0.24, 0.24, 0.12, 0, 0, 0, 0xff744d);
    g.add(rotor);
    moving.rotors.push({ mesh: rotor, axis: "z" });
    for (const x of [-1.1, 1.1]) {
      box(g, 0.12, 0.7, 0.12, x, -0.25, 0.7, 0x53636c);
      moving.wheels.push(wheel(g, x, -0.65, 0.7, 0.31));
    }
    wheel(g, 0, -0.58, -2.4, 0.23);
  } else if (type === "heli") {
    const body = new T.Mesh(new T.SphereGeometry(1, 12, 8), mat(c));
    body.scale.set(1.25, 1.1, 2.0);
    body.position.y = 0.45;
    g.add(body);
    const glass = new T.Mesh(new T.SphereGeometry(1, 12, 8), mat(0x163d50));
    glass.scale.set(1.15, 0.85, 1.25);
    glass.position.set(0, 0.65, 1.05);
    g.add(glass);
    const tail = box(g, 0.35, 0.45, 4.2, 0, 0.55, -3.0, c);
    tail.rotation.x = 0.12;
    box(g, 0.13, 1.5, 1, 0, 1.3, -4.9, c);
    box(g, 2.2, 0.12, 0.7, 0, 0.5, -4.5, 0xf2ddac);
    cyl(g, 0.11, 0.11, 0.65, 0, 1.75, 0, 0x243441);
    const rotor = new T.Group();
    rotor.position.set(0, 2.1, 0);
    box(rotor, 11, 0.07, 0.25, 0, 0, 0, 0x1c3440);
    box(rotor, 0.25, 0.07, 11, 0, 0, 0, 0x1c3440);
    g.add(rotor);
    moving.rotors.push({ mesh: rotor, axis: "y" });
    const small = new T.Group();
    small.position.set(0.23, 1, -4.9);
    box(small, 0.08, 1.9, 0.1, 0, 0, 0, 0xf1dba4);
    box(small, 0.08, 0.1, 1.9, 0, 0, 0, 0xf1dba4);
    g.add(small);
    moving.rotors.push({ mesh: small, axis: "x" });
    for (const x of [-1.3, 1.3]) {
      box(g, 0.15, 0.15, 4, x, -0.95, 0, 0x243440);
      for (const z of [-0.8, 0.8])
        box(g, 0.1, 0.65, 0.1, x, -0.65, z, 0x344650);
    }
  } else if (type === "boat") {
    const shape = new T.Shape();
    shape.moveTo(-1.6, -3);
    shape.lineTo(1.6, -3);
    shape.lineTo(1.65, 1.5);
    shape.lineTo(0, 4);
    shape.lineTo(-1.65, 1.5);
    shape.closePath();
    const hull = new T.Mesh(
      new T.ExtrudeGeometry(shape, {
        depth: 0.7,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.25,
        bevelThickness: 0.2,
      }),
      mat(c),
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.4;
    g.add(hull);
    box(g, 2.8, 0.2, 3.3, 0, 0.6, -0.7, 0xc98652);
    box(g, 2.3, 0.5, 1.0, 0, 0.98, -1.3, 0xfff4df);
    box(g, 2.3, 0.5, 0.7, 0, 0.98, 0, 0xfff4df);
    const windshield = box(g, 2.65, 0.65, 0.12, 0, 1.15, 0.8, 0x295c6c);
    windshield.rotation.x = -0.25;
    for (const x of [-1, 1]) box(g, 0.55, 0.9, 0.65, x, 0.2, -3.1, 0x283a46);
  }
  root.userData = { type, ...moving };
  return root;
}
// Shared low-resolution anatomy replaces the block figure without skeletal assets.
const headGeometry=new T.SphereGeometry(1,10,8),
  torsoGeometry=new T.CylinderGeometry(.3,.24,.64,10),
  limbGeometry=new T.CapsuleGeometry(.105,.42,3,8);
export function makePerson(variant=0) {
  const g=new T.Group(),limbs=[];
  const skin=[0xbe8e6b,0x8c6249,0xd3aa85][variant%3];
  const shirt=[0xd8d4c5,0x647b88,0x805e55,0x424f53][variant%4];
  function part(geo,color,x,y,z,sx=1,sy=1,sz=1,parent=g) {
    const m=new T.Mesh(geo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;
  }
  part(torsoGeometry,shirt,0,1.18,0,1,1,.7);
  part(headGeometry,skin,0,1.66,0,.18,.235,.18);
  part(headGeometry,0x252525,0,1.79,-.025,.185,.13,.175);
  part(headGeometry,skin,0,1.66,.17,.055,.07,.05); // nose faces movement
  for(const x of [-.14,.14]) {
    const pivot=new T.Group();pivot.position.set(x,.89,0);g.add(pivot);limbs.push(pivot);
    part(limbGeometry,0x31414f,0,-.32,0,1,1.12,1,pivot);
    box(pivot,.22,.13,.35,0,-.78,.06,0x242a2f);
  }
  for(const x of [-.36,.36]) {
    const pivot=new T.Group();pivot.position.set(x,1.43,0);g.add(pivot);limbs.push(pivot);
    part(limbGeometry,shirt,0,-.16,0,.88,.58,.88,pivot);
    part(limbGeometry,skin,0,-.43,0,.76,.6,.76,pivot);
  }
  g.userData.limbs=limbs;return g;
}
