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
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync("dist/version.json", JSON.stringify({ version: pkg.version }));
console.log(
  "Built Island Drive: static, self-contained, no external CDN dependencies.",
);
