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
): Promise<void> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_CROP',
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
      'IMAGE_CROP',
      destinationPath
    );
  }

  const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

  // Crop the image
  try {
    // Read the source image as buffer
    const sourceBuffer = await ctx.storage.readToBuffer(sourceRelative, {});

    // Crop using sharp
    const croppedBuffer = await sharp(sourceBuffer)
      .extract({
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h
      })
      .toBuffer();

    // If cropping in place, write to temp file first
    if (destinationPath === sourcePath) {
      const tmpRelative = sourceRelative + '.tmp';

      // Write to temp file
      await ctx.storage.write(tmpRelative, Readable.from(croppedBuffer), {});

      // Delete original
      await ctx.storage.deleteFile(sourceRelative, {});

      // Rename temp to original
      await ctx.storage.moveFile(tmpRelative, sourceRelative, {});
    } else {
      // Write directly to destination
      await ctx.storage.write(destRelative, Readable.from(croppedBuffer), {});
    }
  } catch (err) {
    throw Boom.badRequest(`Unable to crop image: ${(err as Error).message}`);
  }
}
