import path from 'node:path';
import type { StatEntry } from '@flystorage/file-storage';
import type { FileManagerContext, IItemFile } from './types';

/**
 * Filter and transform a file entry based on options
 * Returns null if file should be excluded
 */
export async function filterFile(
  ctx: FileManagerContext,
  file: StatEntry,
  options: { withFolders: boolean; onlyImages: boolean }
): Promise<IItemFile | null> {
  const { withFolders, onlyImages } = options;

  try {
    const stats = await ctx.storage.stat(file.path, {});
    const ext = ctx.getExtension(file.path);
    const isGoodFile = ctx.isGoodFile(file);
    const isImage = ctx.isImage(file);

    // Apply filters
    if (stats.isDirectory && withFolders) {
      return {
        stat: file,
        name: path.basename(file.path),
        size: 0,
        mtime: stats.lastModifiedMs || 0,
        extension: '',
        isImage: false
      };
    }

    if (!stats.isDirectory && isGoodFile && (!onlyImages || isImage)) {
      return {
        stat: file,
        name: path.basename(file.path),
        size: stats.size || 0,
        mtime: stats.lastModifiedMs || 0,
        extension: ext,
        isImage
      };
    }
  } catch {
    // Skip files that can't be stat'd
  }

  return null;
}
