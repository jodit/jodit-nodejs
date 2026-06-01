FROM node:22-bookworm-slim AS deps

ENV DEBIAN_FRONTEND=noninteractive;
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true;
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium \
       tini \
       ca-certificates \
       fonts-liberation fonts-noto-cjk fonts-noto-core \
       libasound2 libatk1.0-0 libatk-bridge2.0-0 \
       libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
       libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
       libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
       libxcursor1 libxdamage1 libxext6 libxfixes3 \
       libxi6 libxrandr2 libxrender1 libxss1 libxtst6

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

FROM node:22-bookworm-slim AS builder
WORKDIR /usr/src/app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./.npmrc ./

ENV PUPPETEER_SKIP_DOWNLOAD=true;
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true;
RUN npm ci

COPY ./tsconfig.json ./
COPY ./tsup.config.ts ./
COPY ./src ./src
RUN npm run build

RUN NODE_NO_WARNINGS=1 npm prune --omit=dev

FROM deps AS final
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY ./package.json /usr/src/app/
COPY ./.env /usr/src/app/
COPY ./config.example.json /usr/src/app/config.json

# Create files directory
RUN mkdir -p /usr/src/app/files

# Set environment variable to read config from file
ENV CONFIG_FILE=/usr/src/app/config.json

# Run under tini (PID 1) so orphaned Chromium children (renderers, crashpad
# helpers) get reaped instead of piling up as zombie processes.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--env-file=.env", "dist/run.js"]
