import path from 'node:path';
import { Readable } from 'node:stream';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';

/**
 * Download a file from storage
 */
export async function fileDownload(
  ctx: FileManagerContext,
  target: string,
  relativePath?: string
): Promise<{ stream: Readable; size?: number }> {
  const dirPath = await ctx.getPath(relativePath);

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'FILE_DOWNLOAD',
    dirPath
  );

  const root = await ctx.getRoot();

  // Validate the path is within root
  const targetPath = await validatePath(ctx, path.join(dirPath, target));

  // Convert absolute path to relative for storage adapter
  const relativePathForStorage = targetPath.replace(root, '');
  const storageRelativePath = relativePathForStorage.startsWith(path.sep)
    ? relativePathForStorage.substring(1)
    : relativePathForStorage;

  try {
    const stats = await ctx.storage.stat(storageRelativePath, {});

    if (!stats.isFile) {
      throw Boom.badRequest('It is not a file!');
    }

    // Read file as stream from storage
    const fileContents = Readable.from(
      await ctx.storage.readToBuffer(storageRelativePath, {})
    );

    return {
      stream: fileContents,
      size: stats.size
    };
  } catch (err) {
    if (Boom.isBoom(err)) {
      throw err;
    }
    throw Boom.notFound('File or directory not exists');
  }
}
