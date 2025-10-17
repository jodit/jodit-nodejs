import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';
import { isDirectory } from './is-directory';

/**
 * Move a file or folder to another location
 */
export async function movePath(
  ctx: FileManagerContext,
  from: string,
  toPath?: string
): Promise<void> {
  const root = await ctx.getRoot();
  const sourcePath = path.join(root, from);

  // Check if destination path exists before calling getPath
  if (toPath) {
    const destPathFull = path.join(root, toPath);
    // Convert to relative path for storage
    const destRelative = destPathFull.replace(root, '').replace(/^\//, '');

    try {
      const destStat = await ctx.storage.stat(destRelative || '/', {});
      if (!destStat.isDirectory) {
        throw Boom.notFound('Destination directory not found');
      }
    } catch {
      throw Boom.notFound('Destination directory not found');
    }
  }

  const destinationPath = await ctx.getPath(toPath);

  if (!sourcePath) {
    throw Boom.badRequest('Need source path');
  }
  if (!destinationPath) {
    throw Boom.badRequest('Need destination path');
  }

  // Convert source path to relative
  const sourceRelative = sourcePath.replace(root, '').replace(/^\//, '');

  // Check if source exists using storage
  const sourceExists =
    (await ctx.storage.fileExists(sourceRelative, {}).catch(() => false)) ||
    (await ctx.storage
      .directoryExists(sourceRelative, {})
      .catch(() => false));

  if (!sourceExists) {
    throw Boom.notFound('Folder or directory not exists');
  }

  const isFolder = await isDirectory(ctx, sourcePath);
  const action = !isFolder ? 'FILE_MOVE' : 'FOLDER_MOVE';

  // Check permissions
  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    action,
    destinationPath
  );
  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    action,
    sourcePath
  );

  const target = path.join(destinationPath, path.basename(sourcePath));
  const targetRelative = target.replace(root, '').replace(/^\//, '');

  // Check if target already exists
  const targetExists =
    (await ctx.storage.fileExists(targetRelative, {}).catch(() => false)) ||
    (await ctx.storage
      .directoryExists(targetRelative, {})
      .catch(() => false));

  if (targetExists) {
    if (isFolder) {
      throw Boom.badRequest(
        'Folder with same name already exists in destination'
      );
    }
    throw Boom.badRequest(
      'File with same name already exists in destination'
    );
  }

  try {
    await ctx.storage.moveFile(sourceRelative, targetRelative, {});
  } catch (err) {
    throw Boom.badRequest(`Unable to move: ${(err as Error).message}`);
  }
}
