import { TSchema } from "@sinclair/typebox";
import { ModelToTypeScript, ModelToJsonSchema } from "@sinclair/typebox-codegen";
import { glob, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";



const build = async () => {
  const dist = join(__dirname, "dist");
  const distTs = join(__dirname, 'codegen');
  const distJsonSchema = join(dist, 'jsonschema');
  const src = join(__dirname, "src");
  await rm(dist, { force: true, recursive: true });
  await rm(distTs, { force: true, recursive: true });
  await mkdir(dist);

  const compile = async (fp: string) => {
    const rel = relative(src, fp);
    const noExt = rel.slice(0, rel.length - 3);
    console.log('Compiling', rel);

    const destTs = join(distTs, `${noExt}.ts`);
    const destJsonSchema = join(distJsonSchema, `${noExt}.js`);
    await mkdir(dirname(destTs), { recursive: true });
    await mkdir(dirname(destJsonSchema), { recursive: true });
    const models = (await import(fp)).default as unknown as TSchema[];
    const types = { types: models };

    const outputTs = ModelToTypeScript.Generate(types);
    await writeFile(destTs, outputTs);

    const outputJsonSchema = ModelToJsonSchema.Generate(types);
    await writeFile(destJsonSchema, outputJsonSchema);
  };

  const promises: Promise<any>[] = [];

  for await (const filename of glob([join(src, "/**/*.ts")])) {
    promises.push(compile(filename));
  }
  await Promise.all(promises);
};

build();