import path from 'node:path';
import sharp from 'sharp';
import slugify from 'slugify';
import type { IItemFile, ISourceFile, ISourceItem } from '../types/rest-api';
import { BaseSource } from '../helpers/base-source';
import { Image } from '../helpers/image';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import dayjs from 'dayjs';
import type { StatEntry, StorageAdapter } from '@flystorage/file-storage';
import type { Config } from '../config/config';
import type { SourceConfig } from '../types';
import { Readable } from 'node:stream';

/**
 * FileManagerService - Business logic for file operations
 * Uses StorageAdapter for low-level file system access
 */
export class FileManagerService extends BaseSource {
  private storage: StorageAdapter;

  constructor(
    sourceConfig: SourceConfig,
    config: Config,
    storage: StorageAdapter,
    name?: string
  ) {
    super(sourceConfig, config, name);
    this.storage = storage;
  }

  async isDirectory(pathname: string): Promise<boolean> {
    try {
      const root = await this.getRoot();
      // For other paths, convert to relative and use storage adapter
      let relativePath = pathname.replace(root, '');
      if (relativePath.startsWith(path.sep)) {
        relativePath = relativePath.substring(1);
      }

      const stats = await this.storage.stat(relativePath || '/', {});
      return stats.isDirectory;
    } catch {
      return false;
    }
  }

  async makeThumb(
    file: StatEntry,
    counter: { countThumbs: number } = { countThumbs: 0 }
  ): Promise<string> {
    const root = await this.getRoot();
    const fullPath = path.resolve(root, file.path);
    const fileDirectory = path.dirname(fullPath);

    if (
      !(await this.isDirectory(
        path.join(fileDirectory, this.config.params.thumbFolderName)
      ))
    ) {
      
      await this.storage.createDirectory(
        path.join(
          path.relative(root, fileDirectory),
          this.config.params.thumbFolderName
        ),
        {}
      );
    }

    const ext =
      file.isDirectory || !this.isImage(file)
        ? 'svg'
        : this.getExtension(file.path);

    let thumbName = path.resolve(
      fileDirectory,
      this.config.params.thumbFolderName,
      slugify(path.basename(file.path, '.' + ext)) + '.' + ext
    );

    if (await this.storage.fileExists(path.relative(root, thumbName), {})) {
      return thumbName;
    }

    if (this.getExtension(file.path) === 'svg') {
      return file.path;
    }

    counter.countThumbs++;

    if (this.isImage(file)) {
      try {
        const buffer = await sharp(fullPath)
          .resize(this.config.params.thumbSize, this.config.params.thumbSize, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: this.config.params.quality })
          .toBuffer();

        await this.storage.write(
          path.relative(root, thumbName),
          Readable.from(buffer),
          {}
        );
      } catch {
        return file.path;
      }
    } else {
      const svg = Image.generateIcon(file);
      await this.storage.write(
        path.relative(root, thumbName),
        Readable.from(svg),
        {}
      );
    }

    return thumbName;
  }

  async items(
    relativePath: string,
    options: {
      withFolders: boolean;
      onlyImages: boolean;
      offset: number;
      limit: number;
      sortBy: string;
      foldersPosition: 'default' | 'top' | 'bottom';
    }
  ): Promise<ISourceItem> {
    const fullPathDirectory = await this.getPath(relativePath);
    const rootDirecrtoryForSource = await this.getRoot();

    if (!fullPathDirectory.startsWith(rootDirecrtoryForSource)) {
      throw Boom.notFound('Path does not exist');
    }

    let relativeCalcPath = fullPathDirectory.replace(
      rootDirecrtoryForSource,
      ''
    );
    if (relativeCalcPath.length > 1 && relativeCalcPath.startsWith(path.sep)) {
      relativeCalcPath = relativeCalcPath.substring(1);
    }

    const sourceData: ISourceItem = {
      name: this.name,
      title: this.sourceConfig.title,
      baseurl: this.sourceConfig.baseurl,
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

    for await (const file of this.storage.list(storageRelativePath, {
      deep: false
    })) {
      if (this.isExcluded(file)) {
        continue;
      }

      const apiFile = await this.filterFile(file, options);

      if (apiFile) {
        fileList.push(apiFile);
      }
    }

    // Apply sorting
    this.sortByMode(fileList, sortBy, options);

    // Apply pagination
    const files = fileList.slice(offset, offset + limit);

    const counter = { countThumbs: 0 };

    // Build response
    for (const file of files) {
      let item: ISourceFile;

      const allowMakeThumb =
        this.config.params.createThumb &&
        counter.countThumbs <= this.config.params.safeThumbsCountInOneTime;

      const thumbPath = allowMakeThumb
        ? await this.makeThumb(file.stat, counter)
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
          changed: dayjs(file.mtime).format(this.config.params.datetimeFormat),
          thumb: thumbPath
            ? path.relative(fullPathDirectory, thumbPath)
            : undefined
        };
      }
      sourceData.files.push(item);
    }

    return sourceData;
  }

  private async filterFile(
    file: StatEntry,
    options: { withFolders: boolean; onlyImages: boolean }
  ): Promise<IItemFile | null> {
    const { withFolders, onlyImages } = options;

    try {
      const stats = await this.storage.stat(file.path, {});
      const ext = this.getExtension(file.path);
      const isGoodFile = this.isGoodFile(file);
      const isImage = this.isImage(file);

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

  private sortByMode(
    files: IItemFile[],
    sortBy: string,
    options: {
      foldersPosition: 'default' | 'top' | 'bottom';
    }
  ): void {
    switch (sortBy) {
      case 'name-asc':
        sortFiles(files);
        break;

      case 'name-desc':
        sortFiles(files, -1);
        break;

      case 'changed-desc':
      case 'changed-asc':
      case 'size-asc':
      case 'size-desc':
        files.sort((fileA, fileB) => {
          switch (sortBy) {
            case 'changed-desc':
            case 'changed-asc': {
              const a = fileA.stat.lastModifiedMs || 0;
              const b = fileB.stat.lastModifiedMs || 0;

              if (a === b) {
                const m = sortBy === 'changed-asc' ? 1 : -1;
                return fileA.name > fileB.name ? 1 * m : -1 * m;
              }

              return sortBy === 'changed-asc' ? a - b : b - a;
            }
            case 'size-desc':
            case 'size-asc': {
              const a = fileA.size;
              const b = fileB.size;

              return sortBy === 'size-asc' ? a - b : b - a;
            }
          }

          return 0;
        });

        break;

      default:
        sortFiles(files, -1);
    }

    const foldersPosition = options.foldersPosition;

    if (foldersPosition !== 'default') {
      files.sort((fileA, fileB) => {
        if (fileA.stat.isDirectory && !fileB.stat.isDirectory) {
          return foldersPosition === 'top' ? -1 : 1;
        }

        if (!fileA.stat.isDirectory && fileB.stat.isDirectory) {
          return foldersPosition === 'top' ? 1 : -1;
        }

        if (fileA.stat.isDirectory && fileB.stat.isDirectory) {
          return fileA > fileB ? 1 : -1;
        }

        return 0;
      });
    }
  }
}

function sortFiles(files: IItemFile[], reverse: number = 1): void {
  files.sort((a, b) => {
    if (a.name < b.name) {
      return -1 * reverse;
    }
    if (a.name > b.name) {
      return 1 * reverse;
    }
    return 0;
  });
}
