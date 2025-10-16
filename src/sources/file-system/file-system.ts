import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import slugify from 'slugify';
// Express is a global namespace from @types/express
/* global Express */
import { File } from './file';
import type {
  IFile,
  IFileSync,
  IResolveFile,
  ISource,
  ISourceFile,
  ISourceFolders,
  ISourceItem
  //   TreeNode
} from '../../types/rest-api';
import { BaseSource } from '../../helpers/base-source';
import { Image } from '../../helpers/image';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import dayjs from 'dayjs';
import { makeSafeFilename } from '../../helpers/file-upload';

/**
 * Class FileSystem
 */
export class FileSystem extends BaseSource implements ISource {
  async movePath(from: string, toPath?: string): Promise<void> {
    const root = await this.getRoot();
    const sourcePath = path.join(root, from);

    // Check if destination path exists before calling getPath
    if (toPath) {
      const destPathFull = path.join(root, toPath);
      if (!fs.existsSync(destPathFull) || !fs.lstatSync(destPathFull).isDirectory()) {
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

    if (!fs.existsSync(sourcePath)) {
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

    // Check if target already exists
    if (fs.existsSync(target)) {
      if (isFolder) {
        throw Boom.badRequest('Folder with same name already exists in destination');
      }
      throw Boom.badRequest('File with same name already exists in destination');
    }

    try {
      fs.renameSync(sourcePath, target);
    } catch (err) {
      throw Boom.badRequest(`Unable to move: ${(err as Error).message}`);
    }
  }

  async fileRemove(target: string, relativePath?: string): Promise<void> {
    const dirPath = await this.getPath(relativePath);

    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, target));
      if (rp.startsWith(await this.getRoot())) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw Boom.notFound(
        `File or directory not exists ${path.join(dirPath, target)}`
      );
    }

    const stats = fs.statSync(resolvedPath);

    if (stats.isFile()) {
      const file = await this.makeFile(resolvedPath);

      // Check permissions with file extension
      await this.config.access.checkPermission(
        await this.config.getUserRole(),
        'FILE_REMOVE',
        dirPath,
        await file.getExtension()
      );

      if (!(await file.remove())) {
        throw Boom.badRequest(`Delete failed! File is not writable.`);
      }
    } else {
      throw Boom.badRequest(`It is not a file!`);
    }
  }

  async fileDownload(target: string, relativePath?: string): Promise<IFile> {
    const dirPath = await this.getPath(relativePath);

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FILE_DOWNLOAD',
      dirPath
    );

    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, target));
      if (rp.startsWith(await this.getRoot())) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw Boom.notFound('File or directory not exists');
    }

    const stats = fs.statSync(resolvedPath);

    if (stats.isFile()) {
      const file = await this.makeFile(resolvedPath);
      return file;
    } else {
      throw Boom.badRequest('It is not a file!');
    }
  }

  private removeDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;
    for (const file of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.removeDirectory(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dirPath);
  }

  async folderRemove(name: string, relativePath?: string): Promise<void> {
    const dirPath = await this.getPath(relativePath);

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FOLDER_REMOVE',
      dirPath
    );

    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, name));
      if (rp.startsWith(await this.getRoot())) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (resolvedPath && fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);

      if (stat.isDirectory()) {
        const thumbDir = path.join(
          resolvedPath,
          this.config.params.thumbFolderName
        );

        if (fs.existsSync(thumbDir)) {
          this.removeDirectory(thumbDir);
        }

        this.removeDirectory(resolvedPath);
      } else {
        throw Boom.badRequest(`It is not a directory!`);
      }
    } else {
      throw Boom.notFound(`Directory not exists`);
    }
  }

  async realpath(pathname: string): Promise<string> {
    try {
      return await fs.promises.realpath(pathname);
    } catch {
      throw Boom.notFound('Path does not exist');
    }
  }

  async isDirectory(pathname: string): Promise<boolean> {
    return fs.existsSync(pathname) && fs.lstatSync(pathname).isDirectory();
  }

  makeFile(path: string, content: string | null = null): IFile {
    if (content !== null) {
      fs.writeFileSync(path, content, 'utf8');
    }

    return File.create(path);
  }

  async makeFolder(name: string, relativePath?: string): Promise<void> {
    const folderName = makeSafeFilename(name);

    if (!folderName) {
      throw Boom.badRequest('Folder name is required');
    }

    // Check if parent directory exists before calling getPath
    const root = await this.getRoot();
    const parentPath = path.join(root, relativePath ?? './');

    if (!fs.existsSync(parentPath) || !fs.lstatSync(parentPath).isDirectory()) {
      throw Boom.notFound('Directory not found');
    }

    const dirPath = await this.getPath(relativePath);
    const folderPath = path.join(dirPath, folderName);

    // Check permissions
    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FOLDER_CREATE',
      folderPath
    );

    // Check if folder already exists
    if (fs.existsSync(folderPath)) {
      throw Boom.badRequest('Directory already exists');
    }

    // Create folder
    fs.mkdirSync(folderPath, {
      mode: this.config.params.defaultPermission
    });
  }

  async makeThumb(
    file: IFile,
    counter: { countThumbs: number } = { countThumbs: 0 }
  ): Promise<IFile> {
    const pathname = await file.getFolder();

    if (
      !(await this.isDirectory(
        path.join(pathname, this.config.params.thumbFolderName)
      ))
    ) {
      // Create thumb folder directly without permission checks (internal operation)
      fs.mkdirSync(path.join(pathname, this.config.params.thumbFolderName), {
        mode: this.config.params.defaultPermission
      });
    }

    let thumbName = path.join(
      pathname,
      this.config.params.thumbFolderName,
      slugify(await file.getBasename()) + '.' + (await file.getExtension())
    );

    if (!(await file.isDirectory()) && fs.existsSync(thumbName)) {
      return this.makeFile(thumbName);
    }

    if (!(await file.isImage())) {
      thumbName = path.join(
        pathname,
        this.config.params.thumbFolderName,
        slugify(await file.getName()) + '.svg'
      );
    }

    if (!fs.existsSync(thumbName)) {
      if (await file.isSVGImage()) {
        return file;
      }

      counter.countThumbs++;

      if (await file.isImage()) {
        try {
          await sharp(await file.getPath())
            .resize(
              this.config.params.thumbSize,
              this.config.params.thumbSize,
              {
                fit: 'inside',
                withoutEnlargement: true
              }
            )
            .jpeg({ quality: this.config.params.quality })
            .toFile(thumbName);
        } catch {
          return file;
        }
      } else {
        await Image.generateIcon(file, thumbName, this);
      }
    }

    return this.makeFile(thumbName);
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
    const pathname = await this.getPath(relativePath);
    const root = await this.getRoot();

    let relativeCalcPath = pathname.replace(root, '');

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

    const list = await filter(
      fs.readdirSync(pathname),
      async file => !(await this.isExcluded(file))
    );

    const files = await this.filterFiles(pathname, list, options).then(
      results =>
        Promise.all(
          results.slice(offset, offset + limit).map(file => file.sync())
        )
    );

    this.sortByMode(files, sortBy, options);

    const counter = { countThumbs: 0 };

    for (const file of files) {
      let item: ISourceFile;

      if (!file.isDirectory) {
        item = {
          file: file.getPath.replace(pathname + path.sep, ''),
          name: file.getName,
          type: file.isImage ? 'image' : 'file',
          isImage: file.isImage,
          size: bytes.format(file.getSize),
          changed: dayjs(file.getTime).format(
            this.config.params.datetimeFormat
          ),
          thumb:
            counter.countThumbs <=
              this.config.params.safeThumbsCountInOneTime &&
            (this.config.params.createThumb || !file.isImage)
              ? (
                  await (await this.makeThumb(file.file, counter)).getPath()
                ).replace(pathname + path.sep, '')
              : undefined
        };
      } else {
        item = {
          file: file.getPath.replace(pathname + path.sep, ''),
          name: file.getName,
          type: 'folder',
          thumb: (await (await this.makeThumb(file.file)).getPath()).replace(
            pathname + path.sep,
            ''
          )
        };
      }
      sourceData.files.push(item);
    }

    return sourceData;
  }

  async folders(
    relativePath: string,
    options: { dots?: boolean | undefined }
  ): Promise<ISourceFolders> {
    const pathname = await this.getPath(relativePath);

    const sourceData: ISourceFolders = {
      name: this.name,
      title: this.sourceConfig.title ?? this.sourceConfig.name,
      baseurl: this.sourceConfig.baseurl,
      path: pathname.replace(await this.getRoot(), ''),
      folders: []
    };

    if (options.dots !== false) {
      sourceData.folders.push(pathname === (await this.getRoot()) ? '.' : '..');
    }

    const dir = fs.opendirSync(pathname);
    let dirent;

    while ((dirent = dir.readSync()) !== null) {
      if (dirent.isDirectory() && !(await this.isExcluded(dirent.name))) {
        sourceData.folders.push(dirent.name);
      }
    }

    dir.closeSync();

    return sourceData;
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<IFile[]> {
    const dirPath = await this.getPath();
    const root = await this.getRoot();
    const output: IFile[] = [];

    try {
      for (const uploadedFile of files) {
        // Make filename safe
        const fileName = makeSafeFilename(uploadedFile.originalname);
        let targetPath = path.join(dirPath, fileName);

        // Handle file name conflicts based on strategy
        if (fs.existsSync(targetPath)) {
          const strategy = this.config.params.saveSameFileNameStrategy || 'addNumber';

          switch (strategy) {
            case 'error':
              throw Boom.badRequest(`File ${fileName} already exists`);

            case 'replace':
              // Keep the same name, will overwrite
              break;

            case 'addNumber':
            default: {
              const ext = path.extname(fileName);
              const baseName = path.basename(fileName, ext);
              let counter = 1;

              do {
                const newFileName = `${baseName}-${counter}${ext}`;
                targetPath = path.join(dirPath, newFileName);
                counter++;
              } while (fs.existsSync(targetPath));
              break;
            }
          }
        }

        // Move uploaded file to target location
        fs.renameSync(uploadedFile.path, targetPath);

        // Create File object
        const file = await this.makeFile(targetPath);

        try {
          // Check if file is safe
          if (!(await file.isSafeFile())) {
            await file.remove();
            throw Boom.forbidden('File type is not in white list');
          }

          // Check file size
          const maxSize = this.config.params.maxUploadFileSize;
          if (maxSize && (await file.getSize()) > this.parseFileSize(maxSize)) {
            await file.remove();
            throw Boom.forbidden('File size exceeds the allowable');
          }

          // Check permissions with extension
          await this.config.access.checkPermission(
            await this.config.getUserRole(),
            'FILE_UPLOAD',
            root,
            await file.getExtension()
          );

          output.push(file);
        } catch (e) {
          // Remove file on any error during validation
          await file.remove();
          throw e;
        }
      }
    } catch (e) {
      // Cleanup all uploaded files on error
      for (const file of output) {
        await file.remove();
      }
      throw e;
    }

    return output;
  }

  async cropImage(
    name: string,
    box: { x: number; y: number; w: number; h: number },
    newName?: string,
    relativePath?: string
  ): Promise<void> {
    const dirPath = await this.getPath(relativePath);

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'IMAGE_CROP',
      dirPath
    );

    // Resolve the source file path
    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, name));
      if (rp.startsWith(await this.getRoot())) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw Boom.notFound('File not exists');
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw Boom.badRequest('It is not a file!');
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

    // Crop the image
    try {
      await sharp(resolvedPath)
        .extract({
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h
        })
        .toFile(destinationPath === resolvedPath ? resolvedPath + '.tmp' : destinationPath);

      // If we cropped in place, replace the original with the tmp file
      if (destinationPath === resolvedPath) {
        fs.unlinkSync(resolvedPath);
        fs.renameSync(resolvedPath + '.tmp', resolvedPath);
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

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'IMAGE_RESIZE',
      dirPath
    );

    // Resolve the source file path
    let resolvedPath: string | false = false;
    try {
      const rp = await this.realpath(path.join(dirPath, name));
      if (rp.startsWith(await this.getRoot())) {
        resolvedPath = rp;
      }
    } catch {
      resolvedPath = false;
    }

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw Boom.notFound('File not exists');
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw Boom.badRequest('It is not a file!');
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

    // Resize the image
    try {
      await sharp(resolvedPath)
        .resize(box.w, box.h, {
          fit: 'fill'
        })
        .toFile(destinationPath === resolvedPath ? resolvedPath + '.tmp' : destinationPath);

      // If we resized in place, replace the original with the tmp file
      if (destinationPath === resolvedPath) {
        fs.unlinkSync(resolvedPath);
        fs.renameSync(resolvedPath + '.tmp', resolvedPath);
      }
    } catch (err) {
      throw Boom.badRequest(`Unable to resize image: ${(err as Error).message}`);
    }
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

    // Handle file name conflicts based on strategy
    if (fs.existsSync(targetPath)) {
      const strategy = this.config.params.saveSameFileNameStrategy || 'addNumber';

      switch (strategy) {
        case 'error':
          throw Boom.badRequest(`File ${safeFileName} already exists`);

        case 'replace':
          // Keep the same name, will overwrite
          break;

        case 'addNumber':
        default: {
          const ext = path.extname(safeFileName);
          const baseName = path.basename(safeFileName, ext);
          let counter = 1;

          do {
            const newFileName = `${baseName}-${counter}${ext}`;
            targetPath = path.join(dirPath, newFileName);
            counter++;
          } while (fs.existsSync(targetPath));
          break;
        }
      }
    }

    // Write file to disk
    fs.writeFileSync(targetPath, fileContent);

    // Create File object and validate
    const file = await this.makeFile(targetPath);

    try {
      // Check if file is safe
      if (!(await file.isSafeFile())) {
        await file.remove();
        throw Boom.forbidden('File type is not in white list');
      }

      // Check file size
      const maxSize = this.config.params.maxUploadFileSize;
      if (maxSize && (await file.getSize()) > this.parseFileSize(maxSize)) {
        await file.remove();
        throw Boom.forbidden('File size exceeds the allowable');
      }

      // Check permissions with extension
      await this.config.access.checkPermission(
        await this.config.getUserRole(),
        'FILE_UPLOAD',
        await this.getRoot(),
        await file.getExtension()
      );

      // Return result
      return {
        baseurl: this.sourceConfig.baseurl,
        newfilename: path.basename(targetPath),
        isImage: await file.isImage()
      };
    } catch (e) {
      // Remove file on any error during validation
      await file.remove();
      throw e;
    }
  }

  private parseFileSize(sizeStr: string): number {
    if (typeof sizeStr === 'number') {
      return sizeStr;
    }

    const number = parseInt(sizeStr.slice(0, -2));
    const unit = sizeStr.slice(-2).toUpperCase();
    const units: Record<string, number> = {
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    return units[unit] ? number * units[unit] : parseInt(sizeStr);
  }

  //  async getTree(dirPath: string): TreeNode[] {
  //     const absPath = path.resolve(dirPath);
  //     const tree: TreeNode[] = [];

  //     await this.config.access.checkPermission(await this.config.getUserRole(), 'FOLDER_TREE', absPath);

  //     let dir;
  //     try {
  //       dir = fs.opendirSync(absPath);
  //     } catch {
  //       return [];
  //     }

  //     for (let dirent = dir.readSync(); dirent; dirent = dir.readSync()) {
  //       const filePath = path.join(absPath, dirent.name);

  //       if (dirent.isDirectory() && !await  this.isExcluded(dirent.name)) {
  //         tree.push({
  //           name: dirent.name,
  //           path: filePath,
  //           sourceName: this.sourceName,
  //           children: this.getTree(filePath)
  //         });
  //       }
  //     }

  //     dir.closeSync();
  //     return tree;
  //   }

  async renamePath(fromName: string, newName: string, relativePath?: string, expectType?: 'file' | 'folder'): Promise<void> {
    fromName = makeSafeFilename(fromName);
    const dirPath = await this.getPath(relativePath);
    const fromPath = path.join(dirPath, fromName);

    if (!fromPath) {
      throw Boom.badRequest('Need source path');
    }

    if (!fs.existsSync(fromPath)) {
      // Use context-specific error message based on expectType
      if (expectType === 'folder') {
        throw Boom.notFound('Folder or directory not exists');
      }
      throw Boom.notFound('Path not exists');
    }

    const isFile = fs.statSync(fromPath).isFile();
    const action = isFile ? 'FILE_RENAME' : 'FOLDER_RENAME';

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      fromPath
    );

    newName = makeSafeFilename(newName);
    let destinationPath = path.join(dirPath, newName);

    if (!destinationPath) {
      throw Boom.badRequest('Need destination path');
    }

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      destinationPath
    );

    if (isFile) {
      const ext = path.extname(fromPath).toLowerCase();
      const newExt = path.extname(destinationPath).toLowerCase();
      if (newExt !== ext) {
        destinationPath += ext;
      }
    }

    if (fs.existsSync(destinationPath)) {
      // Use different error messages for files and folders
      if (action === 'FOLDER_RENAME') {
        throw Boom.badRequest('Folder with new name already exists');
      }
      throw Boom.badRequest(`New ${path.basename(destinationPath)} already exists`);
    }

    fs.renameSync(fromPath, destinationPath);
  }

  async resolveFileByUrl(url: string): Promise<IResolveFile | null> {
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

    if (
      fs.existsSync(path.join(root, pathname)) &&
      fs.statSync(path.join(root, pathname)).isFile()
    ) {
      const file = await this.makeFile(path.join(root, pathname));

      if (await file.isSafeFile()) {
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
    }

    return null;
  }

  private async filterFiles(
    pathname: string,
    list: string[],
    options: { withFolders: boolean; onlyImages: boolean }
  ): Promise<IFile[]> {
    const result: IFile[] = [];

    const { withFolders, onlyImages } = options;

    const exts = this.config.params.imageExtensions;

    for (const fileName of list) {
      const file = await this.makeFile(path.join(pathname, fileName));

      if (
        ((await file.isDirectory()) && withFolders) ||
        ((await file.isGoodFile()) &&
          (!onlyImages || exts.includes(await file.getExtension())))
      ) {
        result.push(file);
      }
    }

    return result;
  }

  private sortByMode(
    files: IFileSync[],
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
        rsortFiles(files);
        break;

      case 'changed-desc':
      case 'changed-asc':
      case 'size-asc':
      case 'size-desc':
        usortFiles(files, function (fileA, fileB) {
          switch (sortBy) {
            case 'changed-desc':
            case 'changed-asc': {
              const a = fileA.getTime;
              const b = fileB.getTime;

              if (a === b) {
                const m = sortBy === 'changed-asc' ? 1 : -1;
                return fileA.getBasename > fileB.getBasename ? 1 * m : -1 * m;
              }

              return sortBy === 'changed-asc' ? a - b : b - a;
            }
            case 'size-desc':
            case 'size-asc': {
              const a = fileA.getSize;
              const b = fileB.getSize;

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
      usortFiles(files, (fileA, fileB) => {
        if (fileA.isDirectory && !fileB.isDirectory) {
          return foldersPosition === 'top' ? -1 : 1;
        }

        if (!fileA.isDirectory && fileB.isDirectory) {
          return foldersPosition === 'top' ? 1 : -1;
        }

        if (fileA.isDirectory && fileB.isDirectory) {
          return fileA > fileB ? 1 : -1;
        }

        return 0;
      });
    }
  }
}

async function filter<T>(
  items: T[],
  callback: (item: T) => Promise<boolean>
): Promise<T[]> {
  const results = await Promise.all(items.map(callback));
  return items.filter((_, index) => results?.[index] === true);
}

function sortFiles(files: IFileSync[], reverse: number = 1): void {
  files.sort((a, b) => {
    if (a.getBasename < b.getBasename) {
      return -1 * reverse;
    }
    if (a.getBasename > b.getBasename) {
      return 1 * reverse;
    }
    return 0;
  });
}

function rsortFiles(files: IFileSync[]): void {
  files.sort((a, b) => {
    if (a.getBasename > b.getBasename) {
      return -1;
    }
    if (a.getBasename < b.getBasename) {
      return 1;
    }
    return 0;
  });
}

function usortFiles(
  files: IFileSync[],
  callback: (a: IFileSync, b: IFileSync) => number
): void {
  files.sort(callback);
}
