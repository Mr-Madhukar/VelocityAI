import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: false,
  minify: false,
  // Prepend the shebang so `dist/index.js` is directly executable as the bin.
  banner: { js: "#!/usr/bin/env node" },
});
