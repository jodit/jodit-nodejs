import path from 'node:path';
import sharp from 'sharp';
import Boom from '@hapi/boom';
import slugify from 'slugify';
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

  // Drop the stale cached thumbnail so the file browser regenerates it from the
  // just-saved bytes — without this an edited image keeps showing the old
  // thumbnail (the `?_tmst=` cache-buster re-fetches the same stale file).
  await removeThumb(ctx, destRelative);

  return destRelative;
}

/**
 * Delete the cached thumbnail for a file (if it exists), matching the naming
 * used by {@link makeThumb}: `<dir>/<thumbFolder>/<slug(basename)>.<ext>` —
 * plus the raw (unslugified) name, under which a thumbnail may have been
 * stored by another connector sharing the same folder (the PHP one slugifies
 * differently). Best-effort — thumbnail cleanup must never fail the save.
 */
async function removeThumb(
  ctx: FileManagerContext,
  fileRelative: string
): Promise<void> {
  try {
    const ext = ctx.getExtension(fileRelative);
    const base = path.basename(fileRelative, '.' + ext);
    const names = new Set([slugify(base) + '.' + ext, base + '.' + ext]);

    for (const name of names) {
      const thumbRelative = path.join(
        path.dirname(fileRelative),
        ctx.config.params.thumbFolderName,
        name
      );

      if (await ctx.storage.fileExists(thumbRelative, {}).catch(() => false)) {
        await ctx.storage.deleteFile(thumbRelative, {}).catch(() => {});
      }
    }
  } catch {
    // Ignore — a missing/uncleanable thumbnail is not a save failure.
  }
}
