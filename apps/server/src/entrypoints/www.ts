import { HOST, PORT } from "../config.ts";
import { server } from "../index.ts";

server.listen(
  {
    port: PORT,
    host: HOST,
  },
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  },
);
