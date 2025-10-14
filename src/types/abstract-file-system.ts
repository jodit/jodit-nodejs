import { SourceConfig } from '.';
import type { Config } from '../config/config';

export interface IResolveFile {
  readonly path: string;
  readonly name: string;
  readonly source: string;
  readonly messages: string[];
  readonly code: number;
}

export interface TreeNode {
  name: string;
  path: string;
  sourceName: string;
  children: TreeNode[];
}

export interface ISourceFile {
  readonly file: string;
  readonly name: string;
  readonly type: string;
  readonly thumb?: string | undefined;
  readonly changed?: false | string;
  readonly size?: string | null;
  readonly isImage?: boolean;
}

export interface ISourceFolders {
  readonly baseurl: string;
  readonly path: string;
  readonly name: string;
  readonly title: string;
  readonly folders: string[];
}

export interface ISourceItem {
  readonly name: string;
  readonly title?: string | undefined;
  readonly baseurl: string;
  readonly path: string;
  readonly files: ISourceFile[];
}

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
  send(): Promise<void>; // TODO WHY

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

/**
 * Interface ISource
 */
export interface ISource {
  name: string;

  sourceConfig: SourceConfig;
  config: Config;

  items(
    relativePath: string,
    options: {
      withFolders: boolean;
      onlyImages: boolean;
      offset: number;
      limit: number;
      sortBy: string;
      foldersPosition: 'default' | 'top' | 'bottom';
    }
  ): Promise<ISourceItem>;

  folders(options: { dots: boolean }): Promise<ISourceFolders>;

  makeFolder(path: string): Promise<void>;

  makeThumb(
    file: IFile,
    counter: {
      countThumbs: number;
    }
  ): Promise<IFile>;

  isExcluded(file: string): Promise<boolean>;

  movePath(fromName: string): Promise<void>;

  renamePath(fromName: string, newName: string): Promise<void>;

  fileRemove(target: string): Promise<void>;

  fileDownload(target: string): Promise<void>;

  folderRemove(name: string): Promise<void>;

  resolveFileByUrl(url: string): Promise<IResolveFile | null>;

  makeFile(path: string, content?: string | null): Promise<IFile>;

  getPath(): Promise<string>;
  getRoot(): Promise<string>;
}
