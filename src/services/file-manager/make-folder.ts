import path from 'node:path';
import Boom from '@hapi/boom';
import sanitize from 'sanitize-filename';
import type { FileManagerContext } from './types';

/**
 * Create a new folder
 */
export async function makeFolder(
  ctx: FileManagerContext,
  name: string,
  relativePath?: string
): Promise<void> {
  const folderName = sanitize(name, { replacement: '_' });

  if (!folderName) {
    throw Boom.badRequest('Folder name is required');
  }

  const root = await ctx.getRoot();
  const parentPath = path.join(root, relativePath ?? './');
  const parentRelative = parentPath.replace(root, '').replace(/^\//, '') || '/';

  // Check if parent directory exists
  try {
    const parentStats = await ctx.storage.stat(parentRelative, {});
    if (!parentStats.isDirectory) {
      throw Boom.notFound('Directory not found');
    }
  } catch {
    throw Boom.notFound('Directory not found');
  }

  const dirPath = await ctx.getPath(relativePath);
  const folderPath = path.join(dirPath, folderName);
  const folderRelative = folderPath.replace(root, '').replace(/^\//, '');

  // Check permissions
  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'FOLDER_CREATE',
    folderPath
  );

  // Check if folder already exists
  if (
    await ctx.storage.directoryExists(folderRelative, {}).catch(() => false)
  ) {
    throw Boom.badRequest('Directory already exists');
  }

  // Create folder using storage adapter
  await ctx.storage.createDirectory(folderRelative, {});
}
