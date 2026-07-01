import type * as http from 'http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../app';
import type { AppConfig } from '../types';
import type { AuthCallback } from '../middlewares/auth';

const testFilesPath = path.join(process.cwd(), './files/test');

export interface TestServer {
  host: string;
  server?: http.Server;
}

/**
 * Start a real HTTP test server
 * @param config Optional custom config for the app
 * @param checkAuthentication Optional authentication callback
 * @returns Object with host URL, server instance, and port
 */
export async function startTestServer(
  config?: Partial<AppConfig>,
  checkAuthentication?: AuthCallback
): Promise<TestServer> {
  await createTestDirectories();

  const app = createApp({
    defaultFilesKey: 'files',
    // Tests mock remote files on localhost, so allow private hosts by default;
    // the SSRF test flips this off to exercise the guard.
    allowPrivateNetworkUploads: true,
    sources: {
      test: {
        name: 'test',
        title: 'Test Files',
        root: testFilesPath,
        baseurl: 'http://localhost:8081/files/test/',
        defaultFilesKey: 'files'
      }
    },
    ...config
  });

  // Set checkAuthentication if provided
  if (checkAuthentication !== undefined) {
    app.locals.checkAuthentication = checkAuthentication;
  }

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

  // Also cleanup test2 directory
  try {
    const testFilesPath2 = path.join(process.cwd(), './files/test2');
    await fs.rm(testFilesPath2, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
}

export async function createTestFile(
  fileName: string,
  content: string,
  basePath: string = ''
): Promise<void> {
  let filePath: string;

  // Check if basePath is an absolute path that points outside of project (like /Users/...)
  // If so, use it directly. Otherwise, treat as relative to testFilesPath
  if (
    basePath &&
    path.isAbsolute(basePath) &&
    basePath.includes(process.cwd())
  ) {
    // Full absolute path
    filePath = path.join(basePath, fileName);
  } else {
    // Relative path (including paths like '/subdir', 'subdir', or '')
    const relativePath = basePath.startsWith('/')
      ? basePath.substring(1)
      : basePath;
    filePath = path.join(testFilesPath, relativePath, fileName);
  }

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}
