import type { Server } from 'http';
import type { AppConfig } from './types';
import type { AuthCallback } from './middlewares/auth';
import { version } from '../package.json';
import { logger } from './helpers/logger';
import { createApp } from './app';

let server: Server | null = null;

// Re-export createApp for direct use
export { createApp };
export type { AuthCallback };

export interface StartOptions {
  port?: number;
  config?: Partial<AppConfig>;
  checkAuthentication?: AuthCallback;
}

export async function start(
  options?: StartOptions | number,
  customConfig?: Partial<AppConfig>
): Promise<Server> {
  // Support both old signature (port, config) and new (options object)
  let PORT: number;
  let config: Partial<AppConfig> | undefined;
  let checkAuthentication: AuthCallback | undefined;

  if (typeof options === 'object') {
    PORT = options.port ?? parseInt(process.env.PORT ?? '3000', 10);
    config = options.config;
    checkAuthentication = options.checkAuthentication;
  } else {
    PORT = options ?? parseInt(process.env.PORT ?? '3000', 10);
    config = customConfig;
  }

  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    logger.error('Invalid PORT. Must be a number between 1 and 65535.');
    throw new Error('Invalid PORT');
  }

  const app = createApp(config);

  // Set checkAuthentication in app.locals if provided
  if (checkAuthentication !== undefined) {
    app.locals.checkAuthentication = checkAuthentication;
  }

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
