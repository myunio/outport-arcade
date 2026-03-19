import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  outfile: "dist/outport-arcade.esm.js",
  sourcemap: true,
  target: "es2020",
})

console.log("Built dist/outport-arcade.esm.js")
