# Jodit Connector Application (Node.js)

[![CI/CD](https://github.com/jodit/jodit-nodejs/actions/workflows/connector.yml/badge.svg)](https://github.com/jodit/jodit-nodejs/actions/workflows/connector.yml)
[![Documentation](https://github.com/jodit/jodit-nodejs/actions/workflows/docs.yml/badge.svg)](https://jodit.github.io/jodit-nodejs/)
[![npm version](https://badge.fury.io/js/jodit-nodejs.svg)](https://www.npmjs.com/package/jodit-nodejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js/TypeScript implementation of the Jodit File Browser and Uploader connector.

Analog of the PHP version: [jodit-connector-application](https://github.com/xdan/jodit-connectors)

## Technology Stack

- **Node.js LTS** (v18+)
- **TypeScript** with strict typing
- **Express 5.x** for REST API
- **Zod** for runtime validation
- **@hapi/boom** for error handling
- **Winston** for logging
- **Jest + Supertest** for testing
- **ESLint + Prettier** for code quality
- **Nodemon** for development

## Installation

```bash
npm install
```

## Scripts

### Development
```bash
npm run dev          # Run with nodemon (hot reload)
```

### Production
```bash
npm run build        # Compile TypeScript
npm start            # Run compiled application
```

### Environment Variables

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

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run in watch mode
npm run test:coverage # Run with code coverage
```

### Linting
```bash
npm run lint         # Check code
npm run lint:fix     # Auto-fix issues
```

### Docker

The Docker image includes a default configuration file at `/usr/src/app/config.json` that can be customized.

```bash
npm run docker:build # Build Docker image
npm run docker:run   # Run container (port 8081)

# Or manually:
docker build -t jodit-nodejs .
docker run --rm -p 8081:8081 jodit-nodejs

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

### API Documentation

**Online Documentation:**
- 📖 [Swagger UI (GitHub Pages)](https://jodit.github.io/jodit-nodejs/)
- 📄 [OpenAPI Spec (YAML)](https://jodit.github.io/jodit-nodejs/openapi.yaml)
- 📄 [OpenAPI Spec (JSON)](https://jodit.github.io/jodit-nodejs/openapi.json)

**Generate locally:**
```bash
npm run docs:generate  # Generate OpenAPI docs

# Open docs/index.html in browser to view Swagger UI
```

**Note:** Due to the action-based API design (all endpoints on `/?action=X`), the auto-generated OpenAPI documentation may show only the last registered endpoint per HTTP method. For complete API documentation, refer to the "API Endpoints" and "Implemented Functions" sections below.

**Documentation is automatically deployed to GitHub Pages** on every push to main branch that modifies source files.

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
├── docs/                    # Generated OpenAPI documentation
├── .github/
│   └── workflows/
│       └── connector.yml    # CI/CD workflow (test, docker, npm publish)
├── package.json
├── tsconfig.json
├── jest.config.js
├── eslint.config.js
├── .prettierrc
├── README.md                # This file
├── AUTHENTICATION.md        # Authentication & access control guide
├── CONFIG.md                # Configuration reference
└── DEPLOYMENT.md            # Deployment guide
```

## Installation

```bash
npm install jodit-nodejs
```

## Quick Start Examples

Check the `examples/` directory for complete working examples:

- **`examples/basic-js.js`** - Simple server setup with CommonJS
- **`examples/with-auth-js.js`** - Server with checkAuthentication callback
- **`examples/with-cookie-auth.js`** - Cookie-based authentication (per-request)
- **`examples/with-jwt-auth.js`** - JWT token authentication (per-request)
- **`examples/with-express-session.js`** - express-session integration (like PHP `$_SESSION`)

Run examples:
```bash
# Build the package first
npm run build

# Run basic example
node examples/basic-js.js

# Run with authentication callback
node examples/with-auth-js.js

# Run with cookie authentication (per-request)
node examples/with-cookie-auth.js

# Run with JWT token authentication
node examples/with-jwt-auth.js

# Run with express-session (most similar to PHP $_SESSION)
node examples/with-express-session.js
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

### API Endpoints

#### GET /?action=files

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

#### GET /ping

Health check endpoint.

**Response:**
```json
{
  "success": true
}
```

## Authentication & Access Control

For detailed authentication and access control guide, see **[AUTHENTICATION.md](./AUTHENTICATION.md)**.

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

**See [AUTHENTICATION.md](./AUTHENTICATION.md) for:**
- Cookie-based authentication (like PHP `$_SESSION`)
- JWT token authentication
- Express-session integration
- Complete access control examples
- Security best practices

## Configuration

For detailed configuration reference, see **[CONFIG.md](./CONFIG.md)**.

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

**See [CONFIG.md](./CONFIG.md) for complete configuration reference.**

## Implemented Functions

- ✅ **actionFiles** - get list of files
- ✅ **actionFileUpload** - upload files
- ✅ **actionFileUploadRemote** - upload file from remote URL
- ✅ **actionFileRemove** - remove files
- ✅ **actionFileMove** - move files
- ✅ **actionFileRename** - rename files
- ✅ **actionFileDownload** - download file
- ✅ **actionGetLocalFileByUrl** - resolve local file by URL
- ✅ **actionFolderCreate** - create folders
- ✅ **actionFolderRemove** - remove folders
- ✅ **actionFolderMove** - move folders
- ✅ **actionFolderRename** - rename folders
- ✅ **actionFolders** - get folder tree
- ✅ **actionPermissions** - get permissions
- ✅ **actionImageResize** - resize images
- ✅ **actionImageCrop** - crop images
- ✅ **actionGenerateDocx** - generate DOCX documents from HTML
- ✅ **actionGeneratePdf** - generate PDF documents from HTML

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

### ✅ Input Validation
- **Zod schemas** for all query parameters and config
- Runtime validation with detailed error messages
- Type-safe validated data

### ✅ Error Handling
- **@hapi/boom** for structured errors
- Automatic error transformation to API format
- Debug mode with stack traces

### ✅ Logging
- **Winston** logger with custom levels
- Colored console output
- Silent mode for tests
- Debug/info/warn/error levels

### ✅ Configuration
- Full config like PHP version (50+ options)
- Runtime config merging (startup + custom_config)
- Custom config via query (debug mode only)
- Zod validation on startup and runtime

### ✅ Architecture
- Factory pattern with `createApp()`
- Middleware-based validation
- Handler-specific validation
- Separation of concerns (v1 handlers, middlewares, schemas)

### ✅ OpenAPI Documentation
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

**For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

## Differences from PHP Version

- **Async/await** instead of synchronous operations
- **TypeScript** for compile-time type safety
- **Zod** for runtime validation
- **Express 5.x** instead of built-in PHP server
- **Winston** for structured logging
- **@hapi/boom** for error handling
- **Jest** instead of Codeception

## License

MIT
