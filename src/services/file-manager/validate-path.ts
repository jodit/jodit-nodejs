import path from 'node:path';
import Boom from '@hapi/boom';
import type { FileManagerContext } from './types';

/**
 * Validate and normalize a path to ensure it's within root directory
 * Returns the normalized absolute path if valid, throws error otherwise
 */
export async function validatePath(
  ctx: FileManagerContext,
  pathname: string
): Promise<string> {
  const root = await ctx.getRoot();

  // Normalize and resolve the path
  const normalized = path.resolve(pathname);

  // Security check: ensure path is within root
  if (!normalized.startsWith(root)) {
    throw Boom.notFound('Path does not exist');
  }

  return normalized;
}
