import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';
import { validatePath } from './validate-path';
import { isPathWithinRoot } from '../../helpers/base-source';

/**
 * Remove a folder from storage
 */
export async function folderRemove(
  ctx: FileManagerContext,
  name: string,
  relativePath?: string
): Promise<void> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'FOLDER_REMOVE',
    dirPath
  );

  // Validate the path is within root and within current directory
  const targetPath = await validatePath(ctx, path.join(dirPath, name));

  // Prevent ../traversal in name escaping the current directory
  if (!isPathWithinRoot(targetPath, dirPath)) {
    throw Boom.notFound('Path does not exist');
  }

  // Convert to relative path for storage
  const folderRelative = targetPath.replace(root, '').replace(/^\//, '');

  try {
    const stats = await ctx.storage.stat(folderRelative, {});

    if (!stats.isDirectory) {
      throw Boom.badRequest('It is not a directory!');
    }

    // Delete thumbs directory if it exists
    const thumbDir = path.join(
      folderRelative,
      ctx.config.params.thumbFolderName
    );
    if (await ctx.storage.directoryExists(thumbDir, {}).catch(() => false)) {
      await ctx.storage.deleteDirectory(thumbDir, {});
    }

    // Delete the directory using storage adapter
    await ctx.storage.deleteDirectory(folderRelative, {});
  } catch (err) {
    if (Boom.isBoom(err)) {
      throw err;
    }
    throw Boom.notFound('Directory not exists');
  }
}
