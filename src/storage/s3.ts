import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import mime from 'mime-types';
import type {
  ChecksumOptions,
  CopyFileOptions,
  CreateDirectoryOptions,
  FileContents,
  MimeTypeOptions,
  MiscellaneousOptions,
  MoveFileOptions,
  PublicUrlOptions,
  StatEntry,
  StorageAdapter,
  TemporaryUrlOptions,
  WriteOptions
} from '@flystorage/file-storage';

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | undefined;
}

/**
 * Options of the built-in S3 storage adapter.
 *
 * Works with AWS S3 and any S3-compatible service (MinIO, Cloudflare R2,
 * Yandex Object Storage, DigitalOcean Spaces, Backblaze B2, ...).
 */
export interface S3SourceOptions {
  /** Bucket name */
  bucket: string;
  /** AWS region. Defaults to `us-east-1`, which S3-compatible services accept. */
  region?: string | undefined;
  /** Custom endpoint for S3-compatible services, e.g. `http://localhost:9000` */
  endpoint?: string | undefined;
  /** Use `endpoint/bucket/key` URLs instead of `bucket.endpoint/key`. MinIO needs `true`. */
  forcePathStyle?: boolean | undefined;
  /** Key prefix inside the bucket that acts as the source root, e.g. `uploads/site-a` */
  prefix?: string | undefined;
  /** Explicit credentials. When omitted the AWS SDK default credential chain is used. */
  credentials?: S3Credentials | undefined;
  /**
   * Base URL used by `publicUrl()`. Defaults to the virtual-host or
   * path-style bucket URL derived from `endpoint`/`region`.
   */
  publicBaseUrl?: string | undefined;
  /** Pre-configured client. Handy for tests and for sharing a client between sources. */
  client?: S3Client | undefined;
}

const DEFAULT_REGION = 'us-east-1';
const DELETE_BATCH_SIZE = 1000;

/**
 * Normalize a storage path to an S3 key fragment: forward slashes only,
 * no leading/trailing slashes, no empty segments. `''` and `'/'` both mean root.
 */
export function normalizeS3Path(path: string): string {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment.length > 0 && segment !== '.')
    .join('/');
}

/**
 * Build a full object key from a prefix and a storage path.
 */
export function buildObjectKey(prefix: string, path: string): string {
  const normalizedPrefix = normalizeS3Path(prefix);
  const normalizedPath = normalizeS3Path(path);

  if (normalizedPrefix === '') {
    return normalizedPath;
  }

  return normalizedPath === ''
    ? normalizedPrefix
    : `${normalizedPrefix}/${normalizedPath}`;
}

/**
 * Strip the prefix from an object key to get the storage path.
 */
export function stripObjectPrefix(prefix: string, key: string): string {
  const normalizedPrefix = normalizeS3Path(prefix);

  if (normalizedPrefix === '') {
    return normalizeS3Path(key);
  }

  const withSlash = normalizedPrefix + '/';

  if (key === normalizedPrefix) {
    return '';
  }

  return key.startsWith(withSlash)
    ? normalizeS3Path(key.substring(withSlash.length))
    : normalizeS3Path(key);
}

function lookupMimeType(path: string): string {
  const type = mime.lookup(path);
  return typeof type === 'string' ? type : 'application/octet-stream';
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    err.name === 'NotFound' ||
    err.name === 'NoSuchKey' ||
    err.$metadata?.httpStatusCode === 404
  );
}

function encodeCopySource(bucket: string, key: string): string {
  return (
    bucket +
    '/' +
    key
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')
  );
}

function fileEntry(
  path: string,
  object: {
    Size?: number | undefined;
    LastModified?: Date | undefined;
    ContentType?: string | undefined;
  }
): StatEntry {
  return {
    path,
    type: 'file',
    isFile: true,
    isDirectory: false,
    size: object.Size ?? 0,
    lastModifiedMs: object.LastModified?.getTime() ?? 0,
    mimeType: object.ContentType
  };
}

function directoryEntry(path: string, lastModifiedMs?: number): StatEntry {
  return {
    path,
    type: 'directory',
    isFile: false,
    isDirectory: true,
    lastModifiedMs: lastModifiedMs ?? 0
  };
}

/**
 * Storage adapter for AWS S3 and S3-compatible object stores.
 *
 * Folders are emulated the way the S3 console does it: a zero-byte object
 * whose key ends with `/` marks an explicitly created folder, and any key
 * with a `/` in it implies its parent folders exist.
 *
 * The adapter never touches object ACLs: `visibility()` always reports
 * `public` and `changeVisibility()` is a no-op. Make the prefix readable
 * with a bucket policy or serve it through a CDN.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly client: S3Client;
  readonly bucket: string;
  readonly prefix: string;
  private readonly publicBaseUrl: string;

  constructor(options: S3SourceOptions) {
    if (!options.bucket) {
      throw new Error('S3StorageAdapter: "bucket" is required');
    }

    this.bucket = options.bucket;
    this.prefix = normalizeS3Path(options.prefix ?? '');
    this.client = options.client ?? S3StorageAdapter.createClient(options);
    this.publicBaseUrl = (
      options.publicBaseUrl ?? S3StorageAdapter.defaultPublicBaseUrl(options)
    ).replace(/\/+$/, '');
  }

  static createClient(options: S3SourceOptions): S3Client {
    const config: S3ClientConfig = {
      region: options.region ?? DEFAULT_REGION
    };

    if (options.endpoint !== undefined) {
      config.endpoint = options.endpoint;
    }

    if (options.forcePathStyle !== undefined) {
      config.forcePathStyle = options.forcePathStyle;
    }

    if (options.credentials !== undefined) {
      config.credentials = {
        accessKeyId: options.credentials.accessKeyId,
        secretAccessKey: options.credentials.secretAccessKey,
        ...(options.credentials.sessionToken !== undefined
          ? { sessionToken: options.credentials.sessionToken }
          : {})
      };
    }

    return new S3Client(config);
  }

  static defaultPublicBaseUrl(options: S3SourceOptions): string {
    const prefix = normalizeS3Path(options.prefix ?? '');
    const suffix = prefix === '' ? '' : '/' + prefix;

    if (options.endpoint !== undefined) {
      const endpoint = options.endpoint.replace(/\/+$/, '');

      if (options.forcePathStyle === true) {
        return `${endpoint}/${options.bucket}${suffix}`;
      }

      const url = new URL(endpoint);
      return `${url.protocol}//${options.bucket}.${url.host}${suffix}`;
    }

    const region = options.region ?? DEFAULT_REGION;
    return `https://${options.bucket}.s3.${region}.amazonaws.com${suffix}`;
  }

  /** Object key for a file path */
  private key(path: string): string {
    return buildObjectKey(this.prefix, path);
  }

  /**
   * Key prefix for a directory path, always ending with `/` (or empty for
   * the bucket root without prefix). The folder marker object has this key.
   */
  private dirKey(path: string): string {
    const key = this.key(path);
    return key === '' ? '' : key + '/';
  }

  private isRoot(path: string): boolean {
    return normalizeS3Path(path) === '';
  }

  private toPath(key: string): string {
    return stripObjectPrefix(this.prefix, key);
  }

  async write(
    path: string,
    contents: Readable,
    options: WriteOptions
  ): Promise<void> {
    const key = this.key(path);
    const contentType = options.mimeType ?? lookupMimeType(key);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: contents,
        ContentType: contentType,
        ...(options.cacheControl !== undefined
          ? { CacheControl: options.cacheControl }
          : {})
      }
    });

    await upload.done();
  }

  async read(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<FileContents> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
    );

    const body = response.Body;

    if (body === undefined) {
      return Readable.from([]);
    }

    if (body instanceof Readable) {
      return body;
    }

    return Readable.from(Buffer.from(await body.transformToByteArray()));
  }

  async deleteFile(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
    );
  }

  async createDirectory(
    path: string,
    _options: CreateDirectoryOptions = {}
  ): Promise<void> {
    if (this.isRoot(path)) {
      return;
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.dirKey(path),
        Body: '',
        ContentLength: 0
      })
    );
  }

  async stat(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<StatEntry> {
    const normalized = normalizeS3Path(path);

    if (normalized === '') {
      return directoryEntry('');
    }

    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
      );

      return fileEntry(normalized, {
        Size: head.ContentLength,
        LastModified: head.LastModified,
        ContentType: head.ContentType
      });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    if (await this.directoryExists(path)) {
      return directoryEntry(normalized);
    }

    throw new Error(`Path not found: ${path}`);
  }

  async *list(
    path: string,
    options: { deep: boolean }
  ): AsyncGenerator<StatEntry> {
    const dirKey = this.dirKey(path);
    const seenDirectories = new Set<string>();
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: dirKey,
          ...(options.deep ? {} : { Delimiter: '/' }),
          ...(continuationToken !== undefined
            ? { ContinuationToken: continuationToken }
            : {})
        })
      );

      for (const common of page.CommonPrefixes ?? []) {
        if (common.Prefix === undefined || common.Prefix === dirKey) {
          continue;
        }

        const dirPath = this.toPath(common.Prefix);

        if (dirPath !== '' && !seenDirectories.has(dirPath)) {
          seenDirectories.add(dirPath);
          yield directoryEntry(dirPath);
        }
      }

      for (const object of page.Contents ?? []) {
        const key = object.Key;

        if (key === undefined || key === dirKey) {
          continue;
        }

        if (key.endsWith('/')) {
          const dirPath = this.toPath(key);

          if (dirPath !== '' && !seenDirectories.has(dirPath)) {
            seenDirectories.add(dirPath);
            yield directoryEntry(dirPath, object.LastModified?.getTime());
          }

          continue;
        }

        const filePath = this.toPath(key);

        if (options.deep) {
          // Implicit parent folders between the listed directory and the file
          const relative = filePath.substring(this.toPath(dirKey).length);
          const segments = relative.split('/').filter(Boolean);
          let parent = this.toPath(dirKey);

          for (const segment of segments.slice(0, -1)) {
            parent = parent === '' ? segment : `${parent}/${segment}`;

            if (!seenDirectories.has(parent)) {
              seenDirectories.add(parent);
              yield directoryEntry(parent);
            }
          }
        }

        yield fileEntry(filePath, object);
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken !== undefined);
  }

  async changeVisibility(
    _path: string,
    _visibility: string,
    _options: MiscellaneousOptions = {}
  ): Promise<void> {
    // ACLs are intentionally untouched: most modern buckets have them disabled.
  }

  async visibility(
    _path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<string> {
    return 'public';
  }

  async deleteDirectory(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<void> {
    const dirKey = this.dirKey(path);

    // Each round lists the prefix from the beginning: deleting shifts the
    // listing, so a continuation token from a previous page would skip keys.
    for (;;) {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: dirKey,
          MaxKeys: DELETE_BATCH_SIZE
        })
      );

      const keys = (page.Contents ?? [])
        .map(object => object.Key)
        .filter((key): key is string => key !== undefined);

      if (keys.length === 0) {
        return;
      }

      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true }
        })
      );

      if (page.IsTruncated !== true) {
        return;
      }
    }
  }

  async fileExists(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<boolean> {
    if (this.isRoot(path)) {
      return false;
    }

    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
      );
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }

  async directoryExists(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<boolean> {
    if (this.isRoot(path)) {
      return true;
    }

    const page = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.dirKey(path),
        MaxKeys: 1
      })
    );

    return (page.KeyCount ?? 0) > 0;
  }

  async publicUrl(
    path: string,
    _options: PublicUrlOptions = {}
  ): Promise<string> {
    const normalized = normalizeS3Path(path);
    return normalized === ''
      ? this.publicBaseUrl
      : `${this.publicBaseUrl}/${normalized}`;
  }

  async temporaryUrl(
    _path: string,
    _options: TemporaryUrlOptions
  ): Promise<string> {
    throw new Error('S3StorageAdapter does not support temporary URLs');
  }

  async checksum(
    path: string,
    _options: ChecksumOptions = {}
  ): Promise<string> {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
    );

    return (head.ETag ?? '').replace(/"/g, '');
  }

  async mimeType(
    path: string,
    _options: MimeTypeOptions = {}
  ): Promise<string> {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
    );

    return head.ContentType ?? lookupMimeType(path);
  }

  async lastModified(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<number> {
    const entry = await this.stat(path);
    return entry.lastModifiedMs ?? 0;
  }

  async fileSize(
    path: string,
    _options: MiscellaneousOptions = {}
  ): Promise<number> {
    const entry = await this.stat(path);
    return entry.isFile ? (entry.size ?? 0) : 0;
  }

  async copyFile(
    from: string,
    to: string,
    _options: CopyFileOptions = {}
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeCopySource(this.bucket, this.key(from)),
        Key: this.key(to)
      })
    );
  }

  async moveFile(
    from: string,
    to: string,
    options: MoveFileOptions = {}
  ): Promise<void> {
    if (await this.fileExists(from)) {
      await this.copyFile(from, to, options);
      await this.deleteFile(from);
      return;
    }

    if (!(await this.directoryExists(from))) {
      throw new Error(`Path not found: ${from}`);
    }

    // Folder move: copy every object under the prefix, then delete the source
    const fromDirKey = this.dirKey(from);
    const toDirKey = this.dirKey(to);

    for await (const entry of this.list(from, { deep: true })) {
      const sourceKey = this.key(entry.path);
      const targetKey = toDirKey + sourceKey.substring(fromDirKey.length);

      if (entry.isDirectory) {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: targetKey + '/',
            Body: '',
            ContentLength: 0
          })
        );
      } else {
        await this.client.send(
          new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: encodeCopySource(this.bucket, sourceKey),
            Key: targetKey
          })
        );
      }
    }

    await this.createDirectory(to);
    await this.deleteDirectory(from);
  }
}
