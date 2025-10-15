/**
 * Example: Authentication using express-session (most similar to PHP $_SESSION)
 *
 * This demonstrates how to integrate Jodit connector with express-session,
 * which is the closest analog to PHP's $_SESSION.
 *
 * In this example:
 * - express-session middleware stores session data server-side
 * - Session ID is sent to client as a cookie
 * - User role is stored in req.session.userRole
 * - This provides per-user session storage, just like PHP
 *
 * Install required packages:
 * npm install express express-session
 */

const express = require('express');
const session = require('express-session');
const { createApp } = require('../dist/index.js');

async function main() {
  // Create Express app
  const app = express();

  // Setup express-session (this is the analog of PHP sessions)
  app.use(
    session({
      secret: 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Create Jodit connector app
  const joditApp = createApp({
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
  });

  // Set checkAuthentication to read from express-session
  // This is called for EACH request and reads role from THIS user's session
  joditApp.locals.checkAuthentication = async req => {
    // Read role from session (like PHP: $_SESSION['JoditUserRole'])
    const userRole = req.session.userRole || 'guest';

    console.log(
      `Request from session: ${req.sessionID.substring(0, 8)}..., role: ${userRole}`
    );
    return userRole;
  };

  // Demo endpoints to manage session (simulate login/logout)
  app.get('/login/:role', (req, res) => {
    const role = req.params.role;
    if (!['guest', 'editor', 'admin'].includes(role)) {
      return res.status(400).send('Invalid role. Use: guest, editor, or admin');
    }

    // Store role in session (like PHP: $_SESSION['JoditUserRole'] = $role)
    req.session.userRole = role;

    res.send(
      `Logged in as ${role}. Session ID: ${req.sessionID}\n` +
        `Your session cookie will be sent with subsequent requests.\n` +
        `Try: curl -b cookies.txt "http://localhost:8081/?action=permissions&source=uploads"`
    );
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).send('Logout failed');
      }
      res.send('Logged out. Session destroyed.');
    });
  });

  app.get('/whoami', (req, res) => {
    const role = req.session.userRole || 'guest (not logged in)';
    res.send(`Current role: ${role}\nSession ID: ${req.sessionID}`);
  });

  // Mount Jodit connector on root path
  app.use('/', joditApp);

  // Start server
  const PORT = 8081;
  app.listen(PORT, () => {
    console.log(`Server started on http://localhost:8081`);
    console.log('\nThis example uses express-session (analog of PHP $_SESSION)');
    console.log('Each user has their own session with their own role.\n');

    console.log('Try these commands:\n');

    console.log('# 1. Check current role (will be guest initially)');
    console.log('curl -c cookies.txt "http://localhost:8081/whoami"\n');

    console.log('# 2. Login as editor (stores role in session)');
    console.log('curl -c cookies.txt "http://localhost:8081/login/editor"\n');

    console.log('# 3. Check permissions (will use editor role from session)');
    console.log(
      'curl -b cookies.txt "http://localhost:8081/?action=permissions&source=uploads"\n'
    );

    console.log('# 4. Login as admin');
    console.log('curl -b cookies.txt "http://localhost:8081/login/admin"\n');

    console.log('# 5. Check permissions again (now admin role)');
    console.log(
      'curl -b cookies.txt "http://localhost:8081/?action=permissions&source=uploads"\n'
    );

    console.log('# 6. Logout (destroy session)');
    console.log('curl -b cookies.txt "http://localhost:8081/logout"\n');

    console.log('# 7. Check permissions after logout (back to guest)');
    console.log(
      'curl -b cookies.txt "http://localhost:8081/?action=permissions&source=uploads"\n'
    );

    console.log('\nNOTE: Different users with different session cookies will have');
    console.log('different roles, just like in PHP with $_SESSION!\n');
  });

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
