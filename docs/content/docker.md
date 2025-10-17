---
title: Docker Deployment
description: Complete guide for deploying Jodit Connector Node.js using Docker.
---

# Docker Deployment

Jodit Connector Node.js includes a multi-stage Dockerfile optimized for production deployments.

## Quick Start

### Build and Run

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Or manually
docker build -t jodit-nodejs .
docker run --rm -p 8081:8081 jodit-nodejs
```

## Configuration

The Docker image includes a default configuration file at `/usr/src/app/config.json` that can be customized.

### With Custom Config File (Recommended)

```bash
docker run --rm -p 8081:8081 \
  -v /host/path/to/config.json:/usr/src/app/config.json \
  -v /host/path/to/files:/usr/src/app/files \
  jodit-nodejs
```

### With Environment Variables

```bash
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e SOURCE_NAME="Production Files" \
  -e SOURCE_ROOT="/var/www/uploads" \
  -e SOURCE_BASEURL="https://cdn.example.com/uploads/" \
  jodit-nodejs
```

### With Volume Mount for Files

```bash
docker run --rm -p 8081:8081 \
  -v /host/path/to/files:/usr/src/app/files \
  jodit-nodejs
```

### With Inline JSON Config

```bash
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e CONFIG='{"debug":false,"allowCrossOrigin":true,"sources":{"production":{"title":"Production","root":"/usr/src/app/files","baseurl":"https://cdn.example.com/files/"}}}' \
  jodit-nodejs
```

## Configuration Priority

1. `CONFIG` environment variable (highest priority)
2. `CONFIG_FILE` environment variable (default: `/usr/src/app/config.json` in Docker)
3. Default configuration from code

## Docker Image Details

- **Base image**: Node.js 22 (builder) → Node.js 22 (runtime)
- **Multi-stage build**: Reduces final image size
- **Production optimized**: Prunes dev dependencies
- **Puppeteer support**: Full Debian-based image for Chrome/Chromium dependencies
- **Port**: 8081 (exposed)

**Why not Alpine?** The application uses Puppeteer for PDF generation, which requires Chrome/Chromium and system libraries that are difficult to install on Alpine Linux. The full Debian-based Node.js image includes these dependencies.

## Dockerfile Stages

### 1. Builder Stage

Installs all dependencies and compiles TypeScript:

```dockerfile
FROM node:22 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
```

### 2. Runtime Stage

Copies only compiled code and production dependencies:

```dockerfile
FROM node:22
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./
RUN npm prune --production
```

**Note:** The runtime image uses the full Debian-based Node.js image (not Alpine) because Puppeteer requires Chrome/Chromium and system libraries that are included in the Debian base.

### 3. Puppeteer Dependencies

The Debian-based Node.js image includes most necessary libraries for Chrome/Chromium. If you're creating a custom Dockerfile, you may need to install additional dependencies:

```dockerfile
FROM node:22
WORKDIR /usr/src/app

# Install Chromium dependencies (if needed)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "dist/run.js"]
```

**Note:** The official `node:22` image usually works out of the box with Puppeteer's bundled Chromium. The above dependencies are only needed if you encounter issues.

## Docker Compose

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  jodit-connector:
    build: .
    ports:
      - "8081:8081"
    volumes:
      - ./config.json:/usr/src/app/config.json
      - ./files:/usr/src/app/files
    environment:
      - NODE_ENV=production
      - PORT=8081
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Production Deployment

### DockerHub

Pull from DockerHub:

```bash
docker pull chupurnov/jodit-nodejs:latest
```

### With Reverse Proxy (nginx)

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name files.example.com;

    location / {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Next Steps

- **[Deployment Guide](./deployment.md)** - CI/CD, GitHub Actions, npm publishing
- **[Configuration](./config.md)** - Explore all configuration options
