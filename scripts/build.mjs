import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/vendor", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("src", "dist/src", { recursive: true });
for (const file of ["three.module.js", "three.core.js"])
  cpSync(`node_modules/three/build/${file}`, `dist/vendor/${file}`);
cpSync("node_modules/three/LICENSE", "dist/vendor/THREE-LICENSE.txt");
cpSync("node_modules/yuka/build/yuka.module.js", "dist/vendor/yuka.module.js");
cpSync("node_modules/yuka/LICENSE", "dist/vendor/YUKA-LICENSE.txt");
const traffic = readFileSync("dist/src/traffic-ai.js", "utf8").replace(
  'from "yuka"',
  'from "../vendor/yuka.module.js"',
);
writeFileSync("dist/src/traffic-ai.js", traffic);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync("dist/version.json", JSON.stringify({ version: pkg.version }));
console.log(
  "Built Island Drive: static, self-contained, no external CDN dependencies.",
);
