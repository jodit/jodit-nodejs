---
title: AWS S3 and S3-compatible storage
description: Store Jodit uploads in AWS S3, MinIO, Cloudflare R2, Yandex Object Storage or any other S3-compatible bucket with the built-in s3 storage adapter.
---

# AWS S3 and S3-compatible storage

The connector ships with an `s3` storage adapter. Point a source at a bucket and the file browser, uploader, thumbnails and image editing all work against that bucket instead of a local directory. You do not need to install anything else: `@aws-sdk/client-s3` is a dependency of `jodit-nodejs`.

The same adapter works with every service that speaks the S3 API: MinIO, Cloudflare R2, Yandex Object Storage, DigitalOcean Spaces, Backblaze B2, Wasabi, Scaleway and others.

## Table of Contents

- [Quick start](#quick-start)
- [Options](#options)
- [Credentials](#credentials)
- [S3-compatible services](#s3-compatible-services)
- [Serving the files](#serving-the-files)
- [IAM policy](#iam-policy)
- [How the bucket is laid out](#how-the-bucket-is-laid-out)
- [Editor configuration](#editor-configuration)
- [Limits](#limits)
- [Troubleshooting](#troubleshooting)

## Quick start

### From code

```typescript
import { start } from 'jodit-nodejs';

await start({
  port: 8081,
  config: {
    allowCrossOrigin: true,
    sources: {
      media: {
        name: 'media',
        title: 'Media library',
        baseurl: 'https://my-bucket.s3.eu-central-1.amazonaws.com/media/',
        storageAdapter: 's3',
        s3: {
          bucket: 'my-bucket',
          region: 'eu-central-1',
          prefix: 'media'
        }
      }
    }
  }
});
```

There is no `root` here. Remote sources get a virtual root (`/`) and every path the client sends is confined to the bucket prefix.

### From a JSON config file

The same source in the `CONFIG_FILE` format the CLI and the Docker image read:

```json
{
  "allowCrossOrigin": true,
  "sources": {
    "media": {
      "name": "media",
      "title": "Media library",
      "baseurl": "https://my-bucket.s3.eu-central-1.amazonaws.com/media/",
      "storageAdapter": "s3",
      "s3": {
        "bucket": "my-bucket",
        "region": "eu-central-1",
        "prefix": "media"
      }
    }
  }
}
```

### With Docker

```bash
docker run --rm -p 8081:8081 \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  -v $(pwd)/config.json:/usr/src/app/config.json \
  xdsoft/jodit-nodejs
```

The credentials come from the environment, the bucket from the config file. See [Credentials](#credentials).

### With the adapter class

`S3StorageAdapter` is exported, so it can be built by hand and passed as an instance. This is the way to share one `S3Client` between several sources or to inject a client in tests:

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { start, S3StorageAdapter } from 'jodit-nodejs';

const client = new S3Client({ region: 'eu-central-1' });

await start({
  config: {
    sources: {
      media: {
        name: 'media',
        baseurl: 'https://cdn.example.com/media/',
        storageAdapter: new S3StorageAdapter({
          bucket: 'my-bucket',
          prefix: 'media',
          publicBaseUrl: 'https://cdn.example.com/media',
          client
        })
      }
    }
  }
});
```

## Options

All options live under `sources.<name>.s3`.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `bucket` | `string` | required | Bucket name |
| `region` | `string` | `us-east-1` | AWS region. S3-compatible services accept the default. |
| `endpoint` | `string` | AWS | Endpoint URL of an S3-compatible service |
| `forcePathStyle` | `boolean` | `false` | Use `endpoint/bucket/key` URLs. MinIO and some self-hosted services need `true`. |
| `prefix` | `string` | `''` | Key prefix that acts as the source root, for example `uploads/site-a` |
| `credentials` | `{ accessKeyId, secretAccessKey, sessionToken? }` | AWS default chain | Static credentials |
| `publicBaseUrl` | `string` | bucket URL | Base URL returned by `publicUrl()`. Set it when files are served through a CDN. |
| `client` | `S3Client` | built from the options above | Pre-configured client |

`baseurl` on the source itself is what the connector puts in front of file paths in its responses. It has to be the public URL of the prefix, with a trailing slash. `publicBaseUrl` is only used by the adapter's `publicUrl()` method and defaults to the bucket URL.

## Credentials

Leave `credentials` out and the AWS SDK looks for them in the standard places, in this order:

1. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (and `AWS_SESSION_TOKEN`) environment variables
2. The shared credentials file (`~/.aws/credentials`) and `AWS_PROFILE`
3. The instance or task role on EC2, ECS and EKS (IRSA)

That keeps secrets out of config files and works with Docker (`-e AWS_ACCESS_KEY_ID=...`) and with instance roles in production.

Pass `credentials` explicitly when the connector serves several buckets with different keys, or when the keys come from your own configuration store:

```typescript
s3: {
  bucket: 'customer-a',
  credentials: {
    accessKeyId: process.env.CUSTOMER_A_KEY!,
    secretAccessKey: process.env.CUSTOMER_A_SECRET!
  }
}
```

## S3-compatible services

Set `endpoint`, and `forcePathStyle` where the service needs it.

| Service | `endpoint` | `forcePathStyle` | `region` |
| --- | --- | --- | --- |
| MinIO | `http://minio:9000` | `true` | any |
| Cloudflare R2 | `https://<account-id>.r2.cloudflarestorage.com` | `true` | `auto` |
| Yandex Object Storage | `https://storage.yandexcloud.net` | `false` | `ru-central1` |
| DigitalOcean Spaces | `https://<region>.digitaloceanspaces.com` | `false` | the space region |
| Backblaze B2 | `https://s3.<region>.backblazeb2.com` | `false` | the bucket region |
| Wasabi | `https://s3.<region>.wasabisys.com` | `false` | the bucket region |

MinIO in Docker Compose:

```json
{
  "sources": {
    "files": {
      "name": "files",
      "title": "Files",
      "baseurl": "http://localhost:9000/jodit/files/",
      "storageAdapter": "s3",
      "s3": {
        "bucket": "jodit",
        "endpoint": "http://minio:9000",
        "forcePathStyle": true,
        "prefix": "files",
        "credentials": {
          "accessKeyId": "minioadmin",
          "secretAccessKey": "minioadmin"
        }
      }
    }
  }
}
```

Note the two different hosts: the connector talks to MinIO on the internal `minio:9000` address, while the browser loads files from `localhost:9000`.

## Serving the files

The connector never streams files to the browser. Responses contain paths, and the editor builds `baseurl + path` to load images. So the objects under the prefix have to be readable by the browser. There are two common setups.

### Public read on the prefix

A bucket policy that allows `s3:GetObject` on the prefix only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForJoditUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/media/*"
    }
  ]
}
```

On AWS this also needs "Block public access" turned off for the bucket policy (the `BlockPublicPolicy` and `RestrictPublicBuckets` settings).

### A CDN in front of the bucket

CloudFront with an origin access control, or the CDN of your S3-compatible provider. Then `baseurl` points at the CDN, the bucket itself stays private, and the connector still writes straight to S3.

The adapter does not set object ACLs. Buckets created after April 2023 have ACLs disabled by default, and `PutObjectAcl` fails on them. Everything goes through the bucket policy instead.

## IAM policy

The connector only needs to list the prefix and to read, write and delete objects under it.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::my-bucket",
      "Condition": {
        "StringLike": { "s3:prefix": ["media/*", "media"] }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-bucket/media/*"
    }
  ]
}
```

`s3:PutObject` covers copies too, which is what rename and move use.

## How the bucket is laid out

S3 has no folders, only keys. The adapter follows the convention the AWS console uses:

- A file at `/photos/cat.jpg` in the file browser is the object `<prefix>/photos/cat.jpg`.
- Creating a folder writes a zero-byte object `<prefix>/photos/`. A folder that only exists because objects sit under it (no marker object) is listed too.
- Thumbnails go to `<prefix>/photos/_thumbs/cat.jpg`, next to the originals, the same as on the local filesystem. The `_thumbs` folder is hidden from listings.
- Rename and move are copy plus delete. Moving a folder copies every object under it.
- Removing a folder deletes every key under its prefix in batches of 1000.

Existing objects uploaded by other tools show up as long as they sit under the prefix and their extension is in `extensions`.

Thumbnails cost one `GetObject` and one `PutObject` per image the first time a folder is listed (at most `safeThumbsCountInOneTime` per request, 20 by default). Set `createThumb: false` on the source if the bucket is large and thumbnails are not needed, or if a CDN resizes images for you.

## Editor configuration

Nothing changes on the editor side. It talks to the connector, not to the bucket:

```javascript
Jodit.make('#editor', {
  uploader: {
    url: 'https://connector.example.com/?action=fileUpload'
  },
  filebrowser: {
    ajax: {
      url: 'https://connector.example.com/'
    }
  }
});
```

Uploaded images end up in the editor with `baseurl + path` URLs, so they load from the bucket or the CDN.

## Limits

- Objects over 5 GB cannot be renamed or moved: `CopyObject` is limited to that size. Uploads themselves are multipart and have no such limit.
- `temporaryUrl()` (signed URLs) is not implemented. Files are expected to be readable through `baseurl`.
- Paths use forward slashes. Run the connector on Linux or macOS, or in Docker, for remote sources.
- `fileUploadRemote` downloads through the connector's memory before writing to the bucket, so `maxUploadFileSize` applies to it.

## Troubleshooting

### `AccessDenied` on listing

The IAM policy needs `s3:ListBucket` on the bucket ARN (not on `bucket/*`), and the `s3:prefix` condition has to match the prefix you configured.

### Files upload but do not show in the editor

Check that `baseurl` is the public URL of the prefix and that objects are readable from a browser: open `baseurl + 'some-file.jpg'` directly. A 403 there means the bucket policy or CDN is missing.

### MinIO answers `NoSuchBucket` or `301`

Set `forcePathStyle: true`. Without it the SDK builds `bucket.minio:9000`, which does not resolve.

### Wrong region

AWS returns `PermanentRedirect` with the right region in the message. Set `region` to match the bucket.

### `Path does not exist` on a folder that is in the bucket

The folder is outside the prefix, or the listing was cached by the editor. The connector only sees keys under `prefix`.

### Two sources on the same bucket

Give them different prefixes. Two sources sharing a prefix will see each other's `_thumbs` folder as data.
