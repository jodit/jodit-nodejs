FROM node:24 AS builder

WORKDIR /usr/src/app

COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci

COPY ./tsconfig.json ./
COPY ./src ./src
RUN npm run build

RUN NODE_NO_WARNINGS=1 npm prune --omit=dev

FROM node:24-alpine
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY ./package.json /usr/src/app/
COPY ./config.example.json /usr/src/app/config.json

# Create files directory
RUN mkdir -p /usr/src/app/files

# Set environment variable to read config from file
ENV CONFIG_FILE=/usr/src/app/config.json

EXPOSE 3000

CMD ["node", "dist/run.js"]
