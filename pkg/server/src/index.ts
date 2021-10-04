import { PORT } from './config';
import { init } from './server';
import './services';

const start = async () => {
  const server = await init();

  try {
    await server.listen(PORT, '::');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
