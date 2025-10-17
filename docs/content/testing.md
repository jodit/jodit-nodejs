---
title: Testing
description: Testing guide for Jodit Connector Node.js - running tests, test architecture, and coverage.
---

# Testing

Jodit Connector Node.js uses Jest and Supertest for comprehensive integration testing.

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

## Test Architecture

All tests use **Jest + Supertest** for integration testing:

- **Integration tests** covering all scenarios
- **Automatic test data cleanup** after each test suite
- **Test isolation** with separate app instances
- **Config validation** tests
- **Access control** tests
- **File operations** tests
- **Express integration** tests

### Test Structure

```
src/tests/
├── integration/
│   ├── access-control.test.ts       # ACL and permissions tests
│   ├── action-aliases.test.ts       # Action alias tests
│   ├── auth.test.ts                 # Authentication tests
│   ├── express-integration.test.ts  # Express integration tests
│   ├── files.test.ts                # File operations tests
│   └── ...
└── test-server.ts                   # Test utilities and helpers
```

## Test Features

### Test Isolation

Each test creates its own Express app instance to ensure complete isolation:

```typescript
describe('File Operations', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp(customConfig);
  });

  it('should upload a file', async () => {
    const response = await request(app)
      .post('/?action=fileUpload')
      .attach('files[]', Buffer.from('test'), 'test.txt');

    expect(response.status).toBe(200);
  });
});
```

### Automatic Cleanup

Test files are automatically cleaned up after each suite:

```typescript
beforeAll(async () => {
  await createTestFile('test.txt', 'test content');
});

afterAll(async () => {
  await cleanupTestFiles();
});
```

### Coverage

Run tests with coverage to see which parts of the code are tested:

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory.

## Writing Tests

### Example Test

```typescript
import request from 'supertest';
import { createApp } from '../app';

describe('Custom Feature', () => {
  const app = createApp({
    sources: {
      test: {
        name: 'test',
        root: './files/test',
        baseurl: 'http://localhost:8081/files/test/'
      }
    }
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/?action=files&source=test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

## Continuous Integration

Tests run automatically on every push via GitHub Actions. See **[Deployment Guide](./deployment.md)** for CI/CD details.

## Next Steps

- **[Architecture](./architecture.md)** - Learn about the application architecture
- **[Deployment](./deployment.md)** - CI/CD and deployment guide
