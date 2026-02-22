import path from 'node:path';
import sharp from 'sharp';
import Boom from '@hapi/boom';
import { Readable } from 'node:stream';
import sanitize from 'sanitize-filename';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';

/**
 * Crop an image
 */
export async function cropImage(
  ctx: FileManagerContext,
  name: string,
  box: { x: number; y: number; w: number; h: number },
  newName?: string,
  relativePath?: string
): Promise<string> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_CROP',
    dirPath
  );

  const sourcePath = await validatePath(ctx, path.join(dirPath, name));

  const sourceRelative = sourcePath.replace(root, '').replace(/^\//, '');

  try {
    const stats = await ctx.storage.stat(sourceRelative, {});
    if (!stats.isFile) {
      throw Boom.badRequest('It is not a file!');
    }
  } catch {
    throw Boom.notFound('File not exists');
  }

  let destinationPath = sourcePath;
  if (newName) {
    newName = sanitize(newName, { replacement: '_' });

    const ext = path.extname(name);
    const newExt = path.extname(newName);
    if (newExt !== ext) {
      newName += ext;
    }

    destinationPath = await validatePath(ctx, path.join(dirPath, newName));

    await ctx.access.checkPermission(
      await ctx.config.getUserRole(),
      'IMAGE_CROP',
      destinationPath
    );
  }

  const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

  // Crop the image
  try {
    const sourceBuffer = await ctx.storage.readToBuffer(sourceRelative, {});

    const croppedBuffer = await sharp(sourceBuffer)
      .extract({
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h
      })
      .toBuffer();

    if (destinationPath === sourcePath) {
      const tmpRelative = sourceRelative + '.tmp';

      await ctx.storage.write(tmpRelative, Readable.from(croppedBuffer), {});

      await ctx.storage.deleteFile(sourceRelative, {});

      await ctx.storage.moveFile(tmpRelative, sourceRelative, {});
    } else {
      // Write drectly to destination
      await ctx.storage.write(destRelative, Readable.from(croppedBuffer), {});
    }
  } catch (err) {
    throw Boom.badRequest(`Unable to crop image: ${(err as Error).message}`);
  }

  return destRelative;
}
