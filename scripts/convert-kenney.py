"""Bake selected CC0 Kenney GLBs into small, palette-coloured indexed meshes.

Usage: python scripts/convert-kenney.py /path/to/tge-assets
Requires Python, NumPy and Pillow. No executable code is loaded from the asset repo.
See public/assets/kenney/PROVENANCE.json for the pinned source and hashes.
"""
import base64
import hashlib
import io
import json
import pathlib
import struct
import sys
import subprocess
import numpy as np
from PIL import Image

REVISION = "f6b23734fe53679bb5b7c7b740739328f6f5231d"
MODELS = {"sport": "sedan-sports", "suv": "suv-luxury", "taxi": "taxi", "police": "police", "truck": "delivery"}
source = pathlib.Path(sys.argv[1])
actual_revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
if actual_revision != REVISION: raise ValueError(f"Check out pinned source {REVISION} before converting")
output = pathlib.Path(__file__).resolve().parent.parent / "public/assets/kenney"
output.mkdir(parents=True, exist_ok=True)
manifest = {"author": "Kenney", "license": "CC0-1.0", "original": "https://kenney.nl/assets/car-kit", "distribution": "https://github.com/Hidencod/tge-assets", "revision": REVISION, "conversion": "Indexed geometry, wheel pivots, vertex palette colours. Positions quantized to 1/1000 source unit; colours stored in sRGB.", "models": []}

for key, name in MODELS.items():
    raw = (source / f"packs/car-kit/{name}.glb").read_bytes()
    length = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20:20 + length])
    start = 20 + length
    binary = raw[start + 8:start + 8 + struct.unpack_from("<I", raw, start)[0]]
    def accessor(index):
        a = gltf["accessors"][index]; v = gltf["bufferViews"][a["bufferView"]]
        dtype = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}[a["componentType"]]
        width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
        offset = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        return np.ndarray((a["count"], width), dtype=dtype, buffer=binary, offset=offset, strides=(v.get("byteStride", np.dtype(dtype).itemsize * width), np.dtype(dtype).itemsize)).copy()
    images = []
    for image in gltf.get("images", []):
        if "bufferView" in image:
            v = gltf["bufferViews"][image["bufferView"]]; off = v.get("byteOffset", 0)
            data = binary[off:off + v["byteLength"]]
        else: data = base64.b64decode(image["uri"].split(",", 1)[1])
        images.append(np.asarray(Image.open(io.BytesIO(data)).convert("RGB")))
    grouped = {}
    def visit(index, parent):
        node = gltf["nodes"][index]
        if "rotation" in node: raise ValueError("Unexpected quaternion: extend converter before importing this asset")
        local = np.diag([*node.get("scale", [1, 1, 1]), 1.0]); local[:3, 3] = node.get("translation", [0, 0, 0])
        if "matrix" in node: local = np.array(node["matrix"]).reshape(4, 4).T
        matrix = parent @ local
        if "mesh" in node:
            group = node.get("name", "body") if "wheel" in node.get("name", "") else "body"
            part = grouped.setdefault(group, {"name": group, "positions": [], "normals": [], "colors": [], "indices": []})
            for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
                if primitive.get("mode", 4) != 4: raise ValueError("Only triangles are supported")
                attr = primitive["attributes"]; p = accessor(attr["POSITION"])
                positions = (matrix @ np.column_stack((p, np.ones(len(p)))).T).T[:, :3]
                normals = accessor(attr["NORMAL"]) @ np.linalg.inv(matrix[:3, :3])
                normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-9)
                material = gltf["materials"][primitive["material"]].get("pbrMetallicRoughness", {})
                factor = np.array(material.get("baseColorFactor", [1, 1, 1, 1])[:3])
                if "baseColorTexture" in material:
                    texture = material["baseColorTexture"]; image = images[gltf["textures"][texture["index"]]["source"]]
                    uv = accessor(attr["TEXCOORD_0"]); uv = np.clip(uv, 0, 1)
                    colors = image[np.minimum((uv[:, 1] * image.shape[0]).astype(int), image.shape[0]-1), np.minimum((uv[:, 0] * image.shape[1]).astype(int), image.shape[1]-1)] * factor
                else: colors = np.tile(factor * 255, (len(p), 1))
                offset = len(part["positions"]) // 3
                part["positions"] += np.round(positions * 1000).astype(int).flatten().tolist()
                part["normals"] += np.round(normals * 1000).astype(int).flatten().tolist()
                part["colors"] += np.round(colors).astype(int).flatten().tolist()
                part["indices"] += (accessor(primitive["indices"]).flatten().astype(int) + offset).tolist()
        for child in node.get("children", []): visit(child, matrix)
    for node in gltf["scenes"][gltf.get("scene", 0)]["nodes"]: visit(node, np.eye(4))
    result = {"author": "Kenney", "license": "CC0-1.0", "model": name, "parts": list(grouped.values())}
    dest = output / f"{key}.json"; dest.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    manifest["models"].append({"type": key, "file": f"{key}.json", "source_path": f"packs/car-kit/{name}.glb", "source_sha256": hashlib.sha256(raw).hexdigest(), "converted_sha256": hashlib.sha256(dest.read_bytes()).hexdigest(), "source_bytes": len(raw), "converted_bytes": dest.stat().st_size})
    print(key, len(raw), "→", dest.stat().st_size, "bytes")
(output / "PROVENANCE.json").write_text(json.dumps(manifest, indent=2) + "\n")
(output / "LICENSE.txt").write_text((source / "LICENSE").read_text())
