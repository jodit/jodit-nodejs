---
title: Architecture
description: Technical architecture and key features of Jodit Connector Node.js.
---

# Architecture

This page describes the technical architecture and key features of Jodit Connector Node.js.

## Input Validation

### Zod Schemas

All query parameters and configuration are validated using **Zod** schemas:

- Runtime validation with detailed error messages
- Type-safe validated data
- Single source of truth for validation and TypeScript types

```typescript
const filesSchema = z.object({
  action: z.literal('files'),
  source: z.string().optional(),
  path: z.string().optional(),
  mods: z.string().optional()
});

// Automatic validation in middleware
const validatedData = filesSchema.parse(req.query);
```

## Error Handling

### @hapi/boom

Structured error handling with **@hapi/boom**:

- Automatic error transformation to API format
- HTTP status codes
- Debug mode with stack traces

```typescript
if (!file.exists) {
  throw Boom.notFound('File not found');
}
```

## Logging

### Winston Logger

Structured logging with **Winston**:

- Custom log levels (debug, info, warn, error)
- Colored console output
- Silent mode for tests
- Contextual logging

```typescript
logger.info('File uploaded', {
  filename: file.name,
  size: file.size,
  user: req.user?.id
});
```

## Configuration

### Multi-level Configuration

Configuration is merged from multiple sources:

1. Default configuration
2. Config file (`CONFIG_FILE` env var)
3. JSON config (`CONFIG` env var)
4. Environment variables
5. Runtime custom config

```typescript
const config = new Config({
  ...defaultConfig,
  ...fileConfig,
  ...envConfig,
  ...customConfig
});
```

### Source-level Overrides

Each source can override global configuration:

```typescript
sources: {
  public: {
    name: 'public',
    root: '/public',
    // Override global config
    maxUploadFileSize: '5mb',
    allowedExtensions: ['jpg', 'png']
  }
}
```

## Application Factory

### createApp() Function

Factory pattern for creating Express apps:

```typescript
export function createApp(
  customConfig?: Partial<AppConfig>,
  existingApp?: Application,
  existingRouter?: Router
): Application {
  // Create or use existing app
  const app = existingApp || express();

  // Create config instance
  const configInstance = new Config(customConfig);

  // Create or use existing router
  const router = existingRouter || Router();

  // Apply middlewares to router
  router.use(corsMiddleware);
  router.use(authMiddleware);

  // Mount routes
  router.get('/ping', pingHandler);
  router.post('/', upload, actionHandler);

  // Mount router to app
  if (!existingRouter) {
    app.use('/', router);
  }

  return app;
}
```

### Benefits

- **Testability**: Easy to create isolated app instances for testing
- **Flexibility**: Can integrate with existing Express apps
- **Reusability**: Multiple instances with different configs
- **Middleware isolation**: Each router has its own middleware stack

## Middleware Architecture

### Middleware Chain

```
Request
  ↓
CORS Middleware
  ↓
Authentication Middleware
  ↓
Request Context Middleware
  ↓
Action Handler
  ↓
Response
```

### Config Attachment

Each router instance stores its config in a closure and attaches it to requests:

```typescript
router.use((req, res, next) => {
  req.app.locals.config = configInstance;
  next();
});
```

This enables multiple Jodit instances with different configs in the same Express app.

## Handler Architecture

### Separation of Concerns

```
src/
├── v1/                  # Version 1 handlers
│   ├── files/
│   │   ├── handler.ts   # Business logic
│   │   ├── files.test.ts # Tests
│   │   └── schemes/     # Validation schemas
│   ├── file-upload/
│   ├── file-remove/
│   └── ...
├── middlewares/         # Shared middleware
├── helpers/             # Utility functions
└── schemas/             # Shared schemas
```

Each handler is self-contained with:
- Business logic
- Validation schemas
- Tests

## OpenAPI Documentation

### Schema-driven Documentation

OpenAPI docs are auto-generated from Zod schemas:

```typescript
const filesSchema = z.object({
  action: z.literal('files')
}).openapi({
  description: 'Get list of files from source'
});
```

Benefits:
- Single source of truth
- Always in sync with validation
- Type-safe

Generate docs:
```bash
npm run docs:generate
```

## Access Control

### Multi-level ACL

Access control can be configured at multiple levels:

1. **Global ACL**: Default rules for all sources
2. **Source-level ACL**: Override rules per source
3. **Dynamic ACL**: Rules loaded from database/API at runtime

```typescript
// Static ACL
accessControl: [
  { role: 'guest', FILES: true, FILE_UPLOAD: false }
]

// Dynamic ACL function
accessControl: async (req) => {
  const rules = await loadRulesFromDB(req.user.id);
  return rules;
}

// Source-level override
sources: {
  public: {
    accessControl: [
      { role: 'guest', FILES: true }
    ]
  }
}
```

## Next Steps

- **[Testing](./testing.md)** - Learn about the test architecture
- **[Deployment](./deployment.md)** - CI/CD and deployment guide
- **[Configuration](./config.md)** - Explore all configuration options
