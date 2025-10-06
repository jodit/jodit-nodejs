import type { Application } from 'express';
import type * as http from 'http';

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
