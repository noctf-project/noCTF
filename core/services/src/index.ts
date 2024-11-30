import { AwilixContainer } from "awilix";
import { IdentityService } from "./identity";
import { DatabaseService } from "./database";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./config";

export interface ServiceCradle {
  logger: FastifyBaseLogger;
  authService: IdentityService;
  configService: ConfigService;
  databaseService: DatabaseService;
}

export interface Service extends FastifyInstance {
  container: AwilixContainer<ServiceCradle>;
}
