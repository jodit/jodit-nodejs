import path from 'node:path';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import dayjs from 'dayjs';
import type { ISourceItem, ISourceFile } from '../../types/rest-api';
import type { FileManagerContext, IItemFile } from './types';
import { filterFile } from './filter-file';
import { sortByMode } from './sort-files';
import { makeThumb } from './make-thumb';
import { isPathWithinRoot } from '../../helpers/base-source';

/**
 * Get list of files and folders with pagination and sorting
 */
export async function items(
  ctx: FileManagerContext,
  relativePath: string,
  options: {
    withFolders: boolean;
    onlyImages: boolean;
    offset: number;
    limit: number;
    sortBy: string;
    foldersPosition: 'default' | 'top' | 'bottom';
    filterWord: string;
  }
): Promise<ISourceItem> {
  const fullPathDirectory = await ctx.getPath(relativePath);
  const rootDirecrtoryForSource = await ctx.getRoot();

  if (!isPathWithinRoot(fullPathDirectory, rootDirecrtoryForSource)) {
    throw Boom.notFound('Path does not exist');
  }

  let relativeCalcPath = fullPathDirectory.replace(rootDirecrtoryForSource, '');
  if (relativeCalcPath.length > 1 && relativeCalcPath.startsWith(path.sep)) {
    relativeCalcPath = relativeCalcPath.substring(1);
  }

  const sourceData: ISourceItem = {
    name: ctx.name,
    title: ctx.sourceConfig.title,
    baseurl: ctx.sourceConfig.baseurl,
    path: relativeCalcPath || path.sep,
    files: []
  };

  const offset = options.offset;
  if (isNaN(offset as number)) {
    throw Boom.badData('Offset is not numeric');
  }

  const limit = options.limit;
  if (isNaN(limit as number)) {
    throw Boom.badData('limit is not numeric');
  }

  const sortBy = options.sortBy;

  const fileList: IItemFile[] = [];
  const storageRelativePath =
    relativeCalcPath === path.sep ? '' : relativeCalcPath;

  for await (const file of ctx.storage.list(storageRelativePath, {
    deep: false
  })) {
    if (ctx.isExcluded(file)) {
      continue;
    }

    const apiFile = await filterFile(ctx, file, options);

    if (apiFile) {
      if (
        options.filterWord &&
        !apiFile.name.toLowerCase().includes(options.filterWord.toLowerCase())
      ) {
        continue;
      }
      fileList.push(apiFile);
    }
  }

  // Apply sorting
  sortByMode(fileList, sortBy, options);

  // Apply pagination
  const files = fileList.slice(offset, offset + limit);

  const counter = { countThumbs: 0 };

  // Build response
  for (const file of files) {
    let item: ISourceFile;

    const allowMakeThumb =
      ctx.config.params.createThumb &&
      counter.countThumbs <= ctx.config.params.safeThumbsCountInOneTime;

    const thumbPath = allowMakeThumb
      ? await makeThumb(ctx, file.stat, counter)
      : undefined;

    if (file.stat.isDirectory) {
      item = {
        file: file.name,
        name: file.name,
        type: 'folder',
        thumb: thumbPath
          ? path.relative(fullPathDirectory, thumbPath)
          : undefined
      };
    } else {
      item = {
        file: file.name,
        name: file.name,
        type: file.isImage ? 'image' : 'file',
        isImage: file.isImage,
        size: bytes.format(file.size),
        changed: dayjs(file.mtime).format(ctx.config.params.datetimeFormat),
        thumb: thumbPath
          ? path.relative(fullPathDirectory, thumbPath)
          : undefined
      };
    }
    sourceData.files.push(item);
  }

  return sourceData;
}
