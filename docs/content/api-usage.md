---
title: API Usage
description: Complete API usage examples for TypeScript, CommonJS, and ES Modules.
---

# API Usage

Jodit Connector Node.js exposes `start`, `stop`, and `createApp` functions that work from TypeScript, CommonJS, and ES Modules.

## TypeScript

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
        // NGINX or CDN base URL for accessing files
        baseurl: 'http://localhost:8080/uploads/'
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

## JavaScript (CommonJS)

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
        // NGINX or CDN base URL for accessing files
        baseurl: 'http://localhost:8080/uploads/'
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

## JavaScript (ES Modules)

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
        // NGINX or CDN base URL for accessing files
        baseurl: 'http://localhost:8080/uploads/'
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

## Usage Examples

Check the `examples/` directory in the repository for complete working examples:

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

# Run with cookie authentication
node examples/with-cookie-auth.js

# Run with JWT token authentication
node examples/with-jwt-auth.js

# Run with express-session
node examples/with-express-session.js
```

## Next Steps

- **[Express Integration](./express-integration.md)** - Integrate with existing Express apps
- **[API Reference](./api.md)** - Complete API endpoints documentation
- **[Authentication](./authentication.md)** - Set up authentication methods
- **[Access Control](./access-control.md)** - Configure permissions and ACL rules
- **[Configuration](./config.md)** - Explore all configuration options
