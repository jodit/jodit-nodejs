import path from 'node:path';
import Boom from '@hapi/boom';
import type { ISourceFolders } from '../../types/rest-api';
import type { FileManagerContext } from './types';

/**
 * Get list of folders in a directory
 */
export async function folders(
  ctx: FileManagerContext,
  relativePath: string,
  options: { dots?: boolean | undefined }
): Promise<ISourceFolders> {
  const fullPathDirectory = await ctx.getPath(relativePath);
  const rootDirectoryForSource = await ctx.getRoot();

  if (!fullPathDirectory.startsWith(rootDirectoryForSource)) {
    throw Boom.notFound('Path does not exist');
  }

  let relativeCalcPath = fullPathDirectory.replace(rootDirectoryForSource, '');
  if (relativeCalcPath.length > 1 && relativeCalcPath.startsWith(path.sep)) {
    relativeCalcPath = relativeCalcPath.substring(1);
  }

  const sourceData: ISourceFolders = {
    name: ctx.name,
    title: ctx.sourceConfig.title ?? ctx.sourceConfig.name,
    baseurl: ctx.sourceConfig.baseurl,
    path: relativeCalcPath || path.sep,
    folders: []
  };

  // Add dots navigation if requested
  if (options.dots !== false) {
    sourceData.folders.push(
      fullPathDirectory === rootDirectoryForSource ? '.' : '..'
    );
  }

  // Get list of directories using storage adapter
  const storageRelativePath =
    relativeCalcPath === path.sep ? '' : relativeCalcPath;

  try {
    for await (const entry of ctx.storage.list(storageRelativePath, {
      deep: false
    })) {
      if (entry.isDirectory && !ctx.isExcluded(entry)) {
        const folderName = path.basename(entry.path);
        sourceData.folders.push(folderName);
      }
    }
  } catch {
    // Path does not exist - throw 404
    throw Boom.notFound('Path does not exist');
  }

  return sourceData;
}
