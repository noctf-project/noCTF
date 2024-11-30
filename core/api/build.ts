import { TSchema } from "@sinclair/typebox";
import { ModelToTypeScript, ModelToJsonSchema } from "@sinclair/typebox-codegen";
import { glob, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";



const build = async () => {
  const dist = join(__dirname, "codegen");
  const src = join(__dirname, "src");

  const compile = async (fp: string) => {
    const rel = relative(src, fp);
    console.log('Compiling', rel);

    const destTs = join(dist, 'ts', rel);
    const destJsonSchema = join(dist, 'jsonschema', rel);
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