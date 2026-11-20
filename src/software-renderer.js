// Canvas painter fallback for browsers with WebGL disabled. Uses the same 3D scene,
// camera and simulation; the GPU renderer remains the default on phones.
import * as T from "../vendor/three.module.js";
export class SoftwareRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.shadowMap = { enabled: false };
    this.pixelRatio = 0.8;
    this.staticCache = new WeakMap();
    this.materialCache = new WeakMap();
    this.lastFrame = 0;
    this.isSoftwareRenderer = true;
  }
  setPixelRatio(v) {
    this.pixelRatio = Math.min(v, 0.8);
  }
  setSize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.pixelRatio);
    this.canvas.height = Math.round(h * this.pixelRatio);
  }
  setAnimationLoop(fn) {
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (t - this.lastFrame < 40) return;
      this.lastFrame = t;
      fn(t);
    };
    requestAnimationFrame(loop);
  }
  color(material, normal) {
    let base = this.materialCache.get(material);
    if (!base) {
      base = new T.Color(material.map ? 0x244651 : material.color || 0xffffff);
      base.convertLinearToSRGB();
      this.materialCache.set(material, base);
    }
    const light = material.isMeshBasicMaterial
      ? 1
      : 0.63 +
        0.37 * Math.max(0, -0.45 * normal.x + 0.8 * normal.y + 0.35 * normal.z);
    return [
      Math.min(255, base.r * light * 255),
      Math.min(255, base.g * light * 255),
      Math.min(255, base.b * light * 255),
    ];
  }
  entity(mesh, matrix) {
    const ms = new T.Vector3().setFromMatrixScale(matrix);
    if (
      mesh.isInstancedMesh &&
      Math.min(ms.x, ms.z) < 0.13 &&
      matrix.elements[13] > 1.5
    )
      return null;
    const geo = mesh.geometry;
    const attr = geo.attributes.position;
    if (!attr) return null;
    const vertices = new Float32Array(attr.count * 3),
      v = new T.Vector3();
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(attr, i).applyMatrix4(matrix);
      vertices.set([v.x, v.y, v.z], i * 3);
    }
    const indexes =
      geo.index?.array || Array.from({ length: attr.count }, (_, i) => i);
    const faces = [];
    const a = new T.Vector3(),
      b = new T.Vector3(),
      c = new T.Vector3(),
      normal = new T.Vector3();
    for (let i = 0; i < indexes.length; i += 3) {
      const ia = indexes[i] * 3,
        ib = indexes[i + 1] * 3,
        ic = indexes[i + 2] * 3;
      a.fromArray(vertices, ia);
      b.fromArray(vertices, ib);
      c.fromArray(vertices, ic);
      normal.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
      faces.push({
        a: ia,
        b: ib,
        c: ic,
        color: this.color(mesh.material, normal),
      });
    }
    geo.computeBoundingSphere();
    const centre = geo.boundingSphere.center.clone().applyMatrix4(matrix),
      scale = new T.Vector3().setFromMatrixScale(matrix);
    return {
      vertices,
      faces,
      centre,
      radius: geo.boundingSphere.radius * Math.max(scale.x, scale.y, scale.z),
      double: mesh.material.side === T.DoubleSide,
      opacity: mesh.material.opacity ?? 1,
      ground:
        (mesh.isInstancedMesh || mesh.parent?.isScene) &&
        Math.max(
          ...Array.from(
            { length: vertices.length / 3 },
            (_, i) => vertices[i * 3 + 1],
          ),
        ) < 1.3,
    };
  }
  render(scene, camera) {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const ctx = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height;
    const sky = scene.background.clone().convertLinearToSRGB();
    const bg = [sky.r * 255, sky.g * 255, sky.b * 255];
    ctx.fillStyle = `rgb(${bg.join(",")})`;
    ctx.fillRect(0, 0, w, h);
    const view = camera.matrixWorldInverse.elements,
      f = h / (2 * Math.tan((camera.fov * Math.PI) / 360)),
      tan = Math.tan((camera.fov * Math.PI) / 360),
      polys = [],
      near = 0.25,
      far = 440;
    const items = [],
      matrix = new T.Matrix4(),
      temp = new T.Matrix4();
    scene.traverseVisible((mesh) => {
      if (!mesh.isMesh || !mesh.geometry || Array.isArray(mesh.material))
        return;
      if (mesh.isInstancedMesh) {
        let cache = this.staticCache.get(mesh);
        if (!cache) {
          cache = [];
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, temp);
            matrix.multiplyMatrices(mesh.matrixWorld, temp);
            const e = this.entity(mesh, matrix);
            if (e) cache.push(e);
          }
          this.staticCache.set(mesh, cache);
        }
        items.push(...cache);
      } else {
        const e = this.entity(mesh, mesh.matrixWorld);
        if (e) items.push(e);
      }
    });
    for (const e of items) {
      const c = e.centre,
        r = e.radius,
        cx = view[0] * c.x + view[4] * c.y + view[8] * c.z + view[12],
        cy = view[1] * c.x + view[5] * c.y + view[9] * c.z + view[13],
        cz = -(view[2] * c.x + view[6] * c.y + view[10] * c.z + view[14]);
      if (
        (r < 4 && cz > 160) ||
        cz + r < near ||
        cz - r > far ||
        Math.abs(cx) > (cz + r) * tan * camera.aspect + r ||
        Math.abs(cy) > (cz + r) * tan + r
      )
        continue;
      const v = e.vertices,
        out = new Float32Array(v.length);
      for (let i = 0; i < v.length; i += 3) {
        const x = v[i],
          y = v[i + 1],
          z = v[i + 2];
        out[i] = view[0] * x + view[4] * y + view[8] * z + view[12];
        out[i + 1] = view[1] * x + view[5] * y + view[9] * z + view[13];
        out[i + 2] = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
      }
      for (const face of e.faces) {
        let points = [face.a, face.b, face.c].map((i) => [
          out[i],
          out[i + 1],
          out[i + 2],
        ]);
        if (points.every((p) => p[2] < near)) continue;
        if (points.some((p) => p[2] < near)) {
          const clipped = [];
          for (let i = 0; i < points.length; i++) {
            const a = points[i],
              b = points[(i + 1) % points.length];
            if (a[2] >= near) clipped.push(a);
            if (a[2] >= near !== b[2] >= near) {
              const t = (near - a[2]) / (b[2] - a[2]);
              clipped.push([
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
                near,
              ]);
            }
          }
          points = clipped;
        }
        if (points.length < 3) continue;
        const p = points.map((a) => [
          w / 2 + (a[0] * f) / a[2],
          h / 2 - (a[1] * f) / a[2],
        ]);
        const area =
          (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
          (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
        if (!e.double && area >= 0) continue;
        if (
          p.every((a) => a[0] < 0) ||
          p.every((a) => a[0] > w) ||
          p.every((a) => a[1] < 0) ||
          p.every((a) => a[1] > h)
        )
          continue;
        const depth = points.reduce((a, p) => a + p[2], 0) / points.length;
        const fog = Math.min(
          e.ground ? 0.38 : 0.94,
          Math.max(0, (depth - 150) / 650),
        );
        const rgb = face.color.map((a, i) =>
          Math.round(a * (1 - fog) + bg[i] * fog),
        );
        polys.push({
          p,
          depth,
          ground: e.ground,
          layer: v[1] || 0,
          color: `rgba(${rgb.join(",")},${e.opacity})`,
        });
      }
    }
    polys.sort((a, b) =>
      a.ground !== b.ground
        ? a.ground
          ? -1
          : 1
        : a.ground && Math.abs(a.layer - b.layer) > 0.005
          ? a.layer - b.layer
          : b.depth - a.depth,
    );
    for (const { p, color } of polys) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(...p[0]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(...p[i]);
      ctx.closePath();
      ctx.fill();
    }
  }
}
