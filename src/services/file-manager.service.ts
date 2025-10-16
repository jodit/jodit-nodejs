import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import slugify from 'slugify';
import type {
  IItemFile,
  ISourceFile,
  ISourceItem,
  ISourceFolders
} from '../types/rest-api';
import type { Multer } from 'multer';
import { BaseSource } from '../helpers/base-source';
import { Image } from '../helpers/image';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import dayjs from 'dayjs';
import type { StatEntry, FileStorage } from '@flystorage/file-storage';
import type { Config } from '../config/config';
import type { SourceConfig } from '../types';
import { Readable } from 'node:stream';
import { makeSafeFilename } from '../helpers/file-upload';

/**
 * FileManagerService - Business logic for file operations
 * Uses FileStorage for low-level file system access
 */
export class FileManagerService extends BaseSource {
  private storage: FileStorage;

  constructor(
    sourceConfig: SourceConfig,
    config: Config,
    storage: FileStorage,
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
        const fileBuffer = await this.storage.readToBuffer(
          path.relative(root, fullPath),
          {}
        );
        const buffer = await sharp(fileBuffer)
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

  async realpath(pathname: string): Promise<string> {
    try {
      // For now, use fs.promises.realpath as flystorage doesn't have realpath
      // This is OK because we're still working with local paths
      const fs = await import('node:fs/promises');
      return await fs.realpath(pathname);
    } catch {
      throw Boom.notFound('Path does not exist');
    }
  }

  async movePath(from: string, toPath?: string): Promise<void> {
    const root = await this.getRoot();
    const sourcePath = path.join(root, from);

    // Check if destination path exists before calling getPath
    if (toPath) {
      const destPathFull = path.join(root, toPath);
      // Convert to relative path for storage
      const destRelative = destPathFull.replace(root, '').replace(/^\//, '');

      try {
        const destStat = await this.storage.stat(destRelative || '/', {});
        if (!destStat.isDirectory) {
          throw Boom.notFound('Destination directory not found');
        }
      } catch {
        throw Boom.notFound('Destination directory not found');
      }
    }

    const destinationPath = await this.getPath(toPath);

    if (!sourcePath) {
      throw Boom.badRequest('Need source path');
    }
    if (!destinationPath) {
      throw Boom.badRequest('Need destination path');
    }

    // Convert source path to relative
    const sourceRelative = sourcePath.replace(root, '').replace(/^\//, '');

    // Check if source exists using storage
    const sourceExists =
      (await this.storage.fileExists(sourceRelative, {}).catch(() => false)) ||
      (await this.storage
        .directoryExists(sourceRelative, {})
        .catch(() => false));

    if (!sourceExists) {
      throw Boom.notFound('Folder or directory not exists');
    }

    const isFolder = await this.isDirectory(sourcePath);
    const action = !isFolder ? 'FILE_MOVE' : 'FOLDER_MOVE';

    // Check permissions
    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      destinationPath
    );
    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      sourcePath
    );

    const target = path.join(destinationPath, path.basename(sourcePath));
    const targetRelative = target.replace(root, '').replace(/^\//, '');

    // Check if target already exists
    const targetExists =
      (await this.storage.fileExists(targetRelative, {}).catch(() => false)) ||
      (await this.storage
        .directoryExists(targetRelative, {})
        .catch(() => false));

    if (targetExists) {
      if (isFolder) {
        throw Boom.badRequest(
          'Folder with same name already exists in destination'
        );
      }
      throw Boom.badRequest(
        'File with same name already exists in destination'
      );
    }

    try {
      await this.storage.moveFile(sourceRelative, targetRelative, {});
    } catch (err) {
      throw Boom.badRequest(`Unable to move: ${(err as Error).message}`);
    }
  }

  async fileDownload(
    target: string,
    relativePath?: string
  ): Promise<{ stream: NodeJS.ReadableStream; size?: number }> {
    const dirPath = await this.getPath(relativePath);

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FILE_DOWNLOAD',
      dirPath
    );

    const root = await this.getRoot();
    let resolvedPath: string | false = false;

    try {
      const rp = await this.realpath(path.join(dirPath, target));
      if (rp.startsWith(root)) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath) {
      throw Boom.notFound('File or directory not exists');
    }

    // Convert absolute path to relative for storage adapter
    const relativePathForStorage = resolvedPath.replace(root, '');
    const storageRelativePath = relativePathForStorage.startsWith(path.sep)
      ? relativePathForStorage.substring(1)
      : relativePathForStorage;

    try {
      const stats = await this.storage.stat(storageRelativePath, {});

      if (!stats.isFile) {
        throw Boom.badRequest('It is not a file!');
      }

      // Read file as stream from storage
      const fileContents = Readable.from(
        await this.storage.readToBuffer(storageRelativePath, {})
      );

      return {
        stream: fileContents,
        size: stats.size
      };
    } catch (err) {
      if (Boom.isBoom(err)) {
        throw err;
      }
      throw Boom.notFound('File or directory not exists');
    }
  }

  async fileRemove(target: string, relativePath?: string): Promise<void> {
    const dirPath = await this.getPath(relativePath);
    const root = await this.getRoot();

    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, target));
      if (rp.startsWith(root)) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath) {
      throw Boom.notFound(
        `File or directory not exists ${path.join(dirPath, target)}`
      );
    }

    // Convert absolute path to relative for storage adapter
    const relativePathForStorage = resolvedPath.replace(root, '');
    const storageRelativePath = relativePathForStorage.startsWith(path.sep)
      ? relativePathForStorage.substring(1)
      : relativePathForStorage;

    try {
      const stats = await this.storage.stat(storageRelativePath, {});

      if (!stats.isFile) {
        throw Boom.badRequest('It is not a file!');
      }

      const ext = this.getExtension(resolvedPath);

      // Check permissions with file extension
      await this.config.access.checkPermission(
        await this.config.getUserRole(),
        'FILE_REMOVE',
        dirPath,
        ext
      );

      // Delete file using storage adapter
      await this.storage.deleteFile(storageRelativePath, {});
    } catch (err) {
      if (Boom.isBoom(err)) {
        throw err;
      }
      throw Boom.notFound('File or directory not exists');
    }
  }

  async renamePath(
    fromName: string,
    newName: string,
    relativePath?: string,
    expectType?: 'file' | 'folder'
  ): Promise<void> {
    const dirPath = await this.getPath(relativePath);
    const root = await this.getRoot();
    const fromPath = path.join(dirPath, fromName);

    if (!fromPath) {
      throw Boom.badRequest('Need source path');
    }

    // Convert to relative path for storage
    const fromRelative = fromPath.replace(root, '').replace(/^\//, '');

    // Check if source exists
    const fileExists = await this.storage
      .fileExists(fromRelative, {})
      .catch(() => false);
    const dirExists = await this.storage
      .directoryExists(fromRelative, {})
      .catch(() => false);

    if (!fileExists && !dirExists) {
      if (expectType === 'folder') {
        throw Boom.notFound('Folder or directory not exists');
      }
      throw Boom.notFound('Path not exists');
    }

    const stats = await this.storage.stat(fromRelative, {});
    const isFile = stats.isFile;
    const action = isFile ? 'FILE_RENAME' : 'FOLDER_RENAME';

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      fromPath
    );

    let destinationPath = path.join(dirPath, newName);

    if (!destinationPath) {
      throw Boom.badRequest('Need destination path');
    }

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
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
    const destFileExists = await this.storage
      .fileExists(destRelative, {})
      .catch(() => false);
    const destDirExists = await this.storage
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
      await this.storage.moveFile(fromRelative, destRelative, {});
    } catch (err) {
      throw Boom.badRequest(`Unable to rename: ${(err as Error).message}`);
    }
  }

  async folders(
    relativePath: string,
    options: { dots?: boolean | undefined }
  ): Promise<ISourceFolders> {
    const fullPathDirectory = await this.getPath(relativePath);
    const rootDirectoryForSource = await this.getRoot();

    if (!fullPathDirectory.startsWith(rootDirectoryForSource)) {
      throw Boom.notFound('Path does not exist');
    }

    let relativeCalcPath = fullPathDirectory.replace(
      rootDirectoryForSource,
      ''
    );
    if (relativeCalcPath.length > 1 && relativeCalcPath.startsWith(path.sep)) {
      relativeCalcPath = relativeCalcPath.substring(1);
    }

    const sourceData: ISourceFolders = {
      name: this.name,
      title: this.sourceConfig.title ?? this.sourceConfig.name,
      baseurl: this.sourceConfig.baseurl,
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
      for await (const entry of this.storage.list(storageRelativePath, {
        deep: false
      })) {
        if (entry.isDirectory && !this.isExcluded(entry)) {
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

  async uploadFiles(files: Multer.File[]): Promise<IItemFile[]> {
    const dirPath = await this.getPath();
    const root = await this.getRoot();
    const output: IItemFile[] = [];

    try {
      for (const uploadedFile of files) {
        // Make filename safe
        const fileName = makeSafeFilename(uploadedFile.originalname);
        let targetPath = path.join(dirPath, fileName);

        // Handle file name conflicts based on strategy
        if (
          await this.storage.fileExists(path.relative(root, targetPath), {})
        ) {
          const strategy =
            this.config.params.saveSameFileNameStrategy || 'addNumber';

          switch (strategy) {
            case 'error':
              throw Boom.badRequest(`File ${fileName} already exists`);

            case 'replace':
              // Keep the same name, will overwrite
              break;

            case 'addNumber':
            default: {
              const ext = this.getExtension(fileName);
              const baseName = path.basename(fileName, '.' + ext);
              let counter = 1;

              do {
                const newFileName = `${baseName}-${counter}.${ext}`;
                targetPath = path.join(dirPath, newFileName);
                counter++;
              } while (
                await this.storage.fileExists(
                  path.relative(root, targetPath),
                  {}
                )
              );
              break;
            }
          }
        }

        await this.storage.write(
          path.relative(root, targetPath),
          Readable.from(fs.readFileSync(uploadedFile.path)),
          {}
        );

        try {
          const stat = await this.storage.stat(
            path.relative(root, targetPath),
            {}
          );

          if (!stat.isFile) {
            throw Boom.badRequest('It is not a file!');
          }

          // Check if file is safe
          if (!this.isSafeFile(stat)) {
            await this.storage.deleteFile(path.relative(root, targetPath), {});
            throw Boom.forbidden('File type is not in white list');
          }

          // Check file size
          const maxSize = this.config.params.maxUploadFileSize;
          if (maxSize && (stat.size ?? 0) > (bytes(maxSize) ?? 0)) {
            await this.storage.deleteFile(path.relative(root, targetPath), {});
            throw Boom.forbidden('File size exceeds the allowable');
          }

          // Check permissions with extension
          await this.config.access.checkPermission(
            await this.config.getUserRole(),
            'FILE_UPLOAD',
            root,
            this.getExtension(targetPath)
          );

          output.push({
            stat,
            name: path.basename(targetPath),
            size: stat.size || 0,
            mtime: stat.lastModifiedMs || 0,
            extension: this.getExtension(targetPath),
            isImage: this.isImage(stat)
          });
        } catch (e) {
          await this.storage.deleteFile(path.relative(root, targetPath), {});
          throw e;
        }
      }
    } catch (e) {
      // Cleanup all uploaded files on error
      for (const file of output) {
        await this.storage.deleteFile(file.stat.path, {});
      }
      throw e;
    }

    return output;
  }

  async uploadFileFromUrl(
    url: string,
    relativePath?: string
  ): Promise<{
    baseurl: string;
    newfilename: string;
    isImage: boolean;
  }> {
    const dirPath = await this.getPath(relativePath);
    const root = await this.getRoot();

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FILE_UPLOAD',
      dirPath
    );

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw Boom.badRequest('Invalid URL');
    }

    // Extract filename from URL
    const urlPath = parsedUrl.pathname;
    const fileName = path.basename(urlPath) || 'downloaded-file';
    const safeFileName = makeSafeFilename(fileName);

    if (!safeFileName) {
      throw Boom.badRequest('Cannot extract valid filename from URL');
    }

    // Download file
    let fileContent: Buffer;
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw Boom.badRequest(`File was not loaded: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      fileContent = Buffer.from(arrayBuffer);
    } catch (err) {
      if (Boom.isBoom(err)) {
        throw err;
      }
      throw Boom.badRequest(`File was not loaded: ${(err as Error).message}`);
    }

    // Determine target path
    let targetPath = path.join(dirPath, safeFileName);
    let targetRelative = targetPath.replace(root, '').replace(/^\//, '');

    // Handle file name conflicts based on strategy
    if (await this.storage.fileExists(targetRelative, {}).catch(() => false)) {
      const strategy =
        this.config.params.saveSameFileNameStrategy || 'addNumber';

      switch (strategy) {
        case 'error':
          throw Boom.badRequest(`File ${safeFileName} already exists`);

        case 'replace':
          // Keep the same name, will overwrite
          break;

        case 'addNumber':
        default: {
          const ext = this.getExtension(safeFileName);
          const baseName = path.basename(safeFileName, '.' + ext);
          let counter = 1;

          do {
            const newFileName = ext
              ? `${baseName}-${counter}.${ext}`
              : `${baseName}-${counter}`;
            targetPath = path.join(dirPath, newFileName);
            targetRelative = targetPath.replace(root, '').replace(/^\//, '');
            counter++;
          } while (
            await this.storage.fileExists(targetRelative, {}).catch(() => false)
          );
          break;
        }
      }
    }

    // Write file to storage
    await this.storage.write(targetRelative, Readable.from(fileContent), {});

    try {
      const stats = await this.storage.stat(targetRelative, {});

      // Check if file is safe
      if (!this.isSafeFile(stats)) {
        await this.storage.deleteFile(targetRelative, {});
        throw Boom.forbidden('File type is not in white list');
      }

      // Check file size
      const maxSize = this.config.params.maxUploadFileSize;
      if (maxSize && (stats.size ?? 0) > (bytes(maxSize) ?? 0)) {
        await this.storage.deleteFile(targetRelative, {});
        throw Boom.forbidden('File size exceeds the allowable');
      }

      // Check permissions with extension
      await this.config.access.checkPermission(
        await this.config.getUserRole(),
        'FILE_UPLOAD',
        root,
        this.getExtension(targetPath)
      );

      // Return result
      return {
        baseurl: this.sourceConfig.baseurl,
        newfilename: path.basename(targetPath),
        isImage: this.isImage(stats)
      };
    } catch (e) {
      // Remove file on any error during validation
      await this.storage.deleteFile(targetRelative, {}).catch(() => {});
      throw e;
    }
  }

  async makeFolder(name: string, relativePath?: string): Promise<void> {
    const folderName = makeSafeFilename(name);

    if (!folderName) {
      throw Boom.badRequest('Folder name is required');
    }

    const root = await this.getRoot();
    const parentPath = path.join(root, relativePath ?? './');
    const parentRelative =
      parentPath.replace(root, '').replace(/^\//, '') || '/';

    // Check if parent directory exists
    try {
      const parentStats = await this.storage.stat(parentRelative, {});
      if (!parentStats.isDirectory) {
        throw Boom.notFound('Directory not found');
      }
    } catch {
      throw Boom.notFound('Directory not found');
    }

    const dirPath = await this.getPath(relativePath);
    const folderPath = path.join(dirPath, folderName);
    const folderRelative = folderPath.replace(root, '').replace(/^\//, '');

    // Check permissions
    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FOLDER_CREATE',
      folderPath
    );

    // Check if folder already exists
    if (
      await this.storage.directoryExists(folderRelative, {}).catch(() => false)
    ) {
      throw Boom.badRequest('Directory already exists');
    }

    // Create folder using storage adapter
    await this.storage.createDirectory(folderRelative, {});
  }

  async folderRemove(name: string, relativePath?: string): Promise<void> {
    const dirPath = await this.getPath(relativePath);
    const root = await this.getRoot();

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FOLDER_REMOVE',
      dirPath
    );

    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, name));
      if (rp.startsWith(root)) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath) {
      throw Boom.notFound('Directory not exists');
    }

    // Convert to relative path for storage
    const folderRelative = resolvedPath.replace(root, '').replace(/^\//, '');

    try {
      const stats = await this.storage.stat(folderRelative, {});

      if (!stats.isDirectory) {
        throw Boom.badRequest('It is not a directory!');
      }

      // Delete thumbs directory if it exists
      const thumbDir = path.join(
        folderRelative,
        this.config.params.thumbFolderName
      );
      if (await this.storage.directoryExists(thumbDir, {}).catch(() => false)) {
        await this.storage.deleteDirectory(thumbDir, {});
      }

      // Delete the directory using storage adapter
      await this.storage.deleteDirectory(folderRelative, {});
    } catch (err) {
      if (Boom.isBoom(err)) {
        throw err;
      }
      throw Boom.notFound('Directory not exists');
    }
  }

  async resolveFileByUrl(url: string): Promise<{ path: string; name: string; source: string; messages: string[]; code: number } | null> {
    const base = new URL(this.sourceConfig.baseurl);
    const parts = new URL(url);

    const pathname = base.pathname
      ? parts.pathname.replace(
          new RegExp(
            '^(/)?' + base.pathname.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
          ),
          ''
        )
      : '';

    const root = await this.getPath();
    const filePathRelative = pathname.replace(/^\//, '');

    try {
      const stats = await this.storage.stat(filePathRelative, {});

      if (stats.isFile && this.isSafeFile(stats)) {
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
          source: this.sourceConfig.name,
          messages: [],
          code: 0
        };
      }
    } catch {
      // File doesn't exist or error occurred
    }

    return null;
  }

  async cropImage(
    name: string,
    box: { x: number; y: number; w: number; h: number },
    newName?: string,
    relativePath?: string
  ): Promise<void> {
    const dirPath = await this.getPath(relativePath);
    const root = await this.getRoot();

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'IMAGE_CROP',
      dirPath
    );

    // Resolve the source file path
    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, name));
      if (rp.startsWith(root)) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath) {
      throw Boom.notFound('File not exists');
    }

    // Convert to relative path for storage
    const sourceRelative = resolvedPath.replace(root, '').replace(/^\//, '');

    // Check if file exists and is a file
    try {
      const stats = await this.storage.stat(sourceRelative, {});
      if (!stats.isFile) {
        throw Boom.badRequest('It is not a file!');
      }
    } catch {
      throw Boom.notFound('File not exists');
    }

    // Determine the destination path
    let destinationPath = resolvedPath;
    if (newName) {
      // Make filename safe
      newName = makeSafeFilename(newName);

      // Preserve extension from original file
      const ext = path.extname(name);
      const newExt = path.extname(newName);
      if (newExt !== ext) {
        newName += ext;
      }

      destinationPath = path.join(dirPath, newName);

      // Check permissions for the new file
      await this.config.access.checkPermission(
        await this.config.getUserRole(),
        'IMAGE_CROP',
        destinationPath
      );
    }

    const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

    // Crop the image
    try {
      // Read the source image as buffer
      const sourceBuffer = await this.storage.readToBuffer(sourceRelative, {});

      // Crop using sharp
      const croppedBuffer = await sharp(sourceBuffer)
        .extract({
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h
        })
        .toBuffer();

      // If cropping in place, write to temp file first
      if (destinationPath === resolvedPath) {
        const tmpRelative = sourceRelative + '.tmp';

        // Write to temp file
        await this.storage.write(tmpRelative, Readable.from(croppedBuffer), {});

        // Delete original
        await this.storage.deleteFile(sourceRelative, {});

        // Rename temp to original
        await this.storage.moveFile(tmpRelative, sourceRelative, {});
      } else {
        // Write directly to destination
        await this.storage.write(destRelative, Readable.from(croppedBuffer), {});
      }
    } catch (err) {
      throw Boom.badRequest(`Unable to crop image: ${(err as Error).message}`);
    }
  }

  async resizeImage(
    name: string,
    box: { w: number; h: number },
    newName?: string,
    relativePath?: string
  ): Promise<void> {
    const dirPath = await this.getPath(relativePath);
    const root = await this.getRoot();

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'IMAGE_RESIZE',
      dirPath
    );

    // Resolve the source file path
    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, name));
      if (rp.startsWith(root)) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath) {
      throw Boom.notFound('File not exists');
    }

    // Convert to relative path for storage
    const sourceRelative = resolvedPath.replace(root, '').replace(/^\//, '');

    // Check if file exists and is a file
    try {
      const stats = await this.storage.stat(sourceRelative, {});
      if (!stats.isFile) {
        throw Boom.badRequest('It is not a file!');
      }
    } catch {
      throw Boom.notFound('File not exists');
    }

    // Determine the destination path
    let destinationPath = resolvedPath;
    if (newName) {
      // Make filename safe
      newName = makeSafeFilename(newName);

      // Preserve extension from original file
      const ext = path.extname(name);
      const newExt = path.extname(newName);
      if (newExt !== ext) {
        newName += ext;
      }

      destinationPath = path.join(dirPath, newName);

      // Check permissions for the new file
      await this.config.access.checkPermission(
        await this.config.getUserRole(),
        'IMAGE_RESIZE',
        destinationPath
      );
    }

    const destRelative = destinationPath.replace(root, '').replace(/^\//, '');

    // Resize the image
    try {
      // Read the source image as buffer
      const sourceBuffer = await this.storage.readToBuffer(sourceRelative, {});

      // Resize using sharp
      const resizedBuffer = await sharp(sourceBuffer)
        .resize(box.w, box.h, {
          fit: 'fill'
        })
        .toBuffer();

      // If resizing in place, write to temp file first
      if (destinationPath === resolvedPath) {
        const tmpRelative = sourceRelative + '.tmp';

        // Write to temp file
        await this.storage.write(tmpRelative, Readable.from(resizedBuffer), {});

        // Delete original
        await this.storage.deleteFile(sourceRelative, {});

        // Rename temp to original
        await this.storage.moveFile(tmpRelative, sourceRelative, {});
      } else {
        // Write directly to destination
        await this.storage.write(destRelative, Readable.from(resizedBuffer), {});
      }
    } catch (err) {
      throw Boom.badRequest(`Unable to resize image: ${(err as Error).message}`);
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
