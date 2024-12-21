import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const nodeModules = new RegExp(/^(?:.*[\\\/])?node_modules(?:[\\\/].*)?$/);
const root = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2] || root;

const dirnamePlugin = {
  name: "dirname",
  setup(build) {
    build.onLoad({ filter: /\.[tj]s$/ }, async ({ path: filePath }) => {
      if (filePath.match(nodeModules)) {
        let contents = await fsp.readFile(filePath, "utf8");
        const loader = path.extname(filePath).substring(1);
        const dirname = path.dirname(filePath);
        const rel = path.relative('../..', path.relative(root, dirname));
        contents = `var __dirname = "${path.join(output, rel)}";\n` + contents;
        return {
          contents,
          loader,
        };
      }
    });
  },
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.cjs',
  platform: 'node',
  format: 'cjs',
  plugins: [dirnamePlugin],
})
