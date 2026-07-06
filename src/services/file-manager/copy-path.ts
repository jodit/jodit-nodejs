import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';
import { isDirectory } from './is-directory';
import { validatePath } from './validate-path';

/**
 * Build a target name that does not clash with an existing one:
 * `file.txt` -> `file (1).txt` -> `file (2).txt` ...
 */
async function resolveUniqueTarget(
  ctx: FileManagerContext,
  destinationPath: string,
  root: string,
  baseName: string
): Promise<string> {
  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);

  for (let attempt = 0; ; attempt += 1) {
    const name = attempt === 0 ? baseName : `${stem} (${attempt})${ext}`;
    const target = path.join(destinationPath, name);
    const targetRelative = target.replace(root, '').replace(/^\//, '');

    const exists =
      (await ctx.storage.fileExists(targetRelative, {}).catch(() => false)) ||
      (await ctx.storage
        .directoryExists(targetRelative, {})
        .catch(() => false));

    if (!exists) {
      return targetRelative;
    }
  }
}

/**
 * Copy a file or folder to another location. Unlike move, a name clash is
 * not an error — the copy gets a ` (N)` suffix, so copying into the same
 * folder duplicates the item.
 */
export async function copyPath(
  ctx: FileManagerContext,
  from: string,
  toPath?: string
): Promise<void> {
  const root = await ctx.getRoot();

  // Validate source path is within root (prevents ../traversal in from)
  const sourcePath = await validatePath(ctx, path.join(root, from));

  // Check if destination path exists before calling getPath
  if (toPath) {
    const destPathFull = path.join(root, toPath);
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

  const sourceRelative = sourcePath.replace(root, '').replace(/^\//, '');

  const sourceExists =
    (await ctx.storage.fileExists(sourceRelative, {}).catch(() => false)) ||
    (await ctx.storage.directoryExists(sourceRelative, {}).catch(() => false));

  if (!sourceExists) {
    throw Boom.notFound('Folder or directory not exists');
  }

  const isFolder = await isDirectory(ctx, sourcePath);

  // A folder can not be copied into itself or its own subtree
  if (isFolder) {
    const normalizedSource = sourcePath.replace(/\/+$/, '');
    const normalizedDest = destinationPath.replace(/\/+$/, '');

    if (
      normalizedDest === normalizedSource ||
      normalizedDest.startsWith(normalizedSource + '/')
    ) {
      throw Boom.badRequest('Unable to copy folder into itself');
    }
  }

  const action = !isFolder ? 'FILE_COPY' : 'FOLDER_COPY';

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

  const targetRelative = await resolveUniqueTarget(
    ctx,
    destinationPath,
    root,
    path.basename(sourcePath)
  );

  try {
    if (!isFolder) {
      await ctx.storage.copyFile(sourceRelative, targetRelative, {});
      return;
    }

    // Folder: the storage layer copies only single files — replicate the
    // tree entry by entry
    await ctx.storage.createDirectory(targetRelative, {});

    for await (const entry of ctx.storage.list(sourceRelative, {
      deep: true
    })) {
      const suffix = entry.path.slice(sourceRelative.length);
      const entryTarget = path.join(targetRelative, suffix);

      if (entry.isDirectory) {
        await ctx.storage.createDirectory(entryTarget, {});
      } else {
        await ctx.storage.copyFile(entry.path, entryTarget, {});
      }
    }
  } catch (err) {
    throw Boom.badRequest(`Unable to copy: ${(err as Error).message}`);
  }
}
