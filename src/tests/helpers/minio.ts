import { execSync } from 'node:child_process';
import {
  CreateBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer
} from 'testcontainers';

export const MINIO_USER = 'minioadmin';
export const MINIO_PASSWORD = 'minioadmin';

export interface MinioFixture {
  container: StartedTestContainer;
  endpoint: string;
  client: S3Client;
  stop: () => Promise<void>;
}

/**
 * Whether a Docker daemon is reachable. Tests that need MinIO skip
 * themselves otherwise instead of failing.
 */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function startMinio(bucket: string): Promise<MinioFixture> {
  // Colima / rootless daemons expose the socket at a user path that cannot
  // be bind-mounted into the reaper; the same overrides the sibling
  // services use (see their global-setup files).
  process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ||= '/var/run/docker.sock';
  process.env.TESTCONTAINERS_RYUK_DISABLED ||= 'true';

  const container = await new GenericContainer(
    process.env.MINIO_IMAGE ?? 'quay.io/minio/minio:latest'
  )
    .withEnvironment({
      MINIO_ROOT_USER: MINIO_USER,
      MINIO_ROOT_PASSWORD: MINIO_PASSWORD
    })
    .withCommand(['server', '/data'])
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
    .start();

  const endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;

  const client = new S3Client({
    region: 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_USER, secretAccessKey: MINIO_PASSWORD }
  });

  await client.send(new CreateBucketCommand({ Bucket: bucket }));

  return {
    container,
    endpoint,
    client,
    stop: async (): Promise<void> => {
      client.destroy();
      await container.stop();
    }
  };
}

export async function objectExists(
  client: S3Client,
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function listKeys(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const page = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );

  return (page.Contents ?? [])
    .map(object => object.Key)
    .filter((key): key is string => key !== undefined)
    .sort();
}

export async function putObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: string | Buffer
): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body })
  );
}
