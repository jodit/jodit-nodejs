import fs from 'node:fs';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { logger } from '../helpers/logger';

const V1 = path.resolve(process.cwd(), 'src/v1');

export function initRegistry(): Promise<OpenAPIRegistry> {
  const registry = new OpenAPIRegistry();

  return Promise.all(
    fs
      .readdirSync(V1, {
        withFileTypes: true
      })
      .filter(item => item.isDirectory())
      .map(async item => {
        const opentAIScheme = path.resolve(V1, item.name, 'openapi.ts');

        if (!fs.existsSync(opentAIScheme)) {
          throw Error(
            'Open API scheme for route ' + item.name + ' is not exist!'
          );
        }

        const route = (await import(opentAIScheme)).default.default;

        registry.registerPath(route);
      })
  )
    .then(() => {
      logger.info('Finish generation');
      return registry;
    })
    .catch(error => {
      logger.error(error);
      return registry;
    });
}
