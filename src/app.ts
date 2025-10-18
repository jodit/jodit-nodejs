import express, {
  Application,
  Request,
  Response,
  NextFunction,
  Router
} from 'express';
import Boom from '@hapi/boom';
import multer from 'multer';
import os from 'os';
import type { AppConfig } from './types';
import { config as defaultConfig } from './config';
import { logger } from './helpers/logger';
import { pingHandler } from './v1/ping/handler';
import { corsMiddleware } from './middlewares/cors';
import { authMiddleware } from './middlewares/auth';
import { AppConfigSchema } from './schemas';
import { actions } from './v1';
import { Config } from './config/config';
import { requestContext } from './middlewares/request-context';

/**
 * Create Jodit Connector application
 *
 * @param customConfig - Custom configuration (optional)
 * @param existingApp - Existing Express application to integrate with (optional)
 * @param existingRouter - Existing Express router to use (optional)
 * @returns Express application with Jodit Connector routes and middleware
 *
 * @example
 * // Standalone mode (default)
 * const app = createApp(config);
 * app.listen(8081);
 *
 * @example
 * // Integration with existing Express app
 * const myApp = express();
 * myApp.get('/health', (req, res) => res.send('OK'));
 * createApp(config, myApp);
 * myApp.listen(8081);
 *
 * @example
 * // Custom router with path prefix
 * const myApp = express();
 * const myRouter = Router();
 * createApp(config, myApp, myRouter);
 * myApp.use('/jodit', myRouter); // Mount at /jodit prefix
 * myApp.listen(8081);
 */
export function createApp(
  customConfig?: Partial<AppConfig>,
  existingApp?: Application,
  existingRouter?: Router
): Application {
  const appConfig: AppConfig =
    customConfig !== undefined
      ? { ...defaultConfig, ...customConfig }
      : defaultConfig;

  // Validate config on startup
  const validation = AppConfigSchema.safeParse(appConfig);
  if (!validation.success) {
    const errors = validation.error.issues.map(
      err => `${err.path.join('.')}: ${err.message}`
    );

    logger.error(`Invalid application config: ${errors.join(', ')}`);

    throw Boom.badRequest(`Invalid application config: ${errors.join(', ')}`);
  }

  // Use existing app or create new one
  const app: Application =
    existingApp ||
    express()
      .disable('x-powered-by')
      .use(express.json())
      .use(express.urlencoded({ extended: true }));

  // Create config instance for this router (stored in closure)
  const configInstance = new Config(appConfig);

  // Store config in app.locals only if app was created by us (backward compatibility)
  if (!existingApp) {
    app.locals.config = configInstance;
  }

  // Use existing router or create new one
  const router: Router = existingRouter || Router();

  // Configure multer for file uploads (using system temp directory)
  const upload = multer({ dest: os.tmpdir() }).any();

  // Middleware to attach config to request (for multi-instance support)
  router.use((req: Request, _res: Response, next: NextFunction) => {
    // Store config in app.locals for handlers to access
    req.app.locals.config = configInstance;
    next();
  });

  // Middleware to block GET requests if onlyPOST is enabled
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (configInstance.params.onlyPOST && req.method === 'GET') {
      const boomError = Boom.methodNotAllowed(
        'GET requests are disabled. Use POST instead.'
      );
      boomError.output.payload.messages = [boomError.message];
      return next(boomError);
    }
    next();
  });

  // Apply middlewares to router
  router.use(corsMiddleware);
  router.use(authMiddleware);

  // Routes
  router.get('/ping', pingHandler);

  const actionHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const action = req.context.action;

      // Use config from closure (each router has its own configInstance)
      await configInstance.access.checkPermission(
        await configInstance.getUserRole(),
        action,
        req.context.path
      );

      const handler = actions[action as keyof typeof actions];

      if (handler != null) {
        await handler(req, res);
      } else {
        const boomError = Boom.notFound(`Action "${action}" not found`);
        boomError.output.payload.messages = [boomError.message];
        throw boomError;
      }
    } catch (error) {
      next(error);
    }
  };

  // POST endpoint for file uploads and other actions
  router.post('/', upload, requestContext, actionHandler);
  router.post('/:action', upload, requestContext, actionHandler);
  // Main API endpoint with validation
  router.get('/', requestContext, actionHandler);
  router.get('/:action', requestContext, actionHandler);

  // Error handler on router
  router.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      if (configInstance?.params?.debug === true) {
        logger.error(err);
      }

      // Check if it's a Boom error
      if (Boom.isBoom(err)) {
        const statusCode = err.output.statusCode;
        const messages = (err.output.payload as { messages?: string[] })
          .messages ?? [err.message];

        res.status(statusCode).json({
          success: false,
          data: {
            code: statusCode,
            messages
          }
        });
        return;
      }

      // Handle regular errors
      res.status(500).json({
        success: false,
        data: {
          code: 500,
          messages: [err.message]
        }
      });
    }
  );

  // Mount router to app if router was created internally (not passed by user)
  if (!existingRouter) {
    app.use('/', router);
  }

  return app;
}
