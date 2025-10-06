# Deployment Guide

This guide explains how to configure and deploy the Jodit Connector package.

## GitHub Repository Setup

### 1. Enable GitHub Pages

For automatic documentation deployment:

1. Go to your repository **Settings** → **Pages**
2. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
3. Save the changes

The documentation will be automatically deployed to `https://<username>.github.io/<repository>/` on every push to `main` that changes source files.

### 2. Configure Secrets

For automated publishing to npm and DockerHub, add the following secrets in **Settings** → **Secrets and variables** → **Actions**:

#### Required Secrets:

1. **NPM_TOKEN** - npm automation token
   ```bash
   # Create token
   npm login
   npm token create --type=automation

   # Copy the token and add it to GitHub secrets
   ```

2. **DOCKERHUB_USERNAME** - Your DockerHub username
   ```bash
   # Example: johndoe
   ```

3. **DOCKERHUB_TOKEN** - DockerHub access token
   ```bash
   # Create at: https://hub.docker.com/settings/security
   # Click "New Access Token"
   # Copy the token and add it to GitHub secrets
   ```

## Release Process

### Automated Release

1. **Update version** in `package.json`:
   ```bash
   npm run newversion  # Increments patch version, commits, and tags
   ```

   Or manually:
   ```bash
   npm version patch  # or minor, major
   ```

2. **Push the tag** to trigger automated release:
   ```bash
   git push --tags origin HEAD:main
   ```

3. **GitHub Actions will automatically**:
   - ✅ Run tests and linter
   - ✅ Build Docker image
   - ✅ Push Docker image to DockerHub as `latest` and `<version>`
   - ✅ Publish package to npm registry with provenance

### Manual Release

If you prefer manual releases:

1. **Build the package**:
   ```bash
   npm run build
   ```

2. **Publish to npm**:
   ```bash
   npm publish
   ```

3. **Build and push Docker image**:
   ```bash
   docker build -t <username>/jodit-nodejs:latest .
   docker push <username>/jodit-nodejs:latest
   ```

## Workflows Overview

### `connector.yml` - Main CI/CD Pipeline

**Triggers:**
- Push to `main` branch
- Pull requests to `main`
- Tags (e.g., `v1.0.0`)

**Jobs:**
- `test` - Runs linter, tests, and build
- `docker` - Builds and pushes Docker image (tags only)
- `publish` - Publishes to npm (tags only)

### `docs.yml` - Documentation Deployment

**Triggers:**
- Push to `main` (if source files changed)
- Manual trigger (Actions tab)

**Jobs:**
- `build` - Generates OpenAPI documentation
- `deploy` - Deploys to GitHub Pages

## Docker Deployment

### Pull from DockerHub

```bash
docker pull <username>/jodit-nodejs:latest
```

### Run with Docker

```bash
# Basic run
docker run -p 3000:3000 <username>/jodit-nodejs:latest

# With custom config
docker run -p 3000:3000 \
  -v /path/to/config.json:/usr/src/app/config.json \
  -v /path/to/files:/usr/src/app/files \
  <username>/jodit-nodejs:latest

# With environment variables
docker run -p 3000:3000 \
  -e SOURCE_ROOT=/data \
  -e SOURCE_BASEURL=https://cdn.example.com/ \
  <username>/jodit-nodejs:latest
```

## NPM Package Usage

### Install

```bash
npm install jodit-nodejs
```

### Basic Usage

```javascript
const { start } = require('jodit-nodejs');

start({
  port: 3000,
  config: {
    sources: {
      uploads: {
        title: 'Uploads',
        root: '/path/to/files',
        baseurl: 'http://localhost:3000/files/'
      }
    }
  }
});
```

## Troubleshooting

### Documentation not deploying

1. Check GitHub Pages is enabled in Settings → Pages
2. Verify workflow ran successfully in Actions tab
3. Check workflow logs for errors
4. Ensure `docs/` directory is generated correctly locally

### npm publish fails

1. Verify `NPM_TOKEN` is set correctly in GitHub secrets
2. Check token has publish permissions
3. Ensure package name is available on npm registry
4. Check package.json version is incremented

### Docker push fails

1. Verify `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are set correctly
2. Check DockerHub repository exists
3. Verify token has push permissions
4. Check Docker image builds successfully locally

## Support

For issues and questions:
- GitHub Issues: https://github.com/xdan/jodit-nodejs/issues
- Documentation: https://jodit.github.io/jodit-nodejs/
