/**
 * Example: Authentication using cookies (like PHP $_SESSION)
 *
 * This demonstrates how to use checkAuthentication callback to read user role
 * from cookies, similar to how PHP reads from $_SESSION['JoditUserRole'].
 *
 * In this example:
 * - User role is stored in a cookie named 'userRole'
 * - Each request extracts the role from the cookie
 * - This is per-request authentication (not global)
 */

const { start } = require('../dist/index.js');

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
          baseurl: 'http://localhost:8080/files/uploads/'
        }
      }
    },
    // This callback is called for EACH request to determine user role
    checkAuthentication: async req => {
      // Parse cookies (in production use cookie-parser middleware)
      const cookies = {};
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          cookies[name] = value;
        });
      }

      // Read role from cookie (like PHP $_SESSION['JoditUserRole'])
      const userRole = cookies.userRole;

      if (!userRole) {
        // No cookie - use guest role
        return 'guest';
      }

      console.log(`User authenticated with role: ${userRole} (from cookie)`);
      return userRole;
    }
  });

  console.log('Server started on http://localhost:8081');
  console.log('\nAuthentication works via cookies (per-request)');
  console.log('\nTry these commands:\n');

  console.log('# Request without cookie (guest role)');
  console.log('curl "http://localhost:8081/?action=permissions&source=uploads"\n');

  console.log('# Request with editor role cookie');
  console.log(
    'curl -H "Cookie: userRole=editor" "http://localhost:8081/?action=permissions&source=uploads"\n'
  );

  console.log('# Request with admin role cookie');
  console.log(
    'curl -H "Cookie: userRole=admin" "http://localhost:8081/?action=permissions&source=uploads"\n'
  );

  console.log('# Try to upload file as guest (should fail)');
  console.log(
    'curl -X POST "http://localhost:8081/?action=fileUpload&source=uploads" -F "files[0]=@./README.md"\n'
  );

  console.log('# Try to upload file as admin (should succeed)');
  console.log(
    'curl -X POST -H "Cookie: userRole=admin" "http://localhost:8081/?action=fileUpload&source=uploads" -F "files[0]=@./README.md"\n'
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
