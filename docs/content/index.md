---
title: Getting Started
description: Quick start guide for Jodit Connector Node.js - installation, basic usage, and key features.
---

# Getting Started

Welcome to Jodit Connector Node.js - a TypeScript implementation of the Jodit File Browser and Uploader connector.

## Overview

Jodit Connector Node.js provides a complete file management backend for the Jodit Editor, with support for:

- **File operations** - browse, upload, rename, move, delete
- **Folder management** - create, rename, move, delete, tree view
- **Image processing** - resize, crop, thumbnail generation
- **Document generation** - PDF and DOCX from HTML
- **Authentication & ACL** - role-based permissions, path restrictions
- **Express integration** - standalone or integrate with existing apps
- **Custom storage** - local filesystem, S3, Azure, Google Cloud, etc.

## Quick Installation

### Via npm

```bash
npm install jodit-nodejs
```

### Via Docker

```bash
# Pull from DockerHub
docker pull chupurnov/jodit-nodejs:latest

# Run with default config
docker run --rm -p 8081:8081 chupurnov/jodit-nodejs

# Run with custom config file
docker run --rm -p 8081:8081 \
  -v $(pwd)/config.json:/usr/src/app/config.json \
  -v $(pwd)/files:/usr/src/app/files \
  chupurnov/jodit-nodejs
```

Example `config.json`:
```json
{
  "debug": false,
  "allowCrossOrigin": true,
  "sources": {
    "uploads": {
      "name": "uploads",
      "title": "My Files",
      "root": "/usr/src/app/files",
      "baseurl": "http://localhost:8081/files/"
    }
  }
}
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
        baseurl: 'http://localhost:8081/uploads/'
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
  return user.role;
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

## Project Structure

```
jodit-nodejs/
├── src/
│   ├── v1/                  # API handlers (files, ping, etc.)
│   ├── config/              # Application configuration
│   ├── helpers/             # Utility functions
│   ├── middlewares/         # Express middleware
│   ├── schemas/             # Zod validation schemas
│   ├── types/               # TypeScript types
│   ├── openapi/             # OpenAPI spec generator
│   ├── tests/               # Tests
│   ├── app.ts               # Express application factory
│   ├── index.ts             # Entry point
│   └── run.ts               # Default launcher
├── examples/                # Usage examples
├── docs/                    # Documentation
└── README.md
```

## Next Steps

- **[Installation & Setup](./installation.md)** - Environment variables and configuration
- **[API Usage](./api-usage.md)** - Complete usage examples for TypeScript, CommonJS, ES Modules
- **[Express Integration](./express-integration.md)** - Integration patterns with existing Express apps
- **[API Reference](./api-reference.md)** - Complete API endpoints documentation
- **[Authentication](./authentication.md)** - Cookie auth, JWT, express-session
- **[Access Control](./access-control.md)** - ACL rules, permissions, dynamic rules
- **[Configuration](./config.md)** - All configuration options
- **[Storage Adapters](./storage-adapters.md)** - AWS S3, Azure, Google Cloud, custom backends
- **[Testing](./testing.md)** - Running tests and test architecture
- **[Docker](./docker.md)** - Docker deployment guide
- **[Deployment](./deployment.md)** - CI/CD, GitHub Actions, npm publishing

## Key Features

### Input Validation
- **Zod schemas** for all query parameters and config
- Runtime validation with detailed error messages
- Type-safe validated data

### Error Handling
- **@hapi/boom** for structured errors
- Automatic error transformation to API format
- Debug mode with stack traces

### Logging
- **Winston** logger with custom levels
- Colored console output
- Silent mode for tests

### Architecture
- Factory pattern with `createApp()`
- Middleware-based validation
- Separation of concerns
- TypeScript strict mode

### OpenAPI Documentation
- Auto-generated from Zod schemas
- Swagger UI available online
- Single source of truth for validation and docs

## Differences from PHP Version

- **Async/await** instead of synchronous operations
- **TypeScript** for compile-time type safety
- **Zod** for runtime validation
- **Express 5.x** instead of built-in PHP server
- **Winston** for structured logging
- **@hapi/boom** for error handling
- **Jest** instead of Codeception
