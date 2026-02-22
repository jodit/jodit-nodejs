import path from 'node:path';
import sharp from 'sharp';
import Boom from '@hapi/boom';
import { Readable } from 'node:stream';
import sanitize from 'sanitize-filename';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';

/**
 * Resize an image
 */
export async function resizeImage(
  ctx: FileManagerContext,
  name: string,
  box: { w: number; h: number },
  newName?: string,
  relativePath?: string
): Promise<string> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_RESIZE',
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
      'IMAGE_RESIZE',
      destinationPath
    );
  }

  const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

  try {
    const sourceBuffer = await ctx.storage.readToBuffer(sourceRelative, {});

    const resizedBuffer = await sharp(sourceBuffer)
      .resize(box.w, box.h, {
        fit: 'fill'
      })
      .toBuffer();

    if (destinationPath === sourcePath) {
      const tmpRelative = sourceRelative + '.tmp';

      await ctx.storage.write(tmpRelative, Readable.from(resizedBuffer), {});

      await ctx.storage.deleteFile(sourceRelative, {});

      await ctx.storage.moveFile(tmpRelative, sourceRelative, {});
    } else {
      await ctx.storage.write(destRelative, Readable.from(resizedBuffer), {});
    }
  } catch (err) {
    throw Boom.badRequest(`Unable to resize image: ${(err as Error).message}`);
  }

  return destRelative;
}
