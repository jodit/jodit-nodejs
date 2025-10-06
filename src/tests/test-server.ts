import type { Application } from 'express';
import type * as http from 'http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../app';

const testFilesPath = path.join(__dirname, '../../files/test');

export async function startTestServer(
  app: Application
): Promise<[http.Server, number]> {
  return new Promise((resolve, reject) => {
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
      resolve([server, address.port]);
    });

    server.on('error', reject);
  });
}

export async function stopTestServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(err => {
      if (err !== null && err !== undefined) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function createTestApp(): Application {
  return createApp({
    sources: {
      test: {
        title: 'Test Files',
        root: testFilesPath,
        baseurl: 'http://localhost:3000/files/test/'
      }
    }
  });
}

export async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(testFilesPath, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
  await fs.mkdir(testFilesPath, { recursive: true });
  await fs.mkdir(path.join(testFilesPath, 'subdir'), { recursive: true });
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
