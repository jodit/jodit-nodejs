import path from 'node:path';
import { sanitizeSvg } from './sanitize-svg';
import { logger } from './logger';

/**
 * Clean the bytes of a file on their way into storage.
 *
 * Every write path goes through here, because an SVG is served as
 * `image/svg+xml` and runs its script in the origin that serves the files: it
 * does not matter whether it arrived through `fileUpload`, `fileUploadRemote`
 * or `imageSave`, the stored file is the same stored file.
 *
 * Returns the bytes to write, which are the original ones for anything that is
 * not an SVG or that had nothing to strip.
 */
export function sanitizeUploadBuffer(
  buffer: Buffer,
  fileName: string,
  sanitizeSvgUploads: boolean | undefined
): Buffer {
  if (sanitizeSvgUploads === false) {
    return buffer;
  }

  if (path.extname(fileName).toLowerCase() !== '.svg') {
    return buffer;
  }

  const { svg, changed } = sanitizeSvg(buffer.toString('utf8'));

  if (!changed) {
    return buffer;
  }

  logger.warn(`Stripped scripting from the uploaded SVG ${fileName}`);

  return Buffer.from(svg, 'utf8');
}
