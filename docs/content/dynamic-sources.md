---
title: Dynamic sources (multi-tenant)
description: Resolve file sources per request with resolveSources, so one Jodit Connector instance can serve many tenants, each with its own bucket or directory.
---

# Dynamic sources (multi-tenant)

By default the connector builds its sources once, from `config.sources`, when the app starts. `resolveSources` turns that into a per-request decision: a callback looks at the incoming request, decides which tenant it belongs to, and returns the sources for that tenant. One process can then serve many customers, each with their own bucket, prefix or directory, without knowing them in advance.

## Table of Contents

- [How it works](#how-it-works)
- [Example: tenant from a header](#example-tenant-from-a-header)
- [Caching](#caching)
- [Authentication and roles](#authentication-and-roles)
- [CORS per tenant](#cors-per-tenant)
- [Falling back to static sources](#falling-back-to-static-sources)
- [Reference](#reference)

## How it works

1. A request arrives. Before authentication runs, the connector calls `resolveSources(req)`.
2. The callback returns `{ id, sources }` or `null`.
3. If it returned sources, the connector builds a `FileManagerService` for each of them (or takes the ones already built for that `id` from the cache) and pins them to the request. Every action in that request (`files`, `fileUpload`, `folderCreate` and so on) only sees these sources.
4. If it returned `null`, the request uses the static `config.sources` as usual.

The sources returned are full `SourceConfig` objects, the same shape as in `config.sources`. They can use the local filesystem, the built-in `s3` adapter or any adapter instance, and any per-source override (`extensions`, `maxUploadFileSize`, `createThumb`, ...) works too.

## Example: tenant from a header

A SaaS backend keeps one bucket per customer and puts the customer id in a header on the way through its API gateway:

```typescript
import { start, type ResolvedSources } from 'jodit-nodejs';
import { findTenant } from './tenants'; // your own lookup

await start({
  port: 8081,
  config: {
    allowCrossOrigin: true,
    resolveSources: async (req): Promise<ResolvedSources | null> => {
      const tenantId = req.header('x-tenant-id');
      if (tenantId === undefined) {
        return null;
      }

      const tenant = await findTenant(tenantId);
      if (tenant === null) {
        return null;
      }

      return {
        // Include anything that should invalidate the cache when it changes
        id: `${tenant.id}:${tenant.updatedAt}`,
        sources: {
          files: {
            name: 'files',
            title: tenant.name,
            baseurl: tenant.publicUrl,
            storageAdapter: 's3',
            s3: {
              bucket: tenant.bucket,
              region: tenant.region,
              prefix: tenant.prefix,
              credentials: tenant.credentials
            }
          }
        }
      };
    }
  }
});
```

Any request property can drive the decision: a header, a query parameter such as `?key=`, a cookie, a subdomain, a JWT claim.

## Caching

Building a source is cheap for the local filesystem but involves creating an S3 client for remote ones, and the thumbnail and listing code benefits from reusing the same instance. Resolved sources are therefore cached by `id`:

- Same `id` within the TTL: the resolver still runs (it is your authentication boundary), but the sources are reused.
- Different `id`, or the entry expired: sources are rebuilt.
- Least recently used entries are dropped when the cache is full.

Defaults are 200 tenants and 60 seconds. Both can be changed:

```typescript
config: {
  resolveSources,
  dynamicSourcesCache: { max: 1000, ttlMs: 5 * 60 * 1000 }
}
```

Put a version marker in the `id` (an `updatedAt` timestamp, a config hash) when tenant settings can change at runtime. That way a credentials update takes effect on the next request instead of after the TTL.

## Authentication and roles

`resolveSources` runs before `checkAuthentication`, and both see the same request. A common split is: the resolver identifies the tenant and stores what it found on the request, and the authentication callback turns that into a role.

```typescript
declare module 'express-serve-static-core' {
  interface Request {
    tenant?: Tenant;
  }
}

await start({
  config: {
    resolveSources: async req => {
      const tenant = await findTenantByApiKey(req.query.key);
      if (tenant === null) {
        return null;
      }
      req.tenant = tenant;
      return { id: tenant.id, sources: tenant.sources };
    }
  },
  checkAuthentication: req => {
    if (req.tenant === undefined) {
      throw Boom.unauthorized('Unknown tenant');
    }
    return verifyUserToken(req, req.tenant.jwtSecret); // returns a role name
  }
});
```

Roles then go through the normal [access control](./access-control.md) rules. Rules can look at the source path, so a tenant-specific rule set is possible by returning different `accessControl` functions, but most setups keep one global role matrix (`viewer`, `editor`, `admin`) and let the tenant decide which role a user gets.

## CORS per tenant

With `allowCrossOrigin: true` the connector echoes any `Origin` back. Multi-tenant setups usually want to allow only the tenant's own domains. `allowedOrigins` accepts a predicate that sees the request, so it can consult the same tenant lookup:

```typescript
config: {
  allowCrossOrigin: true,
  allowedOrigins: async (origin, req) => {
    const tenant = await findTenantByApiKey(req.query.key);
    return tenant !== null && tenant.domains.includes(new URL(origin).hostname);
  }
}
```

Preflight requests from other origins get a `403` and no CORS headers. The `Authorization` header is allowed on preflight, so per-user tokens can be sent from the browser.

## Falling back to static sources

Returning `null` (or `undefined`) from the resolver means "not a tenant request", and the static `config.sources` apply. This lets one instance serve a shared public source and tenant-specific ones at the same time. If `config.sources` is left out and only `resolveSources` is set, requests the resolver declines have no sources at all and every action answers `404 Source not found`.

## Reference

```typescript
interface ResolvedSources {
  /** Cache key for the tenant. Change it to force a rebuild. */
  id: string;
  sources: Record<string, SourceConfig>;
}

type SourcesResolver = (
  req: express.Request
) => ResolvedSources | null | undefined | Promise<ResolvedSources | null | undefined>;

interface AppConfig {
  resolveSources?: SourcesResolver;
  dynamicSourcesCache?: { max: number; ttlMs: number };
  allowedOrigins?: string[] | ((origin: string, req: express.Request) => boolean | Promise<boolean>);
}
```

`Config.clearDynamicSources()` drops every cached tenant; call it from an admin endpoint if you need an immediate flush without changing ids.
