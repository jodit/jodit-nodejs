import type { Server } from 'http';
import type { AppConfig } from './types';
import { version } from '../package.json';
import { logger } from './helpers/logger';
import { createApp } from './app';

let server: Server | null = null;

// Re-export createApp for direct use
export { createApp };

export async function start(port?: number, customConfig?: Partial<AppConfig>): Promise<Server> {
  const PORT: number = port ?? parseInt(process.env.PORT ?? '3000', 10);

  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    logger.error('Invalid PORT. Must be a number between 1 and 65535.');
    throw new Error('Invalid PORT');
  }

  const app = createApp(customConfig);

  return new Promise((resolve, reject) => {
    server = app.listen(PORT, (): void => {
      const message = `Jodit Connector v.${version} listening on port ${PORT}!`;
      logger.info(message);
      resolve(server as Server);
    });

    server.on('error', reject);
  });
}

export async function stop(): Promise<void> {
  if (server === null || server === undefined) {
    logger.warn('Server is not running');
    return;
  }

  return new Promise((resolve, reject) => {
    server?.close((err?: Error) => {
      if (err !== null && err !== undefined) {
        logger.error(`Error during server shutdown: ${err.message}`);
        reject(err);
      } else {
        logger.info('Server closed');
        server = null;
        resolve();
      }
    });
  });
}

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    await stop();
    process.exit(0);
  } catch (error) {
    logger.error(
      `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
};

// Handle shutdown signals
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled rejections
process.once('unhandledRejection', async err => {
  logger.error(`unhandledRejection: ${err}`);
  await shutdown('unhandledRejection');
});
