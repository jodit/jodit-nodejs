import path from 'node:path';
import type { FileManagerContext } from './types';

/**
 * Check if a pathname is a directory
 */
export async function isDirectory(
  ctx: FileManagerContext,
  pathname: string
): Promise<boolean> {
  try {
    const root = await ctx.getRoot();
    // Convert to relative and use storage adapter
    let relativePath = pathname.replace(root, '');
    if (relativePath.startsWith(path.sep)) {
      relativePath = relativePath.substring(1);
    }

    const stats = await ctx.storage.stat(relativePath || '/', {});
    return stats.isDirectory;
  } catch {
    return false;
  }
}
