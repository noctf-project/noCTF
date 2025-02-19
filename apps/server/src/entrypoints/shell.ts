import { start } from "node:repl";
import { server } from "../index.ts";

const { context } = start();
context.server = server;
