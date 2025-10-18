import type { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { FileUploadQuerySchema } from '../../schemas';

export async function fileUploadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate params
  const queryValidation = FileUploadQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const errors = queryValidation.error.issues.map(err => err.message);
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = errors;
    throw boomError;
  }

  // Get source
  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  // Get the expected field name for uploaded files
  const filesKey =
    source.sourceConfig.defaultFilesKey || config.params.defaultFilesKey;

  // Filter files uploaded with the correct field name
  // Accept both exact match (e.g., 'default') and array-style names (e.g., 'files[0]', 'files[1]')
  const uploadedFiles =
    req.files && Array.isArray(req.files)
      ? req.files.filter(
          file =>
            file.fieldname === filesKey || file.fieldname.startsWith('files[')
        )
      : [];

  // Check if files were uploaded
  if (uploadedFiles.length === 0) {
    throw Boom.badRequest('No files have been uploaded');
  }

  // Check permission
  await config.access.checkPermission(
    await config.getUserRole(),
    req.context.action,
    await source.getPath(req.context.path)
  );

  // Upload files through source interface
  const uploadedFileObjects = await source.uploadFiles(uploadedFiles);

  const messages: string[] = [];
  const filePaths: string[] = [];
  const isImages: boolean[] = [];

  for (const file of uploadedFileObjects) {
    const fileName = file.name;
    messages.push(`File ${fileName} was uploaded`);
    const filePath = file.stat.path;
    // Remove leading slash if present
    filePaths.push(filePath.startsWith('/') ? filePath.substring(1) : filePath);
    isImages.push(file.isImage);
  }

  res.json({
    success: true,
    data: {
      code: 220,
      baseurl: source.sourceConfig.baseurl,
      messages,
      files: filePaths,
      isImages
    }
  });
}
