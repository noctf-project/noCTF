import fastify from 'fastify';
import { DATABASE_URL, HOST, PORT } from './config';
import core from './core';
import { Service } from '@noctf/services';
import { asFunction, asValue, createContainer, Lifetime } from 'awilix';
import { AuthService } from '@noctf/services/auth';
import { ConfigService } from '@noctf/services/config';
import { DatabaseService } from '@noctf/services/database';

const server: Service = fastify({
  logger: true
}) as unknown as Service;

server.register(async () => {
  server.container = createContainer();
  server.container.register({
    logger: asValue(server.log),
    authService: asFunction(() => new AuthService(), { lifetime: Lifetime.SINGLETON }),
    configService: asFunction(({ logger, databaseService }) => new ConfigService(logger, databaseService), { lifetime: Lifetime.SINGLETON }),
    databaseService: asFunction(() => new DatabaseService(DATABASE_URL), { lifetime: Lifetime.SINGLETON }),
  });
});

server.register(core);

server.listen({
  port: PORT,
  host: HOST
}, (err, _address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
})