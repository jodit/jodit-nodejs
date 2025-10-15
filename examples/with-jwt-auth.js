/**
 * Example: Authentication using JWT tokens in headers
 *
 * This demonstrates how to use checkAuthentication callback to verify
 * JWT tokens and extract user role from the token payload.
 *
 * In this example:
 * - User sends JWT token in Authorization header
 * - Server verifies the token and extracts role from payload
 * - Each request is authenticated independently (per-request)
 *
 * Note: This is a simplified example. In production:
 * - Use a proper JWT library (jsonwebtoken, jose, etc.)
 * - Verify token signature with a secret key
 * - Handle token expiration
 * - Handle refresh tokens
 */

const { start } = require('../dist/index.js');

// Simulated JWT verification (in production use jsonwebtoken library)
function verifyJWT(token) {
  try {
    // In production: jwt.verify(token, SECRET_KEY)
    // For demo, we just decode the payload (NOT SECURE!)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

async function main() {
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
          role: 'editor',
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
      ],
      sources: {
        uploads: {
          title: 'Uploads',
          root: './files/uploads',
          baseurl: 'http://localhost:8081/files/uploads/'
        }
      }
    },
    // This callback is called for EACH request to determine user role
    checkAuthentication: async req => {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        // No token - use guest role
        return 'guest';
      }

      // Expected format: "Bearer <token>"
      const token = authHeader.replace(/^Bearer\s+/i, '');

      try {
        // Verify token and extract payload
        const payload = verifyJWT(token);

        if (!payload.role) {
          throw new Error('No role in token');
        }

        console.log(
          `User authenticated with role: ${payload.role} (from JWT, user: ${payload.username || 'unknown'})`
        );
        return payload.role;
      } catch (error) {
        console.error('JWT verification failed:', error.message);
        // Invalid token - reject with error
        throw new Error('Invalid or expired token');
      }
    }
  });

  console.log('Server started on http://localhost:8081');
  console.log('\nAuthentication works via JWT tokens (per-request)');
  console.log('\nTo test, you need to create JWT tokens with role in payload.');
  console.log(
    'You can use https://jwt.io to create test tokens (payload: {"role": "admin", "username": "john"})\n'
  );

  console.log('Example commands:\n');

  console.log('# Request without token (guest role)');
  console.log('curl "http://localhost:8081/?action=permissions&source=uploads"\n');

  console.log('# Request with JWT token (replace YOUR_TOKEN with actual JWT)');
  console.log(
    'curl -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:8081/?action=permissions&source=uploads"\n'
  );

  // Generate sample tokens for testing (NOT SECURE - just for demo)
  const createDemoToken = payload => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64'
    );
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `${header}.${payloadStr}.demo-signature`;
  };

  const editorToken = createDemoToken({
    username: 'john',
    role: 'editor',
    exp: Date.now() + 3600000
  });
  const adminToken = createDemoToken({
    username: 'admin',
    role: 'admin',
    exp: Date.now() + 3600000
  });

  console.log('\n--- Demo tokens (NOT SECURE - for testing only) ---');
  console.log(`\nEditor token:\n${editorToken}\n`);
  console.log(`Admin token:\n${adminToken}\n`);

  console.log('# Test with editor token:');
  console.log(
    `curl -H "Authorization: Bearer ${editorToken}" "http://localhost:8081/?action=permissions&source=uploads"\n`
  );

  console.log('# Test with admin token:');
  console.log(
    `curl -H "Authorization: Bearer ${adminToken}" "http://localhost:8081/?action=permissions&source=uploads"\n`
  );

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
