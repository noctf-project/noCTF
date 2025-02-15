import { writeFileSync } from "node:fs";
import { server } from "./index.ts";

server.ready(() => {
  writeFileSync(process.argv[2], JSON.stringify(server.swagger()));
  process.exit(0);
});
