import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import slugify from 'slugify';
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
} from '../../types/abstract-file-system';
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
  async movePath(from: string): Promise<void> {
    const destinationPath = await this.getPath();
    const sourcePath = await this.getPath(from);

    if (!sourcePath) {
      throw new Error('Need source path');
    }
    if (!destinationPath) {
      throw new Error('Need destination path');
    }

    const action = !(await this.isDirectory(sourcePath))
      ? 'FILE_MOVE'
      : 'FOLDER_MOVE';

    // Проверки доступа, как в PHP
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

    if (fs.existsSync(sourcePath)) {
      const target = path.join(destinationPath, path.basename(sourcePath));

      try {
        fs.renameSync(sourcePath, target);
      } catch (err) {
        throw new Error(`Unable to move: ${(err as Error).message}`);
      }
    } else {
      throw new Error('Not file or folder');
    }
  }

  async fileRemove(target: string): Promise<void> {
    const dirPath = await this.getPath();

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      'FILE_REMOVE',
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
      throw new Error(
        `File or directory not exists ${path.join(dirPath, target)}`
      );
    }

    const stats = fs.statSync(resolvedPath);

    if (stats.isFile()) {
      const file = await this.makeFile(resolvedPath);
      if (!(await file.remove())) {
        throw new Error(`Delete failed! File is not writable.`);
      }
    } else {
      throw new Error(`It is not a file!`);
    }
  }

  async fileDownload(target: string): Promise<void> {
    const dirPath = await this.getPath();

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
      throw new Error(
        `File or directory not exists ${path.join(dirPath, target)}`
      );
    }

    const stats = fs.statSync(resolvedPath);

    if (stats.isFile()) {
      const file = await this.makeFile(resolvedPath);
      if (!file.send()) {
        throw new Error(`Download failed! File is not writable.`);
      }
    } else {
      throw new Error(`It is not a file!`);
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

  async folderRemove(name: string): Promise<void> {
    const dirPath = await this.getPath();

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
        throw new Error(`It is not a directory!`);
      }
    } else {
      throw new Error(`Directory not exists`);
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

  makeFile(path: string, content: string | null = null): Promise<IFile> {
    if (content !== null) {
      fs.writeFileSync(path, content, 'utf8');
    }

    return File.create(path, this);
  }

  async makeFolder(path: string): Promise<void> {
    fs.mkdirSync(path, {
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
      await this.makeFolder(
        path.join(pathname, this.config.params.thumbFolderName)
      );
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

  async isExcluded(file: string): Promise<boolean> {
    return (
      file === '.' ||
      file === '..' ||
      (this.config.params.createThumb &&
        file === this.config.params.thumbFolderName) ||
      this.config.params.excludeDirectoryNames.includes(file)
    );
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

  async renamePath(fromName: string, newName: string): Promise<void> {
    fromName = makeSafeFilename(fromName);
    const fromPath = path.join(await this.getRoot(), fromName);

    const isFile = fs.existsSync(fromPath) && fs.statSync(fromPath).isFile();
    const action = isFile ? 'FILE_RENAME' : 'FOLDER_RENAME';

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      fromPath
    );

    newName = makeSafeFilename(newName);
    let destinationPath = path.join(await this.getRoot(), newName);

    await this.config.access.checkPermission(
      await this.config.getUserRole(),
      action,
      destinationPath
    );

    if (!fromPath) {
      throw new Error('Need source path');
    }
    if (!destinationPath) {
      throw new Error('Need destination path');
    }
    if (!fs.existsSync(fromPath)) {
      throw new Error('Path not exists');
    }

    if (isFile) {
      const ext = path.extname(fromPath).toLowerCase();
      const newExt = path.extname(destinationPath).toLowerCase();
      if (newExt !== ext) {
        destinationPath += ext;
      }
    }

    if (fs.existsSync(destinationPath)) {
      throw new Error(`New ${path.basename(destinationPath)} already exists`);
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
        return {
          path:
            path.dirname(path.join(root, pathname)).replace(root, '') +
            path.sep,
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
