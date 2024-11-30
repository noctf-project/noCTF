import { AwilixContainer } from "awilix";
import { AuthService } from "./auth";
import { DatabaseService } from "./database";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ConfigService } from "./config";

export interface ServiceCradle {
  logger: FastifyBaseLogger;
  authService: AuthService;
  configService: ConfigService;
  databaseService: DatabaseService;
}

export interface Service extends FastifyInstance {
  container: AwilixContainer<ServiceCradle>;
}