---
title: Installation & Setup
description: Installation instructions, environment variables, and initial configuration for Jodit Connector Node.js.
---

# Installation & Setup

## Installation

Install Jodit Connector Node.js via npm:

```bash
npm install jodit-nodejs
```

## Environment Variables

You can configure the application using environment variables with npm or Docker:

### Using npm

```bash
# Basic setup - configure default source
SOURCE_NAME="My Files" \
SOURCE_ROOT="/var/www/uploads" \
SOURCE_BASEURL="http://localhost:8081/uploads/" \
npm start

# Production setup with custom port
SOURCE_NAME="Production Files" \
SOURCE_ROOT="/var/www/uploads" \
SOURCE_BASEURL="https://cdn.example.com/uploads/" \
PORT=8080 \
npm start

# Using full JSON configuration
CONFIG='{"debug":false,"allowCrossOrigin":true,"sources":{"production":{"name":"production","title":"Production Files","root":"/var/www/uploads","baseurl":"https://cdn.example.com/uploads/"}}}' \
PORT=8080 \
npm start

# Using config file
CONFIG_FILE="/etc/jodit/config.json" \
PORT=8080 \
npm start
```

### Using Docker

```bash
# Basic setup with environment variables
docker run --rm -p 8081:8081 \
  -e SOURCE_NAME="My Files" \
  -e SOURCE_ROOT="/usr/src/app/files" \
  -e SOURCE_BASEURL="http://localhost:8081/files/" \
  -v $(pwd)/files:/usr/src/app/files \
  chupurnov/jodit-nodejs

# Production setup with custom port
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SOURCE_NAME="Production Files" \
  -e SOURCE_ROOT="/usr/src/app/files" \
  -e SOURCE_BASEURL="https://cdn.example.com/uploads/" \
  -v /var/www/uploads:/usr/src/app/files \
  chupurnov/jodit-nodejs

# Using JSON configuration
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e CONFIG='{"debug":false,"allowCrossOrigin":true,"sources":{"production":{"name":"production","title":"Production","root":"/usr/src/app/files","baseurl":"https://cdn.example.com/uploads/"}}}' \
  -v /var/www/uploads:/usr/src/app/files \
  chupurnov/jodit-nodejs

# Using config file (recommended for complex configurations)
docker run --rm -p 8081:8081 \
  -v $(pwd)/config.json:/usr/src/app/config.json \
  -v $(pwd)/files:/usr/src/app/files \
  chupurnov/jodit-nodejs
```

### Available Environment Variables

- **`SOURCE_NAME`** - Display name for the default source (default: "Test Files")
- **`SOURCE_ROOT`** - Absolute path to the files directory (default: "./files/test")
- **`SOURCE_BASEURL`** - Base URL for accessing files (default: "http://localhost:8081/files/test/")
- **`PORT`** - Server port (default: 8081)
- **`CONFIG`** - Full configuration as JSON string (highest priority, overrides CONFIG_FILE and default config)
- **`CONFIG_FILE`** - Path to JSON configuration file (overrides default config)

### Configuration Priority

1. `CONFIG` environment variable (highest priority)
2. `CONFIG_FILE` environment variable
3. Default configuration from code

## Running the Application

### Development Mode

```bash
npm run dev          # Run with nodemon (hot reload)
```

### Production Mode

```bash
npm run build        # Compile TypeScript
npm start            # Run compiled application
```

### Using Docker

```bash
# Build and run
docker build -t jodit-nodejs .
docker run --rm -p 8081:8081 jodit-nodejs

# With custom config
docker run --rm -p 8081:8081 \
  -v /host/path/to/config.json:/usr/src/app/config.json \
  -v /host/path/to/files:/usr/src/app/files \
  jodit-nodejs
```

For detailed Docker instructions, see **[Docker Deployment](./docker.md)**.

## Next Steps

- **[API Usage](./api-usage.md)** - Learn how to use the API in your code
- **[Express Integration](./express-integration.md)** - Integrate with existing Express apps
- **[Configuration Reference](./config.md)** - Explore all configuration options
- **[Authentication](./authentication.md)** - Set up authentication methods
- **[Access Control](./access-control.md)** - Configure permissions and ACL rules
