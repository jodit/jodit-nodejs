import path from 'node:path';
import type { FileManagerContext } from './types';

/**
 * Resolve a file by its URL
 */
export async function resolveFileByUrl(
  ctx: FileManagerContext,
  url: string
): Promise<{
  path: string;
  name: string;
  source: string;
  messages: string[];
  code: number;
} | null> {
  const base = new URL(ctx.sourceConfig.baseurl);
  const parts = new URL(url);

  const pathname = base.pathname
    ? parts.pathname.replace(
        new RegExp(
          '^(/)?' + base.pathname.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
        ),
        ''
      )
    : '';

  const root = await ctx.getPath();
  const filePathRelative = pathname.replace(/^\//, '');

  try {
    const stats = await ctx.storage.stat(filePathRelative, {});

    if (stats.isFile && ctx.isSafeFile(stats)) {
      let dirPath = path.dirname(path.join(root, pathname)).replace(root, '');
      // Remove trailing separator if it's not just root
      if (dirPath.endsWith(path.sep) && dirPath !== path.sep) {
        dirPath = dirPath.slice(0, -1);
      }
      // Ensure it starts with separator
      if (!dirPath.startsWith(path.sep)) {
        dirPath = path.sep + dirPath;
      }

      return {
        path: dirPath,
        name: path.basename(pathname),
        source: ctx.sourceConfig.name,
        messages: [],
        code: 0
      };
    }
  } catch {
    // File doesn't exist or error occurred
  }

  return null;
}
