import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';
import { isPathWithinRoot } from '../../helpers/base-source';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon'
};

/**
 * Read an image file and return it as a base64 data URL.
 *
 * The raw file host often serves images without CORS headers, so a browser on a
 * different origin (e.g. a dev server, or the image editor) can't `fetch()` them
 * directly. This returns the bytes through the connector's own CORS-enabled JSON
 * API instead — the same path the file browser already uses.
 */
export async function loadImage(
  ctx: FileManagerContext,
  name: string,
  relativePath?: string
): Promise<{ dataUrl: string; name: string }> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'IMAGE_LOAD',
    dirPath
  );

  const filePath = await validatePath(ctx, path.join(dirPath, name));

  if (!isPathWithinRoot(filePath, dirPath)) {
    throw Boom.notFound('Path does not exist');
  }

  const relative = filePath.replace(root, '').replace(/^\//, '');

  let buffer: Buffer;

  try {
    const stat = await ctx.storage.stat(relative, {});

    if (!stat.isFile) {
      throw Boom.badRequest('It is not a file!');
    }

    buffer = await ctx.storage.readToBuffer(relative, {});
  } catch {
    throw Boom.notFound('File not exists');
  }

  const ext = path.extname(name).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

  return { dataUrl, name: path.basename(name) };
}
