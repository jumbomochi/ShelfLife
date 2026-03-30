# S3 Image Storage Integration Design Spec

**Date:** 2026-03-30
**Scope:** Issue #5 — Implement AWS S3 integration for storing item photos
**Approach:** Extend CDK stack with S3 bucket + presigned URL Lambda, on-device compression, scheduled orphan cleanup

---

## Architecture

```
Mobile App
  ├── POST /images/upload-url → Lambda → returns presigned PUT URL
  ├── PUT presigned URL → S3 (direct upload, bypasses Lambda)
  └── GET /images/{key} → Lambda → returns presigned GET URL

EventBridge (daily) → Cleanup Lambda → scans S3 vs DynamoDB → deletes orphans
```

Images are uploaded directly to S3 via presigned URLs. The app compresses images on-device before upload (800px max width, 70% JPEG quality). A daily scheduled Lambda removes orphaned images not referenced by any inventory item.

---

## CDK Stack — S3 Bucket + Lambda Endpoints

Added to the existing `ShelfLifeStack` in `backend/lib/shelflife-stack.ts`.

### New Resources

- **S3 Bucket** (`ShelfLife-Images`)
  - Server-side encryption (AES-256)
  - CORS configured for mobile uploads (PUT from any origin)
  - Private access only (no public)
  - Bucket name passed to Lambdas as environment variable

- **S3 Images Lambda** — handles presigned URL generation
  - Routes: `POST /images/upload-url`, `GET /images/{key}`

- **Image Cleanup Lambda** — scheduled orphan cleanup
  - Triggered daily by EventBridge rule
  - Read access to S3 bucket + DynamoDB inventory table

### API Routes

| Route | Method | Operation |
|-------|--------|-----------|
| `/images/upload-url` | POST | Generate presigned PUT URL |
| `/images/{key}` | GET | Generate presigned GET URL |

---

## Lambda Handlers

### `backend/lambda/s3-images.ts` — Presigned URL Generation

**POST /images/upload-url:**
- Input: `{ fileName, contentType }` in request body
- Generates S3 key: `images/{uuid}-{fileName}`
- Creates presigned PUT URL (5 minute expiry)
- Returns: `{ uploadUrl, key }`

**GET /images/{key}:**
- Input: `key` from path parameter
- Creates presigned GET URL (1 hour expiry)
- Returns: `{ url }`

### `backend/lambda/image-cleanup.ts` — Scheduled Orphan Cleanup

- Triggered daily by EventBridge
- Lists all S3 objects under `images/` prefix
- Scans DynamoDB inventory table for all `imageUrl` values
- Deletes S3 objects whose key is not referenced by any inventory item
- Logs deletion count

### Dependencies
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `@aws-sdk/client-dynamodb` (cleanup Lambda only)
- `@aws-sdk/util-dynamodb` (cleanup Lambda only)

---

## Client-Side Changes

### New File: `src/services/s3Service.ts`

| Function | Description |
|----------|-------------|
| `compressImage(uri)` | Resize to 800px max width, JPEG 70% quality via expo-image-manipulator |
| `uploadImage(uri)` | Compress → get presigned URL → PUT to S3 → return key |
| `getImageUrl(key)` | Get presigned download URL, cache in memory (1hr valid) |
| `uploadImageMock(uri)` | Returns fake key (dev fallback) |
| `getImageUrlMock(uri)` | Returns original URI (dev fallback) |

All functions check `API_BASE_URL` and fall back to mock when not set.

### Modified File: `src/screens/CameraScreen.tsx`

- After photo capture, compress and upload the image
- Pass the returned S3 key as `imageUrl` when creating inventory items

### Modified File: `src/components/InventoryItemCard.tsx`

- When `imageUrl` starts with `images/` (S3 key), call `getImageUrl(key)` to get presigned download URL
- Use the presigned URL as the Image source

### New Dependency

`expo-image-manipulator` for on-device image compression

---

## Files Summary

### New Files (Backend)
- `backend/lambda/s3-images.ts` — presigned URL generation
- `backend/lambda/image-cleanup.ts` — scheduled orphan cleanup

### Modified Files (Backend)
- `backend/lib/shelflife-stack.ts` — S3 bucket, Lambda, routes, EventBridge rule

### New Files (App)
- `src/services/s3Service.ts` — compress, upload, download helpers

### Modified Files (App)
- `src/screens/CameraScreen.tsx` — upload after capture
- `src/components/InventoryItemCard.tsx` — display S3 images via presigned URL

### New Dependencies
- `expo-image-manipulator`
- `@aws-sdk/client-s3` (backend)
- `@aws-sdk/s3-request-presigner` (backend)
