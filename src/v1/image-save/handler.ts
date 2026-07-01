import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import Boom from '@hapi/boom';
import { ImageSaveQuerySchema } from '../../schemas';

/**
 * Save an edited image produced client-side by the image editor.
 *
 * The edited image bytes are sent as a multipart file field (like fileUpload),
 * alongside `source`, `path`, `name` and optional `newname`. The bytes are
 * written verbatim to `newname` (save as) or `name` (overwrite), and the new
 * public URL is returned as `newPath` — matching the imageResize/imageCrop
 * response shape so the Jodit client can swap the image in place.
 */
export async function imageSaveHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  const queryValidation = ImageSaveQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  // Get source
  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  // Read the edited image bytes from the uploaded multipart file. Accept both
  // the configured files key and the array-style `files[0]` field name.
  const filesKey =
    source.sourceConfig.defaultFilesKey || config.params.defaultFilesKey;

  const uploadedFiles =
    req.files && Array.isArray(req.files)
      ? req.files.filter(
          file =>
            file.fieldname === filesKey || file.fieldname.startsWith('files[')
        )
      : [];

  if (uploadedFiles.length === 0) {
    throw Boom.badRequest('No image has been uploaded');
  }

  await config.access.checkPermission(
    await config.getUserRole(),
    req.context.action,
    await source.getPath(req.context.path)
  );

  const name = req.context.getField<string>('name', '');
  const newname = req.context.getField<string | undefined>(
    'newname',
    undefined
  );

  if (!name && !newname) {
    throw Boom.badRequest('Either "name" or "newname" is required');
  }

  const imageBuffer = await fs.promises.readFile(uploadedFiles[0].path);

  const destRelative = await source.saveImage(
    imageBuffer,
    name,
    newname,
    req.context.path
  );

  res.json({
    success: true,
    data: {
      code: 220,
      newPath: source.sourceConfig.baseurl + destRelative,
      name: path.basename(destRelative)
    }
  });
}
