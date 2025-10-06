import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';
import * as path from 'path';
import * as fs from 'fs';

interface PackageJson {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  license: string;
}

function loadPackageJson(): PackageJson {
  const packagePath = path.resolve(process.cwd(), './package.json');
  const packageContent = fs.readFileSync(packagePath, 'utf-8');
  return JSON.parse(packageContent) as PackageJson;
}

function parseAuthor(author: string): { name: string; email: string } | never {
  const match = /^([^<]+)\s*(?:<([^>]+)>)?/.exec(author);
  if (match !== null) {
    return {
      name: match[1]?.trim() ?? '',
      email: match[2]?.trim() ?? ''
    };
  }
  return { name: author, email: '' };
}

export function generateOpenApiSpec(): ReturnType<
  typeof OpenApiGeneratorV3.prototype.generateDocument
> {
  const pkg = loadPackageJson();
  const author = parseAuthor(pkg.author);
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: pkg.version,
      title: pkg.displayName,
      description: pkg.description,
      contact: {
        name: author.name,
        email: author.email
      },
      license: {
        name: pkg.license
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
