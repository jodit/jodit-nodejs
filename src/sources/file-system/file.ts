import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { Response } from 'express';
import { ISource } from '../../types/abstract-file-system';

export interface IFileSync {
  isGoodFile: boolean;
  isSafeFile: boolean;
  isDirectory: boolean;
  isImage: boolean;
  isSVGImage: boolean;
  getBasename: string;
  getExtension: string;
  getFolder: string;
  getName: string;
  getPath: string;
  getPathByRoot: string;
  getSize: number;
  getTime: number;
  file: IFile;
}

export interface IFile {
  isGoodFile(): Promise<boolean>;
  isSafeFile(): Promise<boolean>;
  isDirectory(): Promise<boolean>;
  remove(): Promise<boolean>;
  send(res?: Response): Promise<void>;
  getPath(): Promise<string>;
  getFolder(): Promise<string>;
  getName(): Promise<string>;
  getExtension(): Promise<string>;
  getBasename(): Promise<string>;
  getSize(): Promise<number>;
  getTime(): Promise<number>;
  getPathByRoot(): Promise<string>;
  isImage(): Promise<boolean>;
  isSVGImage(): Promise<boolean>;
  sync(): Promise<IFileSync>;
}

export class File implements IFile {
  private constructor(
    private readonly absPath: string,
    private readonly source: ISource
  ) {}

  static async create(filePath: string, source: ISource): Promise<File> {
    try {
      const real = await fs.realpath(filePath);
      return new File(real, source);
    } catch {
      throw new Error(`File not exists: ${filePath}`);
    }
  }

  async getPath(): Promise<string> {
    return this.absPath.split('\\').join(path.sep);
  }

  async getFolder(): Promise<string> {
    return path.dirname(await this.getPath()) + path.sep;
  }

  async getName(): Promise<string> {
    return path.basename(await this.getPath());
  }

  async getExtension(): Promise<string> {
    const name = await this.getName();
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  async getBasename(): Promise<string> {
    const parts = (await this.getName()).split('.');
    parts.pop();
    return parts.join('.');
  }

  async getSize(): Promise<number> {
    const stats = await fs.stat(this.absPath);
    return stats.size;
  }

  async getTime(): Promise<number> {
    const stats = await fs.stat(this.absPath);
    return stats.mtimeMs;
  }

  async isDirectory(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.absPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async remove(): Promise<boolean> {
    try {
      await fs.unlink(this.absPath);
      return true;
    } catch {
      return false;
    }
  }

  async send(res?: Response): Promise<void> {
    if (!res) throw new Error('send() requires an Express Response');
    const name = await this.getName();
    const size = await this.getSize();

    res.setHeader('Content-Description', 'File Transfer');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Transfer-Encoding', 'binary');
    res.setHeader('Expires', '0');
    res.setHeader(
      'Cache-Control',
      'must-revalidate, post-check=0, pre-check=0'
    );
    res.setHeader('Pragma', 'public');
    res.setHeader('Content-Length', String(size));

    const stream = fssync.createReadStream(this.absPath);
    stream.pipe(res);
  }

  async isGoodFile(): Promise<boolean> {
    if (!this.source) return true;
    const ext = await this.getExtension();
    return !!ext && this.source.config.params.extensions.includes(ext);
  }

  async isSafeFile(): Promise<boolean> {
    if (!this.source) return true;

    const ext = await this.getExtension();

    if (!(await this.isGoodFile())) return false;

    if (
      this.source.config.params.imageExtensions.includes(ext) &&
      !(await this.isImage())
    ) {
      return false;
    }

    return true;
  }

  async getPathByRoot(): Promise<string> {
    if (!this.source) return this.absPath;
    const normalized = await this.getPath();
    const root = await this.source.getPath();
    return normalized.replace(root, '');
  }

  async isImage(): Promise<boolean> {
    if (await this.isSVGImage()) return true;

    const ext = await this.getExtension();
    return this.source.config.params.imageExtensions.includes(ext);
  }

  async isSVGImage(): Promise<boolean> {
    const ext = await this.getExtension();
    return ext === 'svg';
  }

  async sync(): Promise<IFileSync> {
    const [
      isGoodFile,
      isSafeFile,
      isDirectory,
      isImage,
      isSVGImage,
      getBasename,
      getExtension,
      getFolder,
      getName,
      getPath,
      getPathByRoot,
      getSize,
      getTime
    ] = await Promise.all([
      this.isGoodFile(),
      this.isSafeFile(),
      this.isDirectory(),
      this.isImage(),
      this.isSVGImage(),
      this.getBasename(),
      this.getExtension(),
      this.getFolder(),
      this.getName(),
      this.getPath(),
      this.getPathByRoot(),
      this.getSize(),
      this.getTime()
    ]);
    return {
      isGoodFile,
      isSafeFile,
      isDirectory,
      isImage,
      isSVGImage,
      getBasename,
      getExtension,
      getFolder,
      getName,
      getPath,
      getPathByRoot,
      getSize,
      getTime,
      file: this
    };
  }
}
