# Jodit Connector Application (Node.js)

[![CI/CD](https://github.com/jodit/jodit-nodejs/actions/workflows/connector.yml/badge.svg)](https://github.com/jodit/jodit-nodejs/actions/workflows/connector.yml)
[![Documentation](https://github.com/jodit/jodit-nodejs/actions/workflows/docs.yml/badge.svg)](https://jodit.github.io/jodit-nodejs/)
[![npm version](https://badge.fury.io/js/jodit-nodejs.svg)](https://www.npmjs.com/package/jodit-nodejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js/TypeScript implementation of the Jodit File Browser and Uploader connector.

**Links:**
- [Jodit Editor](https://xdsoft.net/jodit/) - The WYSIWYG HTML editor
- [Complete Documentation](https://jodit.github.io/jodit-nodejs/) - Full documentation and API reference
- [PHP Connector](https://github.com/xdan/jodit-connectors) - Original PHP implementation

## Technology Stack

- **Node.js LTS** (v18+)
- **TypeScript** with strict typing
- **Express 5.x** for REST API
- **Zod** for runtime validation
- **@hapi/boom** for error handling
- **Winston** for logging
- **Jest + Supertest** for testing

## Installation

```bash
npm install jodit-nodejs
```

## Quick Start

### Basic Usage (TypeScript)

```typescript
import { start } from 'jodit-nodejs';

// Start server with default config
const server = await start(8081);
console.log('Server running on http://localhost:8081');
```

### Basic Usage (JavaScript)

```javascript
const { start } = require('jodit-nodejs');

async function main() {
  const server = await start(8081);
  console.log('Server running on http://localhost:8081');
}

main().catch(console.error);
```

### With Custom Configuration

```typescript
import { start } from 'jodit-nodejs';

await start({
  port: 8081,
  config: {
    debug: false,
    allowCrossOrigin: true,
    sources: {
      uploads: {
        name: 'uploads',
        title: 'User Uploads',
        root: '/var/www/uploads',
        // NGINX or CDN base URL for accessing files
        baseurl: 'http://localhost:8080/uploads/'
      }
    }
  }
});
```

### With Authentication

```typescript
import { start, type AuthCallback } from 'jodit-nodejs';

const checkAuth: AuthCallback = async (req) => {
  const token = req.headers.authorization;
  if (!token) return 'guest';

  const user = await validateToken(token);
  return user.role; // 'admin', 'editor', 'guest', etc.
};

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: [
      { role: 'guest', FILES: true, FILE_UPLOAD: false },
      { role: 'admin', FILES: true, FILE_UPLOAD: true }
    ]
  },
  checkAuthentication: checkAuth
});
```

### Security: POST-only Mode

You can restrict the API to accept only POST requests:

```typescript
import { start } from 'jodit-nodejs';

await start({
  port: 8081,
  config: {
    onlyPOST: true,  // Block all GET requests
    sources: {
      uploads: {
        name: 'uploads',
        title: 'User Uploads',
        root: '/var/www/uploads',
        baseurl: 'http://localhost:8080/uploads/'
      }
    }
  }
});
```

When `onlyPOST` is enabled, all GET requests return 405 Method Not Allowed. This protects against GET-based CSRF attacks and keeps request parameters out of web server access logs.

## Documentation

**[Complete Documentation](https://jodit.github.io/jodit-nodejs/)** - Full documentation with guides and API reference

**Quick Links:**
- [Getting Started](https://jodit.github.io/jodit-nodejs/) - Installation and quick start
- [Authentication](https://jodit.github.io/jodit-nodejs/authentication/) - Cookie auth, JWT, express-session
- [Access Control](https://jodit.github.io/jodit-nodejs/access-control/) - ACL rules and permissions
- [Configuration](https://jodit.github.io/jodit-nodejs/config/) - All configuration options
- [Express Integration](https://jodit.github.io/jodit-nodejs/express-integration/) - Integration patterns
- [Storage Adapters](https://jodit.github.io/jodit-nodejs/storage-adapters/) - AWS S3, Azure, Google Cloud
- [Docker Deployment](https://jodit.github.io/jodit-nodejs/docker/) - Docker guide
- [API Reference](https://jodit.github.io/jodit-nodejs/api-reference/) - Complete API endpoints

**OpenAPI Specification:**
- [OpenAPI YAML](https://jodit.github.io/jodit-nodejs/openapi.yaml)
- [OpenAPI JSON](https://jodit.github.io/jodit-nodejs/openapi.json)

## Key Features

- **Full file management** - browse, upload, rename, move, delete
- **Folder operations** - create, rename, move, delete, tree view
- **Image processing** - resize, crop, thumbnail generation
- **Document generation** - PDF and DOCX from HTML
- **Access control** - role-based permissions, path restrictions
- **Authentication** - cookie, JWT, express-session support
- **Security** - POST-only mode, CSRF protection
- **Express integration** - standalone or integrate with existing apps
- **Custom storage** - local filesystem, S3, Azure, Google Cloud, etc.
- **TypeScript** - full type safety with strict typing
- **Validation** - Zod schemas for runtime validation
- **Testing** - Jest + Supertest test suite
- **Docker** - multi-stage build for production deployment

## Implemented Functions

- **actionFiles** - get list of files
- **actionFileUpload** - upload files
- **actionFileUploadRemote** - upload file from remote URL
- **actionFileRemove** - remove files
- **actionFileMove** - move files
- **actionFileRename** - rename files
- **actionFileDownload** - download file
- **actionGetLocalFileByUrl** - resolve local file by URL
- **actionFolderCreate** - create folders
- **actionFolderRemove** - remove folders
- **actionFolderMove** - move folders
- **actionFolderRename** - rename folders
- **actionFolders** - get folder tree
- **actionPermissions** - get permissions
- **actionImageResize** - resize images
- **actionImageCrop** - crop images
- **actionGenerateDocx** - generate DOCX documents from HTML
- **actionGeneratePdf** - generate PDF documents from HTML

## Examples

Check the `examples/` directory for complete working examples:

- **`examples/basic-js.js`** - Simple server setup
- **`examples/with-auth-js.js`** - With authentication callback
- **`examples/with-cookie-auth.js`** - Cookie-based authentication
- **`examples/with-jwt-auth.js`** - JWT token authentication
- **`examples/with-express-session.js`** - Express-session integration

## Scripts

```bash
npm run dev          # Development with hot reload
npm run build        # Compile TypeScript
npm start            # Run compiled application
npm test             # Run tests
npm run lint         # Check code quality
```

## Docker

```bash
# Build and run
docker build -t jodit-nodejs .
docker run --rm -p 8081:8081 jodit-nodejs

# With custom config
docker run --rm -p 8081:8081 \
  -v /host/path/to/config.json:/usr/src/app/config.json \
  -v /host/path/to/files:/usr/src/app/files \
  jodit-nodejs
```

## License

MIT
