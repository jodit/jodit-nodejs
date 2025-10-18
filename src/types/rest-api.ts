import type { StatEntry } from '@flystorage/file-storage';

export interface IResolveFile {
  readonly path: string;
  readonly name: string;
  readonly source: string;
  readonly messages: string[];
  readonly code: number;
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

export interface IItemFile {
  stat: StatEntry;
  name: string;
  size: number;
  mtime: number;
  extension: string;
  isImage: boolean;
}
