import type * as http from 'http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../app';
import type { AppConfig } from '../types';

const testFilesPath = path.join(__dirname, '../../files/test');

export interface TestServer {
  host: string;
  server?: http.Server;
}

/**
 * Start a real HTTP test server
 * @param config Optional custom config for the app
 * @returns Object with host URL, server instance, and port
 */
export async function startTestServer(
  config?: Partial<AppConfig>
): Promise<TestServer> {
  await createTestDirectories();

  const app = createApp({
    sources: {
      test: {
        title: 'Test Files',
        root: testFilesPath,
        baseurl: 'http://localhost:3000/files/test/'
      }
    },
    ...config
  });

  return new Promise((resolve, reject) => {
    if (process.env.TEST_SERVER_HOST != null) {
      return resolve({
        host: process.env.TEST_SERVER_HOST
      });
    }

    const server = app.listen(0, () => {
      const address = server.address();
      if (
        address === null ||
        address === undefined ||
        typeof address === 'string'
      ) {
        reject(new Error('Failed to get server port'));
        return;
      }

      const port = address.port;
      const host = `http://localhost:${port}`;

      resolve({ host, server });
    });

    server.on('error', reject);
  });
}

/**
 * Stop the test server
 */
export async function stopTestServer(testServer: TestServer): Promise<void> {
  await cleanupTestFiles();

  if (testServer.server == null) {
    return;
  }

  return new Promise((resolve, reject) => {
    testServer.server?.close(err => {
      if (err !== null && err !== undefined) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function createTestDirectories(): Promise<void> {
  await fs.mkdir(testFilesPath, { recursive: true });
  await fs.mkdir(path.join(testFilesPath, 'subdir'), { recursive: true });
}

export async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(testFilesPath, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
}

export async function createTestFile(
  fileName: string,
  content: string,
  subPath: string = ''
): Promise<void> {
  const filePath = path.join(testFilesPath, subPath, fileName);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}
