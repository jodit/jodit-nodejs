import express, { Application, Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import multer from 'multer';
import os from 'os';
import type { AppConfig } from './types';
import { config as defaultConfig } from './config';
import { logger } from './helpers/logger';
import { filesHandler } from './v1/files';
import { pingHandler } from './v1/ping';
import { fileUploadHandler } from './v1/file-upload';
import { fileRemoveHandler } from './v1/file-remove';
import { fileMoveHandler } from './v1/file-move';
import { fileRenameHandler } from './v1/file-rename';
import { fileDownloadHandler } from './v1/file-download';
import { getLocalFileByUrlHandler } from './v1/get-local-file-by-url';
import { fileUploadRemoteHandler } from './v1/file-upload-remote';
import { folderCreateHandler } from './v1/folder-create';
import { folderRemoveHandler } from './v1/folder-remove';
import { folderMoveHandler } from './v1/folder-move';
import { folderRenameHandler } from './v1/folder-rename';
import { foldersHandler } from './v1/folders';
import { permissionsHandler } from './v1/permissions';
import { imageResizeHandler } from './v1/image-resize';
import { imageCropHandler } from './v1/image-crop';
import { generateDocxHandler } from './v1/generate-docx';
import { generatePdfHandler } from './v1/generate-pdf';
import { validateQuery } from './middlewares/validate-query';
import { customConfigMiddleware } from './middlewares/custom-config';
import { corsMiddleware } from './middlewares/cors';
import { authMiddleware } from './middlewares/auth';
import { accessControlMiddleware } from './middlewares/access-control';
import { BaseActionQueryPassthroughSchema, AppConfigSchema } from './schemas';

export function createApp(customConfig?: Partial<AppConfig>): Application {
  const config: AppConfig =
    customConfig !== undefined
      ? { ...defaultConfig, ...customConfig }
      : defaultConfig;

  // Validate config on startup
  const validation = AppConfigSchema.safeParse(config);
  if (!validation.success) {
    const errors = validation.error.issues.map(
      err => `${err.path.join('.')}: ${err.message}`
    );
    logger.error(`Invalid application config: ${errors.join(', ')}`);
    throw new Error(`Invalid application config: ${errors.join(', ')}`);
  }

  // Configure multer for file uploads
  const upload = multer({
    dest: os.tmpdir(),
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB max
    }
  });

  const app: Application = express()
    .disable('x-powered-by')
    .use(express.json())
    .use(express.urlencoded({ extended: true }));

  // Attach config to app.locals for use in handlers
  app.locals.config = config;

  // Apply middlewares
  app.use(corsMiddleware);
  app.use(customConfigMiddleware);
  app.use(authMiddleware);
  app.use(accessControlMiddleware);

  // Routes
  app.get('/ping', pingHandler);

  // POST endpoint for file uploads and other actions
  app.post(
    '/',
    (req: Request, res: Response, next: NextFunction) => {
      // Check if this is a multipart request (file upload)
      const contentType = req.headers['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        // For multipart requests, always use multer
        upload.array('files')(req, res, next);
      } else {
        // For JSON requests, skip multer
        next();
      }
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // For POST requests, action can come from query or body
        const action = (req.query.action ?? req.body?.action) as string;

        switch (action) {
          case 'fileUpload':
            await fileUploadHandler(req, res);
            break;
          case 'files':
            await filesHandler(req, res);
            break;
          default: {
            const boomError = Boom.notFound(`Action "${action}" not found`);
            boomError.output.payload.messages = [boomError.message];
            throw boomError;
          }
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Main API endpoint with validation
  app.get(
    '/',
    validateQuery(BaseActionQueryPassthroughSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const action = req.query.action as string;

        switch (action) {
          case 'files':
            await filesHandler(req, res);
            break;
          case 'fileRemove':
            await fileRemoveHandler(req, res);
            break;
          case 'fileMove':
            await fileMoveHandler(req, res);
            break;
          case 'fileRename':
            await fileRenameHandler(req, res);
            break;
          case 'fileDownload':
            await fileDownloadHandler(req, res);
            break;
          case 'getLocalFileByUrl':
            await getLocalFileByUrlHandler(req, res);
            break;
          case 'fileUploadRemote':
            await fileUploadRemoteHandler(req, res);
            break;
          case 'folderCreate':
            await folderCreateHandler(req, res);
            break;
          case 'folderRemove':
            await folderRemoveHandler(req, res);
            break;
          case 'folderMove':
            await folderMoveHandler(req, res);
            break;
          case 'folderRename':
            await folderRenameHandler(req, res);
            break;
          case 'folders':
            await foldersHandler(req, res);
            break;
          case 'permissions':
            await permissionsHandler(req, res);
            break;
          case 'imageResize':
            await imageResizeHandler(req, res);
            break;
          case 'imageCrop':
            await imageCropHandler(req, res);
            break;
          case 'generateDocx':
            await generateDocxHandler(req, res);
            break;
          case 'generatePdf':
            await generatePdfHandler(req, res);
            break;
          default: {
            const boomError = Boom.notFound(`Action "${action}" not found`);
            boomError.output.payload.messages = [boomError.message];
            throw boomError;
          }
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (config.debug === true) {
      logger.error(err.message);
      logger.debug(err.stack ?? 'No stack trace');
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
  });

  return app;
}
