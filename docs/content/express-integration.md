---
title: Express Integration
description: Integration patterns for using Jodit Connector with existing Express applications.
---

# Express Integration

Jodit Connector can be integrated with existing Express applications in multiple ways.

## 1. Standalone Mode (Default)

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

## 2. Integration with Existing Express App

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

## 3. Custom Router with Path Prefix

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

## 4. Multiple Jodit Instances

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

## Key Points

- Each Jodit instance can have different configurations, sources, and access control rules
- Instances are isolated - they don't share state or configuration
- Custom middleware on the Express app applies to all Jodit instances
- Each router can be mounted at any path prefix

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API endpoints documentation
- **[Authentication](./authentication.md)** - Set up authentication methods
- **[Access Control](./access-control.md)** - Configure permissions and ACL rules
- **[Configuration](./config.md)** - Explore all configuration options
