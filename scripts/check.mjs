import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
for (const dir of ["src", "scripts"])
  for (const name of readdirSync(dir))
    if (/\.(mjs|js)$/.test(name))
      execFileSync(process.execPath, ["--check", `${dir}/${name}`], {
        stdio: "inherit",
      });
console.log("All JavaScript modules passed syntax checks.");
