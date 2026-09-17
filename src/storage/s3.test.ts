import { S3Client } from '@aws-sdk/client-s3';
import {
  S3StorageAdapter,
  buildObjectKey,
  normalizeS3Path,
  stripObjectPrefix
} from './s3';

describe('S3 key mapping', () => {
  it('normalizes storage paths to key fragments', () => {
    expect(normalizeS3Path('')).toBe('');
    expect(normalizeS3Path('/')).toBe('');
    expect(normalizeS3Path('./')).toBe('');
    expect(normalizeS3Path('/a/b/')).toBe('a/b');
    expect(normalizeS3Path('a//b')).toBe('a/b');
    expect(normalizeS3Path('a\\b\\c.txt')).toBe('a/b/c.txt');
  });

  it('builds keys under a prefix', () => {
    expect(buildObjectKey('', 'a/b.txt')).toBe('a/b.txt');
    expect(buildObjectKey('/uploads/', 'a/b.txt')).toBe('uploads/a/b.txt');
    expect(buildObjectKey('uploads', '')).toBe('uploads');
    expect(buildObjectKey('uploads', '/')).toBe('uploads');
  });

  it('strips the prefix back off object keys', () => {
    expect(stripObjectPrefix('', 'a/b.txt')).toBe('a/b.txt');
    expect(stripObjectPrefix('uploads', 'uploads/a/b.txt')).toBe('a/b.txt');
    expect(stripObjectPrefix('uploads', 'uploads/')).toBe('');
    expect(stripObjectPrefix('uploads', 'uploads')).toBe('');
    expect(stripObjectPrefix('uploads', 'uploads/sub/')).toBe('sub');
  });

  it('does not confuse a prefix with a sibling key sharing the same start', () => {
    expect(stripObjectPrefix('uploads', 'uploads-evil/x.txt')).toBe(
      'uploads-evil/x.txt'
    );
  });
});

describe('S3StorageAdapter public URLs', () => {
  const client = new S3Client({
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
  });

  it('defaults to the virtual-host AWS URL with the prefix', async () => {
    const adapter = new S3StorageAdapter({
      bucket: 'photos',
      region: 'eu-central-1',
      prefix: 'site-a',
      client
    });

    await expect(adapter.publicUrl('img/cat.jpg')).resolves.toBe(
      'https://photos.s3.eu-central-1.amazonaws.com/site-a/img/cat.jpg'
    );
    await expect(adapter.publicUrl('/')).resolves.toBe(
      'https://photos.s3.eu-central-1.amazonaws.com/site-a'
    );
  });

  it('uses path-style URLs for endpoints that need them', async () => {
    const adapter = new S3StorageAdapter({
      bucket: 'photos',
      endpoint: 'http://localhost:9000/',
      forcePathStyle: true,
      client
    });

    await expect(adapter.publicUrl('cat.jpg')).resolves.toBe(
      'http://localhost:9000/photos/cat.jpg'
    );
  });

  it('uses virtual-host URLs for custom endpoints by default', async () => {
    const adapter = new S3StorageAdapter({
      bucket: 'photos',
      endpoint: 'https://storage.yandexcloud.net',
      client
    });

    await expect(adapter.publicUrl('cat.jpg')).resolves.toBe(
      'https://photos.storage.yandexcloud.net/cat.jpg'
    );
  });

  it('prefers an explicit publicBaseUrl (CDN)', async () => {
    const adapter = new S3StorageAdapter({
      bucket: 'photos',
      prefix: 'site-a',
      publicBaseUrl: 'https://cdn.example.com/media/',
      client
    });

    await expect(adapter.publicUrl('cat.jpg')).resolves.toBe(
      'https://cdn.example.com/media/cat.jpg'
    );
  });

  it('requires a bucket', () => {
    expect(() => new S3StorageAdapter({ bucket: '', client })).toThrow(
      '"bucket" is required'
    );
  });
});
