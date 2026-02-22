import { Request, Response } from 'express';
import Boom from '@hapi/boom';
import { ImageCropQuerySchema } from '../../schemas';

export async function imageCropHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;

  // Validate query parameters
  const queryValidation = ImageCropQuerySchema.safeParse(req.context.data);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const validatedData = queryValidation.data;

  // Get source
  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  // Get name parameter (image name to crop)
  const name = req.context.getField<string>('name', '');

  if (!name) {
    throw Boom.badRequest('Name parameter is required');
  }

  // Get newname if provided
  const newname = req.context.getField<string | undefined>(
    'newname',
    undefined
  );

  // Crop image through source interface
  const destRelative = await source.cropImage(name, validatedData.box, newname, req.context.path);

  res.json({
    success: true,
    data: {
      code: 220,
      newPath: source.sourceConfig.baseurl + destRelative
    }
  });
}
