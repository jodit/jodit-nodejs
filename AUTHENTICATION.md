# Authentication & Access Control

This document provides a comprehensive guide to implementing authentication and access control in Jodit Connector Node.js.

## Table of Contents

- [Overview](#overview)
- [Authentication Callback](#authentication-callback)
- [Authentication Examples](#authentication-examples)
  - [Cookie-based Authentication](#cookie-based-authentication)
  - [JWT Token Authentication](#jwt-token-authentication)
  - [Express-Session Integration](#express-session-integration)
- [Access Control Rules](#access-control-rules)
- [Advanced Examples](#advanced-examples)
- [Security Best Practices](#security-best-practices)

---

## Overview

Jodit Connector uses a **per-request authentication** model where each request is authenticated independently. This is different from global authentication - each user can have their own role based on their credentials (cookies, tokens, etc.).

### Key Concepts

- **checkAuthentication**: A callback function that receives each request and returns the user's role
- **defaultRole**: Fallback role used when no authentication is provided
- **accessControl**: Rules that define what each role can do
- **Per-request**: Every request is authenticated separately (no global state)

### How It Works

1. Client sends a request with credentials (cookie, JWT token, session ID, etc.)
2. `checkAuthentication` callback is invoked with the request
3. Callback validates credentials and returns a user role (e.g., 'admin', 'guest')
4. Access control middleware checks if the role has permission for the requested action
5. If permitted, the request proceeds; otherwise, it's rejected with 403 Forbidden

---

## Authentication Callback

The `checkAuthentication` callback is the core of the authentication system.

### Signature

```typescript
type AuthCallback = (req: Request) => string | Promise<string>;
```

### Parameters

- **req**: Express `Request` object containing headers, cookies, body, etc.

### Return Value

- **string**: User role (e.g., `'admin'`, `'editor'`, `'guest'`)
- **Promise<string>**: Async user role (for database lookups, API calls, etc.)
- **throws Error**: Authentication failed (401 Unauthorized returned to client)

### Basic Example

```typescript
import { start, type AuthCallback } from 'jodit-nodejs';

const checkAuth: AuthCallback = async (req) => {
  // Read token from headers
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new Error('No authorization token provided');
  }

  // Validate token (example with JWT)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role; // Return user role
  } catch (error) {
    throw new Error('Invalid token');
  }
};

await start({
  port: 8081,
  config: {
    defaultRole: 'guest', // Fallback when no auth
    accessControl: [
      // Define permissions (see below)
    ]
  },
  checkAuthentication: checkAuth
});
```

### Important Notes

- **Called for EVERY request**: The callback runs on each API call
- **Synchronous or asynchronous**: Can return a role directly or a Promise
- **Per-user**: Different users can have different roles simultaneously
- **No global state**: Each request is independent
- **Error handling**: Throwing an error rejects the request with 401

---

## Authentication Examples

### Cookie-based Authentication

Similar to PHP `$_SESSION` - reads user role from a cookie.

```typescript
import { start } from 'jodit-nodejs';

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
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
    ]
  },
  // This callback is called for EACH request
  checkAuthentication: async (req) => {
    // Parse cookies (in production use cookie-parser middleware)
    const cookies = {};
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        cookies[name] = value;
      });
    }

    // Read role from cookie (like PHP $_SESSION['JoditUserRole'])
    return cookies.userRole || 'guest';
  }
});
```

**Usage Example:**
```bash
# Request without cookie (uses 'guest' role)
curl "http://localhost:8081/?action=files&source=uploads"

# Request with admin cookie
curl -H "Cookie: userRole=admin" "http://localhost:8081/?action=files&source=uploads"
```

**Complete example:** See `examples/with-cookie-auth.js`

---

### JWT Token Authentication

Validates JWT tokens from `Authorization` header.

```typescript
import { start } from 'jodit-nodejs';
import jwt from 'jsonwebtoken';

await start({
  port: 8081,
  config: {
    defaultRole: 'guest',
    accessControl: [
      {
        role: 'guest',
        FILES: true,
        FILE_UPLOAD: false
      },
      {
        role: 'user',
        FILES: true,
        FILE_UPLOAD: true,
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
  // This callback is called for EACH request
  checkAuthentication: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return 'guest'; // No token = guest role
    }

    try {
      // Verify JWT token
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload.role; // Return role from token payload
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
});
```

**JWT Payload Example:**
```json
{
  "userId": "12345",
  "username": "john",
  "role": "admin",
  "exp": 1735689600
}
```

**Usage Example:**
```bash
# Generate token (use https://jwt.io or jsonwebtoken library)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Request with token
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/?action=fileUpload&source=uploads" \
  -F "files[0]=@./image.jpg"
```

**Complete example:** See `examples/with-jwt-auth.js`

---

### Express-Session Integration

Most similar to PHP `$_SESSION` - uses server-side session storage.

```typescript
import express from 'express';
import session from 'express-session';
import { createApp } from 'jodit-nodejs';

const app = express();

// Setup express-session (analog of PHP sessions)
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Create Jodit connector app
const joditApp = createApp({
  defaultRole: 'guest',
  accessControl: [
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false
    },
    {
      role: 'user',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: false
    },
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true
    }
  ]
});

// Set checkAuthentication to read from express-session
// This is called for EACH request and reads role from THIS user's session
joditApp.locals.checkAuthentication = async (req) => {
  // Read role from session (like PHP: $_SESSION['JoditUserRole'])
  return req.session.userRole || 'guest';
};

// Demo endpoint to simulate login
app.get('/login/:role', (req, res) => {
  const role = req.params.role;

  if (!['guest', 'user', 'admin'].includes(role)) {
    return res.status(400).send('Invalid role');
  }

  // Store role in session (like PHP: $_SESSION['JoditUserRole'] = $role)
  req.session.userRole = role;
  res.send(`Logged in as ${role}. Session ID: ${req.sessionID}`);
});

// Demo endpoint to logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Logout failed');
    }
    res.send('Logged out successfully');
  });
});

// Mount Jodit connector
app.use('/', joditApp);

app.listen(8081, () => {
  console.log('Server running on http://localhost:8081');
});
```

**Usage Example:**
```bash
# Login as admin (creates session)
curl -c cookies.txt "http://localhost:8081/login/admin"

# Upload file (uses admin role from session)
curl -b cookies.txt \
  -X POST "http://localhost:8081/?action=fileUpload&source=uploads" \
  -F "files[0]=@./image.jpg"

# Logout (destroys session)
curl -b cookies.txt "http://localhost:8081/logout"
```

**Key Points:**
- Each user gets their own session with their own role (just like PHP `$_SESSION`)
- Session ID is sent to client as a cookie
- Server stores session data (role, user info, etc.)
- Different users can have different roles simultaneously
- No global state - authentication is per-request and per-user

**Complete example:** See `examples/with-express-session.js`

---

## Access Control Rules

Define fine-grained permissions based on role, path, and file extensions.

### Basic Structure

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

### Available Actions

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

### Rule Matching

- **Order matters**: Rules are processed in order (general → specific)
- **Later rules override earlier ones** for the same role/action
- **Role matching**: Exact match or wildcard (`'*'`)
- **Path matching**: Checks if request path starts with rule path
- **Extension matching**: Filters by file extension

### Dynamic Rules with Functions

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

---

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

### Database-based Authentication

Authenticate users from a database:

```typescript
import { start } from 'jodit-nodejs';
import { getUserByToken } from './database';

await start({
  port: 8081,
  config: { /* ... */ },
  checkAuthentication: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return 'guest';
    }

    try {
      // Lookup user in database
      const user = await getUserByToken(token);

      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('User account is disabled');
      }

      // Return user's role
      return user.role;
    } catch (error) {
      throw new Error('Authentication failed');
    }
  }
});
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

---

## Security Best Practices

### 1. Always Use HTTPS in Production

```typescript
// For express-session
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: true,  // Only send cookie over HTTPS
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'strict' // Prevent CSRF
  }
}));
```

### 2. Validate and Sanitize Input

```typescript
checkAuthentication: async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return 'guest';
  }

  // Validate token format before verifying
  if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token)) {
    throw new Error('Invalid token format');
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET).role;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

### 3. Use Environment Variables for Secrets

```typescript
// .env file
JWT_SECRET=your-very-long-and-random-secret-key
SESSION_SECRET=another-very-long-and-random-secret-key

// In code
import dotenv from 'dotenv';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 4. Implement Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/jodit', limiter);
```

### 5. Log Authentication Attempts

```typescript
import { logger } from './logger';

checkAuthentication: async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const ip = req.ip;

  if (!token) {
    logger.info(`Anonymous access from ${ip}`);
    return 'guest';
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    logger.info(`User ${payload.userId} authenticated from ${ip} with role ${payload.role}`);
    return payload.role;
  } catch (error) {
    logger.warn(`Failed authentication attempt from ${ip}`);
    throw new Error('Invalid token');
  }
}
```

### 6. Set Appropriate Timeouts

```typescript
// For JWT tokens
const token = jwt.sign(
  { userId, role },
  process.env.JWT_SECRET,
  { expiresIn: '1h' } // Token expires in 1 hour
);

// For express-session
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // Session expires in 24 hours
  }
}));
```

### 7. Principle of Least Privilege

```typescript
// Default to most restrictive role
const config = {
  defaultRole: 'guest', // Not 'admin'!
  accessControl: [
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false,
      FILE_REMOVE: false
    },
    // Grant more permissions only to authenticated users
    {
      role: 'user',
      FILE_UPLOAD: true
    },
    {
      role: 'admin',
      FILE_REMOVE: true
    }
  ]
};
```

---

## See Also

- [CONFIG.md](./CONFIG.md) - Configuration reference (see `accessControl` and `defaultRole`)
- [examples/with-cookie-auth.js](./examples/with-cookie-auth.js) - Cookie authentication example
- [examples/with-jwt-auth.js](./examples/with-jwt-auth.js) - JWT authentication example
- [examples/with-express-session.js](./examples/with-express-session.js) - Express-session example
- [README.md](./README.md) - General documentation
