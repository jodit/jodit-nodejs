import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';

/**
 * Rename a file or folder
 */
export async function renamePath(
  ctx: FileManagerContext,
  fromName: string,
  newName: string,
  relativePath?: string,
  expectType?: 'file' | 'folder'
): Promise<void> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();
  const fromPath = path.join(dirPath, fromName);

  if (!fromPath) {
    throw Boom.badRequest('Need source path');
  }

  // Convert to relative path for storage
  const fromRelative = fromPath.replace(root, '').replace(/^\//, '');

  // Check if source exists
  const fileExists = await ctx.storage
    .fileExists(fromRelative, {})
    .catch(() => false);
  const dirExists = await ctx.storage
    .directoryExists(fromRelative, {})
    .catch(() => false);

  if (!fileExists && !dirExists) {
    if (expectType === 'folder') {
      throw Boom.notFound('Folder or directory not exists');
    }
    throw Boom.notFound('Path not exists');
  }

  const stats = await ctx.storage.stat(fromRelative, {});
  const isFile = stats.isFile;
  const action = isFile ? 'FILE_RENAME' : 'FOLDER_RENAME';

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    action,
    fromPath
  );

  let destinationPath = path.join(dirPath, newName);

  if (!destinationPath) {
    throw Boom.badRequest('Need destination path');
  }

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    action,
    destinationPath
  );

  // For files, preserve extension
  if (isFile) {
    const ext = path.extname(fromPath).toLowerCase();
    const newExt = path.extname(destinationPath).toLowerCase();
    if (newExt !== ext) {
      destinationPath += ext;
    }
  }

  // Convert destination to relative path
  const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

  // Check if destination already exists
  const destFileExists = await ctx.storage
    .fileExists(destRelative, {})
    .catch(() => false);
  const destDirExists = await ctx.storage
    .directoryExists(destRelative, {})
    .catch(() => false);

  if (destFileExists || destDirExists) {
    if (action === 'FOLDER_RENAME') {
      throw Boom.badRequest('Folder with new name already exists');
    }
    throw Boom.badRequest(
      `New ${path.basename(destinationPath)} already exists`
    );
  }

  try {
    await ctx.storage.moveFile(fromRelative, destRelative, {});
  } catch (err) {
    throw Boom.badRequest(`Unable to rename: ${(err as Error).message}`);
  }
}
