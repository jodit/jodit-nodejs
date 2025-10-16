import fs from 'fs';
import path from 'path';
import type { IFile } from '../../types/rest-api';
// import { Response } from 'express';
// import { ISource } from '../../types/abstract-file-system';

export class File implements IFile {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;

  private constructor(filePath: string) {
    this.name = path.basename(filePath);
    this.path = filePath;
    this.isDirectory = fs.lstatSync(filePath).isDirectory();
  }

  static create(filePath: string): File {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return new File(path.resolve(filePath));
  }

  // async stat(): Promise<{
  //   size: number;
  //   modified: number;
  // }> {
  //   const stats = await fs.stat(this.absPath);
  //   return {
  //     size: stats.size,
  //     modified: stats.mtimeMs
  //   };
  // }

  // async remove(): Promise<boolean> {
  //   try {
  //     await fs.unlink(this.absPath);
  //     return true;
  //   } catch {
  //     return false;
  //   }
  // }

  // async send(res?: Response): Promise<void> {
  //   if (!res) throw new Error('send() requires an Express Response');
  //   const name = await this.getName();
  //   const size = await this.getSize();

  //   res.setHeader('Content-Description', 'File Transfer');
  //   res.setHeader('Content-Type', 'application/octet-stream');
  //   res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  //   res.setHeader('Content-Transfer-Encoding', 'binary');
  //   res.setHeader('Expires', '0');
  //   res.setHeader(
  //     'Cache-Control',
  //     'must-revalidate, post-check=0, pre-check=0'
  //   );
  //   res.setHeader('Pragma', 'public');
  //   res.setHeader('Content-Length', String(size));

  //   const stream = fssync.createReadStream(this.absPath);
  //   stream.pipe(res);
  // }

  // async getPathByRoot(): Promise<string> {
  //   const normalized = await this.getPath();
  //   const root = await this.source.getPath();
  //   return normalized.replace(root + path.sep, '');
  // }
}
