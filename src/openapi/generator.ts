import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Jodit Connector API',
      description: 'Node.js/TypeScript implementation of Jodit File Browser and Uploader connector',
      contact: {
        name: 'Chupurnov Valeriy',
        email: 'chupurnov@gmail.com'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server'
      }
    ]
  });
}
