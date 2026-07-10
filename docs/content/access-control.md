---
title: Access Control (ACL)
description: Role-based access control in Jodit Connector Node.js, covering static rules, dynamic rules, and advanced permissions.
---

# Access Control (ACL)

Jodit Connector Node.js checks every request against a list of access control rules before executing it.

## Table of Contents

- [Overview](#overview)
- [Basic Rules](#basic-rules)
- [Available Actions](#available-actions)
- [Rule Matching](#rule-matching)
- [Dynamic Rules with Functions](#dynamic-rules-with-functions)
- [Dynamic Access Control](#dynamic-access-control)
- [Advanced Examples](#advanced-examples)

## Overview

Access Control Lists (ACL) define fine-grained permissions based on user role, path, and file extensions. Rules can be static (defined at startup) or dynamic (loaded from database, API, or computed at runtime).

## Basic Rules

### Rule Structure

```typescript
interface AccessControlRule {
  role?: string;           // User role or '*' for all
  path?: string;           // Path restriction
  extensions?: string[];   // Allowed file extensions
  [action: string]: boolean | Function;  // Action permissions
}
```

### Example Configuration

```typescript
const config = {
  defaultRole: 'guest',
  accessControl: [
    // General rules first (less specific)
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false,
      FILE_REMOVE: false
    },
    // Specific rules override general rules
    {
      role: 'guest',
      path: '/private',
      FILES: false // Deny access to /private folder
    },
    {
      role: 'user',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: false,
      FOLDER_CREATE: true
    },
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true,
      FOLDER_CREATE: true,
      FOLDER_REMOVE: true
    },
    {
      role: 'editor',
      extensions: ['jpg', 'png', 'gif'], // Only images
      FILE_UPLOAD: true,
      FILE_REMOVE: false
    },
    {
      role: '*', // Wildcard - matches all roles
      path: '/public',
      FILES: true
    }
  ]
};
```

## Available Actions

| Action | Description |
|--------|-------------|
| `FILES` | List files |
| `FILE_UPLOAD` | Upload files |
| `FILE_UPLOAD_REMOTE` | Upload from URL |
| `FILE_REMOVE` | Delete files |
| `FILE_MOVE` | Move files |
| `FILE_RENAME` | Rename files |
| `FILE_DOWNLOAD` | Download files |
| `FOLDERS` | List folders |
| `FOLDER_CREATE` | Create folders |
| `FOLDER_REMOVE` | Delete folders |
| `FOLDER_MOVE` | Move folders |
| `FOLDER_RENAME` | Rename folders |
| `IMAGE_RESIZE` | Resize images |
| `IMAGE_CROP` | Crop images |
| `GENERATE_PDF` | Generate PDF |
| `GENERATE_DOCX` | Generate DOCX |

## Rule Matching

Rules are processed in order, from general to specific, and later rules override earlier ones for the same role and action. A rule's role matches exactly or via the wildcard (`'*'`). Path matching checks whether the request path starts with the rule path, and extension matching filters by file extension.

## Dynamic Rules with Functions

For complex logic, use functions instead of boolean values:

```typescript
{
  role: 'editor',
  extensions: (action, rule, path, ext) => {
    // Custom logic for allowed extensions
    if (path.startsWith('/images')) {
      return ['jpg', 'png', 'gif'];
    }
    if (path.startsWith('/documents')) {
      return ['pdf', 'doc', 'docx'];
    }
    return ['*']; // Allow all in other folders
  },
  FILE_UPLOAD: (action, rule, path, ext) => {
    // Custom logic for upload permission
    return path !== '/protected';
  },
  FILE_REMOVE: (action, rule, path, ext) => {
    // Only allow removing own files
    return path.startsWith(`/users/${getUserId(rule)}`);
  }
}
```

## Dynamic Access Control

Access control rules can be loaded dynamically from external sources like databases, APIs, or cache systems.

### Static vs Dynamic Rules

**Static rules** (array):
```typescript
{
  accessControl: [
    { role: 'guest', FILES: true, FILE_UPLOAD: false },
    { role: 'admin', FILES: true, FILE_UPLOAD: true }
  ]
}
```
Static rules are simple and fast, with no database calls, but they are fixed at startup: updating them requires a restart.

**Dynamic rules** (async function):
```typescript
{
  accessControl: async () => {
    const rules = await loadFromDatabase();
    return rules;
  }
}
```
Dynamic rules are loaded fresh on every check, so updates take effect without a restart and the rules can be managed centrally. Loading them adds latency to every request, so use caching.

### Loading Rules from Database

```typescript
import { start } from 'jodit-nodejs';
import { database } from './database';

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    // Load ACL rules from database on every permission check
    accessControl: async () => {
      const rules = await database.query(`
        SELECT role, action, allowed
        FROM acl_rules
        WHERE active = true
        ORDER BY priority
      `);

      // Transform database rows to AccessControlRule format
      const rulesByRole: Record<string, any> = {};

      for (const row of rules) {
        if (!rulesByRole[row.role]) {
          rulesByRole[row.role] = { role: row.role };
        }
        rulesByRole[row.role][row.action] = row.allowed;
      }

      return Object.values(rulesByRole);
    }
  }
});
```

### Caching for Performance

Loading rules from database on every permission check can be slow. Add caching:

```typescript
import { start } from 'jodit-nodejs';
import { database } from './database';

// Simple in-memory cache
let cachedRules: AccessControlRule[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 minute

async function loadACLRules(): Promise<AccessControlRule[]> {
  const now = Date.now();

  // Return cached rules if still valid
  if (cachedRules && now < cacheExpiry) {
    return cachedRules;
  }

  // Load fresh rules from database
  const rules = await database.query(`
    SELECT role, action, allowed
    FROM acl_rules
    WHERE active = true
  `);

  const rulesByRole: Record<string, any> = {};
  for (const row of rules) {
    if (!rulesByRole[row.role]) {
      rulesByRole[row.role] = { role: row.role };
    }
    rulesByRole[row.role][row.action] = row.allowed;
  }

  cachedRules = Object.values(rulesByRole);
  cacheExpiry = now + CACHE_TTL;

  return cachedRules;
}

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: loadACLRules
  }
});
```

### Loading Rules from Redis

```typescript
import { start } from 'jodit-nodejs';
import Redis from 'ioredis';

const redis = new Redis();

async function loadACLFromRedis(): Promise<AccessControlRule[]> {
  // Try to get cached rules
  const cached = await redis.get('acl:rules');

  if (cached) {
    return JSON.parse(cached);
  }

  // Load from primary source (database)
  const rules = await loadFromDatabase();

  // Cache for 5 minutes
  await redis.setex('acl:rules', 300, JSON.stringify(rules));

  return rules;
}

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: loadACLFromRedis
  }
});
```

### Loading Rules from API

```typescript
import { start } from 'jodit-nodejs';
import fetch from 'node-fetch';

async function loadACLFromAPI(): Promise<AccessControlRule[]> {
  const response = await fetch('https://api.example.com/acl/rules', {
    headers: {
      'Authorization': `Bearer ${process.env.API_TOKEN}`
    }
  });

  if (!response.ok) {
    // Fallback to safe defaults on error
    return [
      { role: 'guest', FILES: true, FILE_UPLOAD: false }
    ];
  }

  const data = await response.json();
  return data.rules;
}

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: loadACLFromAPI
  }
});
```

### Synchronous Function (Computed Rules)

For rules that depend on application state but don't need async operations:

```typescript
import { start } from 'jodit-nodejs';

// Rules computed from environment
function getACLRules(): AccessControlRule[] {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Strict rules in production
    return [
      { role: 'guest', FILES: true, FILE_UPLOAD: false },
      { role: 'user', FILES: true, FILE_UPLOAD: true, FILE_REMOVE: false },
      { role: 'admin', FILES: true, FILE_UPLOAD: true, FILE_REMOVE: true }
    ];
  } else {
    // Relaxed rules in development
    return [
      { role: '*', FILES: true, FILE_UPLOAD: true, FILE_REMOVE: true }
    ];
  }
}

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: getACLRules  // Sync function
  }
});
```

### Best Practices for Dynamic Rules

1. Cache database/API calls to avoid performance issues
2. Set the cache TTL based on how often rules change
3. Provide fallback rules in case loading fails
4. Monitor performance: async rule loading adds latency to every request
5. Use sync functions when rules depend only on application state
6. Log rule changes for audit and debugging
7. Test failure scenarios (database down, API timeout, etc.)

### Complete Example with Error Handling

```typescript
import { start } from 'jodit-nodejs';
import { database } from './database';
import { logger } from './logger';

let cachedRules: AccessControlRule[] = [
  // Safe defaults as fallback
  { role: 'guest', FILES: true, FILE_UPLOAD: false }
];
let cacheExpiry = 0;

async function loadACL(): Promise<AccessControlRule[]> {
  const now = Date.now();

  // Return cached rules if valid
  if (now < cacheExpiry) {
    return cachedRules;
  }

  try {
    // Load fresh rules from database
    const rules = await database.query('SELECT * FROM acl_rules');

    const transformed = transformRules(rules);

    // Update cache
    cachedRules = transformed;
    cacheExpiry = now + 60000; // 1 minute

    logger.info(`Loaded ${transformed.length} ACL rules from database`);

    return transformed;
  } catch (error) {
    logger.error('Failed to load ACL rules from database:', error);

    // Return last successful cache or defaults
    return cachedRules;
  }
}

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: loadACL
  }
});
```

## Advanced Examples

### Multi-source Permissions

Different permissions for different file sources:

```typescript
const config = {
  defaultRole: 'guest',
  sources: {
    public: {
      name: 'public',
      title: 'Public Files',
      root: '/var/www/public',
      baseurl: 'https://cdn.example.com/public/'
    },
    private: {
      name: 'private',
      title: 'Private Files',
      root: '/var/www/private',
      baseurl: 'https://cdn.example.com/private/'
    }
  },
  accessControl: [
    // Guest can view public files only
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false
    },
    // User can upload to public, view private
    {
      role: 'user',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: false
    },
    // Admin has full access
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true,
      FOLDER_CREATE: true
    }
  ]
};
```

### Role-based File Filtering

Show different files to different roles:

```typescript
const config = {
  accessControl: [
    {
      role: 'guest',
      path: '/public',
      FILES: true,
      FILE_UPLOAD: false
    },
    {
      role: 'guest',
      path: '/private',
      FILES: false // Guest cannot see private files
    },
    {
      role: 'user',
      path: '/public',
      FILES: true,
      FILE_UPLOAD: true
    },
    {
      role: 'user',
      path: '/private',
      FILES: true, // User can see private files
      FILE_UPLOAD: false
    },
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true
    }
  ]
};
```

## Next Steps

- **[Authentication](./authentication.md)** - Learn about authentication methods
- **[Configuration](./config.md)** - Explore all configuration options
- **[API Usage](./api-usage.md)** - See complete usage examples
