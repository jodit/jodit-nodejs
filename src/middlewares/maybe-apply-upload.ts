import type { Request, Response, NextFunction } from 'express';
import type multer from 'multer';

export const createMaybeApplyUploadMiddleware = (
  upload: multer.Multer
) => (req: Request, res: Response, next: NextFunction): void => {
  // Check if this is a multipart request (file upload)
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('multipart/form-data')) {
    // For multipart requests, always use multer
    upload.array('files')(req, res, next);
    return;
  }

  // For JSON requests, skip multer
  next();
};
