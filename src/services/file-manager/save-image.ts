import path from 'node:path';
import sharp from 'sharp';
import Boom from '@hapi/boom';
import { Readable } from 'node:stream';
import sanitize from 'sanitize-filename';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';
import { isPathWithinRoot } from '../../helpers/base-source';

/**
 * Save an already-edited image (raw bytes coming from the client-side image
 * editor) to storage.
 *
 * Unlike {@link resizeImage} / {@link cropImage} — which re-process an existing
 * server file from geometric box parameters — this takes the final image bytes
 * as produced by the editor (crop + filters + finetune + annotations baked in)
 * and writes them verbatim. The target is `newName` ("save as") when provided,
 * otherwise it overwrites `name` (in-place "save"). Returns the path of the
 * saved file relative to the source root (for URL construction by the caller).
 */
export async function saveImage(
  ctx: FileManagerContext,
  imageBuffer: Buffer,
  name: string,
  newName?: string,
  relativePath?: string
): Promise<string> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_SAVE',
    dirPath
  );

  // Validate the incoming bytes really are a decodable image before touching
  // the filesystem — never trust the client blob.
  let format: string | undefined;
  try {
    format = (await sharp(imageBuffer).metadata()).format;
  } catch {
    format = undefined;
  }

  if (!format) {
    throw Boom.badRequest('Provided data is not a valid image');
  }

  const trimmedNewName = newName?.trim();
  const target = trimmedNewName ? trimmedNewName : name;

  if (!target) {
    throw Boom.badRequest('Either "name" or "newname" is required');
  }

  let safeName = sanitize(target, { replacement: '_' });

  // Ensure the target keeps an extension: reuse the original's, or fall back to
  // the detected image format.
  if (!path.extname(safeName)) {
    const ext = path.extname(name) || `.${format}`;
    safeName += ext;
  }

  const destinationPath = await validatePath(
    ctx,
    path.join(dirPath, safeName)
  );

  if (!isPathWithinRoot(destinationPath, dirPath)) {
    throw Boom.notFound('Path does not exist');
  }

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_SAVE',
    destinationPath
  );

  const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

  try {
    const exists = await ctx.storage
      .fileExists(destRelative, {})
      .catch(() => false);

    if (exists) {
      // Overwrite via a temp file so a failed write never corrupts the target.
      const tmpRelative = destRelative + '.tmp';
      await ctx.storage.write(tmpRelative, Readable.from(imageBuffer), {});
      await ctx.storage.deleteFile(destRelative, {});
      await ctx.storage.moveFile(tmpRelative, destRelative, {});
    } else {
      await ctx.storage.write(destRelative, Readable.from(imageBuffer), {});
    }
  } catch (err) {
    throw Boom.badRequest(
      `Unable to save image: ${(err as Error).message}`
    );
  }

  return destRelative;
}
