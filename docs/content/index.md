---
title: Complete Documentation
description: Comprehensive documentation for Jodit Connector Node.js with all features, examples, and guides.
---

# Jodit Connector Node.js - Complete Documentation

This is the complete documentation for Jodit Connector Node.js implementation.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Usage](#api-usage)
  - [TypeScript](#as-npm-package-typescript)
  - [JavaScript (CommonJS)](#as-npm-package-javascriptcommonjs)
  - [JavaScript (ES Modules)](#as-npm-package-javascriptes-modules)
- [Express Integration](#express-integration)
  - [Standalone Mode](#1-standalone-mode-default)
  - [Integration with Existing App](#2-integration-with-existing-express-app)
  - [Custom Router with Path Prefix](#3-custom-router-with-path-prefix)
  - [Multiple Jodit Instances](#4-multiple-jodit-instances)
- [API Endpoints](#api-endpoints)
- [Authentication & Access Control](#authentication--access-control)
- [Configuration](#configuration)
- [Custom Storage Adapters](#custom-storage-adapters)
- [Tests](#tests)
- [Key Features](#key-features)
- [Docker Deployment](#docker-deployment)
- [CI/CD](#cicd)
- [Differences from PHP Version](#differences-from-php-version)

## Environment Variables

You can configure the application using environment variables:

```bash
# Set custom source name
SOURCE_NAME="My Files" npm start

# Set custom source root directory
SOURCE_ROOT="/path/to/files" npm start

# Set custom source base URL
SOURCE_BASEURL="http://example.com/files/" npm start

# Set custom port (default: 8081)
PORT=8080 npm start

# Combine multiple variables
SOURCE_NAME="Production Files" \
SOURCE_ROOT="/var/www/uploads" \
SOURCE_BASEURL="https://cdn.example.com/uploads/" \
PORT=8080 \
npm start

# Or provide full configuration via JSON
CONFIG='{"debug":false,"allowCrossOrigin":true,"sources":{"production":{"title":"Production Files","root":"/var/www/uploads","baseurl":"https://cdn.example.com/uploads/"}}}' \
PORT=8080 \
npm start
```

**Environment Variables:**
- `SOURCE_NAME` - Display name for the default source (default: "Test Files")
- `SOURCE_ROOT` - Absolute path to the files directory (default: "./files/test")
- `SOURCE_BASEURL` - Base URL for accessing files (default: "http://localhost:8081/files/test/")
- `PORT` - Server port (default: 8081)
- `CONFIG` - Full configuration as JSON string (highest priority, overrides CONFIG_FILE and default config)
- `CONFIG_FILE` - Path to JSON configuration file (overrides default config)

## Project Structure

```
jodit-nodejs/
├── src/
│   ├── v1/                  # API handlers (files, ping, etc.)
│   ├── config/              # Application configuration
│   ├── helpers/             # Utility functions (logger, file-system, access-control)
│   ├── middlewares/         # Express middleware (auth, access-control, validation)
│   ├── schemas/             # Zod validation schemas
│   ├── types/               # TypeScript types and interfaces
│   ├── openapi/             # OpenAPI spec generator
│   ├── tests/               # Tests
│   │   ├── integration/     # Integration tests
│   │   └── test-server.ts   # Test server utilities
│   ├── app.ts               # Express application factory
│   ├── index.ts             # Entry point (exports start/stop/createApp)
│   └── run.ts               # Default app launcher for development
├── examples/                # Usage examples
│   ├── basic-js.js          # Basic JavaScript example
│   ├── with-auth-js.js      # Example with checkAuthentication callback
│   ├── with-cookie-auth.js  # Example with cookie-based authentication
│   ├── with-jwt-auth.js     # Example with JWT token authentication
│   └── with-express-session.js # Example with express-session (like PHP $_SESSION)
├── files/                   # Files directory (gitignored)
├── dist/                    # Compiled code (gitignored)
│   └── docs/                # Generated OpenAPI documentation (gitignored)
├── docs/                    # Documentation files
│   ├── authentication.md    # Authentication & access control guide
│   ├── config.md            # Configuration reference
│   ├── storage-adapters.md  # Custom storage adapters guide
│   └── deployment.md        # Deployment guide
├── .github/
│   └── workflows/
│       └── connector.yml    # CI/CD workflow (test, docker, npm publish)
├── package.json
├── tsconfig.json
├── jest.config.js
├── eslint.config.js
├── .prettierrc
└── README.md                # Main readme
```

## API Usage

### As NPM Package (TypeScript)

```typescript
import { start, stop, createApp } from 'jodit-nodejs';
import type { AppConfig, AuthCallback } from 'jodit-nodejs';

// Start server with default config
const server = await start(8081);

// Start server with custom config
const customConfig: Partial<AppConfig> = {
  debug: false,
  allowCrossOrigin: true,
  sources: {
    myfiles: {
      title: 'My Files',
      root: '/path/to/files',
      baseurl: 'http://localhost:8081/files/'
    }
  }
};
const server = await start(8081, customConfig);

// Start server with authentication middleware
const checkAuth: AuthCallback = async (req) => {
  const token = req.headers.authorization;
  if (!token) throw new Error('Unauthorized');

  // Validate token and return user role
  const user = await validateToken(token);
  return user.role; // e.g., 'admin', 'editor', 'guest'
};

const server = await start({
  port: 8081,
  config: customConfig,
  checkAuthentication: checkAuth
});

// Or create Express app directly
const app = createApp(customConfig);
app.listen(8081);

// Stop server
await stop();
```

### As NPM Package (JavaScript/CommonJS)

```javascript
const { start, stop, createApp } = require('jodit-nodejs');

// Start server with default config
async function main() {
  const server = await start(8081);
  console.log('Server running on port 8081');
}

// Start server with custom config
async function startWithConfig() {
  const customConfig = {
    debug: false,
    allowCrossOrigin: true,
    sources: {
      myfiles: {
        title: 'My Files',
        root: '/path/to/files',
        baseurl: 'http://localhost:8081/files/'
      }
    }
  };

  const server = await start(8081, customConfig);

  // Stop on SIGINT
  process.on('SIGINT', async () => {
    await stop();
    process.exit(0);
  });
}

// Start server with authentication
async function startWithAuth() {
  const checkAuth = async (req) => {
    const token = req.headers.authorization;
    if (!token) throw new Error('Unauthorized');

    // Validate token and return user role
    const user = await validateToken(token);
    return user.role; // e.g., 'admin', 'editor', 'guest'
  };

  const server = await start({
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
}

// Or create Express app directly
function createCustomApp() {
  const app = createApp({
    debug: true,
    sources: {
      uploads: {
        title: 'Uploads',
        root: '/var/www/uploads',
        baseurl: 'https://example.com/uploads/'
      }
    }
  });

  app.listen(8081, () => {
    console.log('Server started on port 8081');
  });
}

main().catch(console.error);
```

### As NPM Package (JavaScript/ES Modules)

```javascript
import { start, stop, createApp } from 'jodit-nodejs';

// Start server with default config
const server = await start(8081);

// Start server with custom config
const customConfig = {
  debug: false,
  allowCrossOrigin: true,
  sources: {
    myfiles: {
      title: 'My Files',
      root: '/path/to/files',
      baseurl: 'http://localhost:8081/files/'
    }
  }
};
const server = await start(8081, customConfig);

// Start server with authentication middleware
const checkAuth = async (req) => {
  const token = req.headers.authorization;
  if (!token) throw new Error('Unauthorized');

  // Validate token and return user role
  const user = await validateToken(token);
  return user.role;
};

const serverWithAuth = await start({
  port: 8081,
  config: customConfig,
  checkAuthentication: checkAuth
});

// Stop server
await stop();
```

## Express Integration

Jodit Connector can be integrated with existing Express applications in three ways:

### 1. Standalone Mode (Default)

Create a standalone Express app with Jodit Connector routes:

```typescript
import { createApp } from 'jodit-nodejs';

// Creates new Express app with Jodit routes
const app = createApp({
  sources: {
    uploads: {
      name: 'uploads',
      title: 'User Uploads',
      root: '/var/www/uploads',
      baseurl: 'http://localhost:8081/uploads/'
    }
  }
});

app.listen(8081);
```

### 2. Integration with Existing Express App

Add Jodit Connector to an existing Express application:

```typescript
import express from 'express';
import { createApp } from 'jodit-nodejs';

// Your existing Express app
const myApp = express();

// Add your custom routes
myApp.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Add custom middleware
myApp.use((req, res, next) => {
  res.setHeader('X-Custom-Header', 'my-value');
  next();
});

// Integrate Jodit Connector (mounts at root by default)
createApp({
  sources: {
    files: {
      name: 'files',
      title: 'Files',
      root: '/var/www/files',
      baseurl: 'http://localhost:8081/files/'
    }
  }
}, myApp);

myApp.listen(8081);

// Now you have:
// GET /health         -> Your custom route
// GET /?action=files  -> Jodit files endpoint
// GET /ping          -> Jodit ping endpoint
```

### 3. Custom Router with Path Prefix

Mount Jodit Connector at a specific path using a custom router:

```typescript
import express, { Router } from 'express';
import { createApp } from 'jodit-nodejs';

const myApp = express();
const joditRouter = Router();

// Create Jodit Connector with custom router
createApp({
  sources: {
    uploads: {
      name: 'uploads',
      title: 'Uploads',
      root: '/var/www/uploads',
      baseurl: 'http://localhost:8081/uploads/'
    }
  }
}, myApp, joditRouter);

// Mount the router at /api/files
myApp.use('/api/files', joditRouter);

myApp.listen(8081);

// Jodit endpoints are now available at:
// GET /api/files/?action=files
// GET /api/files/ping
// POST /api/files/?action=fileUpload
```

### 4. Multiple Jodit Instances

Run multiple Jodit instances with different configurations in the same Express app:

```typescript
import express, { Router } from 'express';
import { createApp } from 'jodit-nodejs';

const myApp = express();

// Public file browser (read-only for guests)
const publicRouter = Router();
createApp({
  sources: {
    public: {
      name: 'public',
      title: 'Public Files',
      root: '/var/www/public',
      baseurl: 'http://localhost:8081/public/'
    }
  },
  defaultRole: 'guest',
  accessControl: [
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false,
      FILE_REMOVE: false
    }
  ]
}, myApp, publicRouter);

myApp.use('/public', publicRouter);

// Admin file manager (full access for admins)
const adminRouter = Router();
createApp({
  sources: {
    admin: {
      name: 'admin',
      title: 'Admin Files',
      root: '/var/www/admin',
      baseurl: 'http://localhost:8081/admin/'
    }
  },
  defaultRole: 'guest',
  accessControl: [
    {
      role: 'guest',
      FILES: false
    },
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true
    }
  ]
}, myApp, adminRouter);

myApp.use('/admin', adminRouter);

myApp.listen(8081);

// Now you have two independent Jodit instances:
// GET /public/?action=files  -> Public files (read-only)
// GET /admin/?action=files   -> Admin files (full access)
```

**Key Points:**
- Each Jodit instance can have different configurations, sources, and access control rules
- Instances are isolated - they don't share state or configuration
- Custom middleware on the Express app applies to all Jodit instances
- Each router can be mounted at any path prefix

## API Endpoints

### GET /?action=files

Get list of files from source.

**Parameters:**
- `action` (required) - action name ("files")
- `source` (optional) - source name
- `path` (optional) - path within source (default: "/")
- `mods` (optional) - modifiers ("withFolders" to include folders)

**Examples:**

```bash
# Get all files from "test" source
curl "http://localhost:8081/?action=files&source=test"

# Get files with folders
curl "http://localhost:8081/?action=files&source=test&mods=withFolders"

# Get files from subfolder
curl "http://localhost:8081/?action=files&source=test&path=/subfolder"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": 220,
    "sources": [
      {
        "name": "test",
        "title": "Test Files",
        "baseurl": "http://localhost:8081/files/test/",
        "path": "/",
        "files": [
          {
            "file": "image.png",
            "name": "image.png",
            "type": "file",
            "size": 1024,
            "changed": "2025-01-01T00:00:00.000Z",
            "isImage": true
          }
        ]
      }
    ]
  }
}
```

### GET /ping

Health check endpoint.

**Response:**
```json
{
  "success": true
}
```

## Authentication & Access Control

For detailed authentication and access control guide, see **[authentication.md](./authentication.md)**.

### Quick Example

```typescript
import { start, type AuthCallback } from 'jodit-nodejs';

// Define authentication callback
const checkAuth: AuthCallback = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return 'guest'; // Default role for unauthenticated users
  }

  // Validate token and return user role
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload.role; // e.g., 'admin', 'editor', 'guest'
};

// Start server with authentication and access control
await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: [
      {
        role: 'guest',
        FILES: true,
        FILE_UPLOAD: false,
        FILE_REMOVE: false
      },
      {
        role: 'admin',
        FILES: true,
        FILE_UPLOAD: true,
        FILE_REMOVE: true
      }
    ]
  },
  checkAuthentication: checkAuth
});
```

### Key Features

- **Per-request authentication**: Each request is authenticated independently
- **Flexible authentication**: Support for cookies, JWT tokens, express-session, and custom methods
- **Role-based access control**: Define permissions based on user roles
- **Path-based restrictions**: Control access to specific folders
- **Extension filtering**: Restrict file types per role
- **Dynamic rules**: Use functions for complex permission logic

**See [authentication.md](./authentication.md) for:**
- Cookie-based authentication (like PHP `$_SESSION`)
- JWT token authentication
- Express-session integration
- Complete access control examples
- Security best practices

## Configuration

For detailed configuration reference, see **[config.md](./config.md)**.

### Quick Configuration Example

```typescript
import { start } from 'jodit-nodejs';

await start({
  port: 8081,
  config: {
    debug: false,
    allowCrossOrigin: true,
    maxUploadFileSize: '10mb',
    createThumb: true,
    thumbSize: 200,
    accessControl: [
      {
        role: 'guest',
        FILES: true,
        FILE_UPLOAD: false
      },
      {
        role: 'admin',
        FILES: true,
        FILE_UPLOAD: true,
        FILE_REMOVE: true
      }
    ],
    sources: {
      uploads: {
        name: 'uploads',
        title: 'User Uploads',
        root: '/var/www/uploads',
        baseurl: 'https://cdn.example.com/uploads/'
      }
    }
  }
});
```

**See [config.md](./config.md) for complete configuration reference.**

## Custom Storage Adapters

For detailed guide on creating custom storage adapters, see **[storage-adapters.md](./storage-adapters.md)**.

Jodit Connector supports custom storage adapters, allowing you to store files in any backend:
- **AWS S3** - Amazon Simple Storage Service
- **Azure Blob** - Microsoft Azure Blob Storage
- **Google Cloud Storage** - Google Cloud Platform storage
- **FTP/SFTP** - Remote file servers
- **In-Memory** - For testing and development
- **Custom backends** - Database, API, or any other storage

### Quick Example

```typescript
import { start } from 'jodit-nodejs';
import { AwsS3StorageAdapter } from '@flystorage/aws-s3';
import { S3Client } from '@aws-sdk/client-s3';

// Create S3 client
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

// Create S3 adapter
const s3Adapter = new AwsS3StorageAdapter(s3Client, {
  bucket: 'my-bucket',
  prefix: 'uploads/'
});

// Use custom adapter
await start({
  port: 8081,
  config: {
    sources: {
      s3: {
        name: 's3',
        root: '/uploads',
        baseurl: 'https://my-bucket.s3.amazonaws.com/uploads',
        storageAdapter: s3Adapter // Use S3 instead of local filesystem
      }
    }
  }
});
```

**See [storage-adapters.md](./storage-adapters.md) for:**
- Complete storage adapter interface documentation
- In-memory adapter implementation example
- AWS S3, Azure Blob, Google Cloud Storage examples
- Creating custom adapters
- Testing adapters
- Best practices and troubleshooting

## Tests

All tests use Jest + Supertest for integration testing:
- Integration tests covering all scenarios
- Automatic test data cleanup
- Test isolation with separate app instances
- Config validation tests

Run tests:
```bash
npm test                # All tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

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
- Debug/info/warn/error levels

### Configuration
- Full config like PHP version (50+ options)
- Runtime config merging (startup + custom_config)
- Custom config via query (debug mode only)
- Zod validation on startup and runtime

### Architecture
- Factory pattern with `createApp()`
- Middleware-based validation
- Handler-specific validation
- Separation of concerns (v1 handlers, middlewares, schemas)

### OpenAPI Documentation
- **Auto-generated** from Zod schemas
- Schemas annotated with `.openapi()` metadata
- Generates `openapi.yaml`, `openapi.json`, and Swagger UI HTML
- Single source of truth - schemas used for validation AND documentation
- Run `npm run docs:generate` to update

## Docker Deployment

The application includes a multi-stage Dockerfile for optimized production builds:

### Build and Run
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Or manually
docker build -t jodit-nodejs .
docker run --rm -p 8081:8081 jodit-nodejs
```

### Docker Configuration

The Docker image includes a default configuration file at `/usr/src/app/config.json` that can be customized.

```bash
# With custom config file (recommended approach):
docker run --rm -p 8081:8081 \
  -v /host/path/to/config.json:/usr/src/app/config.json \
  -v /host/path/to/files:/usr/src/app/files \
  jodit-nodejs

# With environment variables:
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SOURCE_NAME="Production Files" \
  -e SOURCE_ROOT="/var/www/uploads" \
  -e SOURCE_BASEURL="https://cdn.example.com/uploads/" \
  jodit-nodejs

# With volume mount for files:
docker run --rm -p 8081:8081 \
  -v /host/path/to/files:/usr/src/app/files \
  jodit-nodejs

# Override with inline JSON config:
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e CONFIG='{"debug":false,"allowCrossOrigin":true,"sources":{"production":{"title":"Production","root":"/usr/src/app/files","baseurl":"https://cdn.example.com/files/"}}}' \
  jodit-nodejs
```

**Configuration Priority:**
1. `CONFIG` environment variable (highest priority)
2. `CONFIG_FILE` environment variable (default: `/usr/src/app/config.json` in Docker)
3. Default configuration from code

### Docker Image Details
- **Base image**: Node.js 24 (builder) → Node.js 24-alpine (runtime)
- **Multi-stage build**: Reduces final image size
- **Production optimized**: Prunes dev dependencies
- **Port**: 8081 (exposed)

### Dockerfile Stages
1. **Builder stage**: Installs all deps, compiles TypeScript
2. **Runtime stage**: Copies only dist and production node_modules
3. **Lightweight**: Alpine Linux for minimal footprint

## CI/CD

### Workflows

**`connector.yml`** - Main CI/CD pipeline:
- **Push to main** - runs tests and linter
- **Pull requests** - runs tests and linter
- **Tags** - builds and pushes Docker image to DockerHub, publishes to npm

Jobs:
1. **test** - Runs linter, tests, and build
2. **docker** - Builds multi-arch image and pushes to DockerHub (only on tags)
3. **publish** - Publishes package to npm registry (only on tags)

**`docs.yml`** - Documentation deployment:
- **Push to main** (if source files changed) - generates and deploys OpenAPI docs to GitHub Pages
- **Manual trigger** - can be triggered manually from Actions tab

Jobs:
1. **build** - Generates OpenAPI documentation
2. **deploy** - Deploys to GitHub Pages

### Required Secrets
- `DOCKERHUB_USERNAME` - DockerHub username
- `DOCKERHUB_TOKEN` - DockerHub access token
- `NPM_TOKEN` - npm access token with publish permissions

**How to create npm token:**
1. Login to npm: `npm login`
2. Create automation token: `npm token create --type=automation`
3. Add token to GitHub repository secrets as `NPM_TOKEN`

**How to enable GitHub Pages:**
1. Go to repository Settings → Pages
2. Under "Build and deployment", select "Source: GitHub Actions"
3. The documentation will be automatically deployed on next push to main

### Release Process
```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Create and push a tag
git tag v1.0.1
git push origin v1.0.1

# GitHub Actions will automatically:
# - Run tests
# - Build Docker image
# - Push to DockerHub as latest and v1.0.1
# - Publish to npm registry with provenance
```

**Published package:**
- npm: `npm install jodit-nodejs`
- DockerHub: `docker pull chupurnov/jodit-nodejs:latest`

**For detailed deployment instructions, see [deployment.md](./deployment.md)**

## Differences from PHP Version

- **Async/await** instead of synchronous operations
- **TypeScript** for compile-time type safety
- **Zod** for runtime validation
- **Express 5.x** instead of built-in PHP server
- **Winston** for structured logging
- **@hapi/boom** for error handling
- **Jest** instead of Codeception
