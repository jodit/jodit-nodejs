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
): Promise<void> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_RESIZE',
    dirPath
  );

  // Validate the source file path
  const sourcePath = await validatePath(ctx, path.join(dirPath, name));

  // Convert to relative path for storage
  const sourceRelative = sourcePath.replace(root, '').replace(/^\//, '');

  // Check if file exists and is a file
  try {
    const stats = await ctx.storage.stat(sourceRelative, {});
    if (!stats.isFile) {
      throw Boom.badRequest('It is not a file!');
    }
  } catch {
    throw Boom.notFound('File not exists');
  }

  // Determine the destination path
  let destinationPath = sourcePath;
  if (newName) {
    // Make filename safe
    newName = sanitize(newName, { replacement: '_' });

    // Preserve extension from original file
    const ext = path.extname(name);
    const newExt = path.extname(newName);
    if (newExt !== ext) {
      newName += ext;
    }

    destinationPath = await validatePath(ctx, path.join(dirPath, newName));

    // Check permissions for the new file
    await ctx.access.checkPermission(
      await ctx.config.getUserRole(),
      'IMAGE_RESIZE',
      destinationPath
    );
  }

  const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

  // Resize the image
  try {
    // Read the source image as buffer
    const sourceBuffer = await ctx.storage.readToBuffer(sourceRelative, {});

    // Resize using sharp
    const resizedBuffer = await sharp(sourceBuffer)
      .resize(box.w, box.h, {
        fit: 'fill'
      })
      .toBuffer();

    // If resizing in place, write to temp file first
    if (destinationPath === sourcePath) {
      const tmpRelative = sourceRelative + '.tmp';

      // Write to temp file
      await ctx.storage.write(tmpRelative, Readable.from(resizedBuffer), {});

      // Delete original
      await ctx.storage.deleteFile(sourceRelative, {});

      // Rename temp to original
      await ctx.storage.moveFile(tmpRelative, sourceRelative, {});
    } else {
      // Write directly to destination
      await ctx.storage.write(destRelative, Readable.from(resizedBuffer), {});
    }
  } catch (err) {
    throw Boom.badRequest(`Unable to resize image: ${(err as Error).message}`);
  }
}
