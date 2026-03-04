import path from 'node:path';
import Boom from '@hapi/boom';
import {
  isPathWithinRoot,
  verifyRealPath
} from '../../helpers/base-source';
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

  // Strict boundary check with path separator
  if (!isPathWithinRoot(normalized, root)) {
    throw Boom.notFound('Path does not exist');
  }

  // Verify symlinks don't escape root
  await verifyRealPath(normalized, root);

  return normalized;
}
