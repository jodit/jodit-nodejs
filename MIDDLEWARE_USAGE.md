# Middleware Usage Guide

This document explains how to use the new middleware system for handling request parameters and source resolution.

## Overview

We have introduced three key components to simplify handler development:

1. **`resolveParams` middleware** - Resolves whether parameters come from query string (GET) or body (POST)
2. **`resolveSource` middleware** - Resolves the source name, correctly handling empty strings
3. **`validateParams` helper** - Validates parameters using Zod schemas with consistent error handling

## Benefits

- **No more `req.method` checks** - Parameters are automatically resolved to `req.params_data`
- **Correct empty string handling** - Empty source strings now properly fall back to default source
- **DRY principle** - No need to repeat validation and source resolution code in every handler
- **Type safety** - Full TypeScript support with proper typing

## How to Use in Handlers

### Before (Old Pattern)

```typescript
export async function myHandler(req: Request, res: Response): Promise<void> {
  const config = req.app.locals.config as AppConfig;

  // Manual parameter resolution
  const params = req.method === 'POST' ? req.body : req.query;

  // Manual validation
  const queryValidation = MyQuerySchema.safeParse(params);
  if (queryValidation.success === false) {
    const messages = queryValidation.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    const boomError = Boom.badRequest('Validation failed');
    boomError.output.payload.messages = messages;
    throw boomError;
  }

  const query = queryValidation.data;

  // Manual source resolution (doesn't handle empty strings correctly!)
  const sourceName = query.source ?? config.defaultFilesKey;

  // More code...
}
```

### After (New Pattern)

```typescript
import { validateParams } from '../../helpers/validate-params';

export async function myHandler(req: Request, res: Response): Promise<void> {
  const config = req.app.locals.config;

  // Simple validation - parameters already resolved by middleware
  const query = validateParams(req.params_data ?? {}, MyQuerySchema);

  // Source already resolved by middleware (handles empty strings correctly!)
  const sourceName = req.sourceName!;

  // Your business logic here...
}
```

## Request Object Additions

The middleware adds these properties to the Express Request object:

- **`req.params_data`** - Contains either `req.query` (GET) or `req.body` (POST)
- **`req.sourceName`** - The resolved source name (from params or default)

## Middleware Chain

The middleware are already configured in `app.ts`:

```typescript
// For GET requests
app.get('/', resolveAction, resolveParams, resolveSource, accessControlMiddleware, getActionHandler);

// For POST requests
app.post('/', maybeApplyUpload, resolveAction, resolveParams, resolveSource, accessControlMiddleware, postActionHandler);
```

## Migration Checklist

When migrating a handler to use the new pattern:

1. ✅ Remove manual `req.method` checks for params
2. ✅ Replace manual validation code with `validateParams()`
3. ✅ Replace `query.source ?? config.defaultFilesKey` with `req.sourceName!`
4. ✅ Import `validateParams` helper
5. ✅ Run tests to ensure everything works

## Examples

### Example 1: permissions handler

```typescript
import { validateParams } from '../../helpers/validate-params';

export async function permissionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;
  const query = validateParams(req.params_data ?? {}, PermissionsQuerySchema);
  const sourceName = req.sourceName!;

  const sourceConfig = config.sources?.[sourceName];
  if (sourceConfig === undefined) {
    throw Boom.notFound('Source not found', ['Source not found']);
  }

  // Business logic...
}
```

### Example 2: file-download handler

```typescript
import { validateParams } from '../../helpers/validate-params';

export async function fileDownloadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;
  const query = validateParams(req.params_data ?? {}, FileDownloadQuerySchema);
  const sourceName = req.sourceName!;

  const sourceConfig = config.sources[sourceName];
  const sourcePath = query.path ?? '/';

  // Business logic...
}
```

## Testing

The new pattern supports both GET and POST requests automatically:

```typescript
// GET request
const response = await request(server).get('/').query({
  action: 'permissions',
  source: 'test'
});

// POST request (automatically handled!)
const response = await request(server).post('/').send({
  action: 'permissions',
  source: 'test'
});

// Empty source correctly uses default
const response = await request(server).post('/').send({
  action: 'permissions',
  source: '' // Will use defaultFilesKey
});
```

## Notes

- The middleware are applied to all routes, so all handlers can benefit from them
- TypeScript definitions are updated to include `req.params_data` and `req.sourceName`
- The old pattern will still work, but new code should use the new pattern
- Empty string handling: `source: ''` now correctly falls back to `defaultFilesKey` (previously `?? operator` didn't handle this)
