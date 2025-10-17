import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';

/**
 * Remove a file from storage
 */
export async function fileRemove(
  ctx: FileManagerContext,
  target: string,
  relativePath?: string
): Promise<void> {
  const dirPath = await ctx.getPath(relativePath);
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

    const ext = ctx.getExtension(targetPath);

    // Check permissions with file extension
    await ctx.access.checkPermission(
      await ctx.config.getUserRole(),
      'FILE_REMOVE',
      dirPath,
      ext
    );

    // Delete file using storage adapter
    await ctx.storage.deleteFile(storageRelativePath, {});
  } catch (err) {
    if (Boom.isBoom(err)) {
      throw err;
    }
    throw Boom.notFound('File or directory not exists');
  }
}
