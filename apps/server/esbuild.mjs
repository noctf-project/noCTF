import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';

const nodeModules = new RegExp(/^(?:.*[\\\/])?node_modules(?:[\\\/].*)?$/);

const dirnamePlugin = {
  name: "dirname",
  setup(build) {
    build.onLoad({ filter: /\.[tj]s$/ }, async ({ path: filePath }) => {
      if (filePath.match(nodeModules)) {
        let contents = await fsp.readFile(filePath, "utf8");
        const loader = path.extname(filePath).substring(1);
        const dirname = path.dirname(filePath);
        contents = `var __dirname = "${dirname}";\n` + contents;
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
