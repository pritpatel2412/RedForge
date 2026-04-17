import fs from "node:fs";
import path from "node:path";

const root = path.resolve("lib/api-zod/src/generated");

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p);
    else if (name.name.endsWith(".ts")) {
      let s = fs.readFileSync(p, "utf8");
      const t = s.replace(
        /(from\s+["'])(\.\/[^"']+)(["'])/g,
        (full, a, imp, c) => (imp.endsWith(".js") ? full : a + imp + ".js" + c),
      );
      if (t !== s) {
        fs.writeFileSync(p, t);
        console.log("updated", p);
      }
    }
  }
}

walk(root);
