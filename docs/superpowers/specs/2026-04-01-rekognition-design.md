# AWS Rekognition Integration Design Spec

**Date:** 2026-04-01
**Scope:** Issue #4 — Replace mock image recognition with real AWS Rekognition
**Approach:** Lambda analyzes S3 images via Rekognition, client calls API Gateway

---

## Architecture

```
CameraScreen → Upload to S3 (existing) → POST /images/analyze { key }
                                              ↓
                                         Lambda → Rekognition.DetectLabels(S3 ref)
                                              ↓
                                         Return DetectedItem[]
```

Images are already in S3 from the upload step (#5). The Lambda points Rekognition at the S3 object directly — no base64 transfer.

---

## CDK Stack Changes

**Modified:** `backend/lib/shelflife-stack.ts`

- New Lambda `RekognitionAnalyzer` (Node.js 20.x, 256MB, 15s timeout)
  - Environment: `IMAGES_BUCKET`
  - IAM: `rekognition:DetectLabels` permission + S3 read on images bucket
- New route: `POST /images/analyze` wired to this Lambda

---

## Lambda Handler

**New file:** `backend/lambda/rekognition.ts`

- Receives `{ key }` from request body
- Calls `Rekognition.DetectLabels` with `Image: { S3Object: { Bucket, Name: key } }`
- Filters labels by food categories (same list as existing service)
- MinConfidence: 70, MaxLabels: 20
- Returns `{ items: DetectedItem[] }` where `DetectedItem = { name, confidence }`

---

## Client Changes

**Modified:** `src/services/rekognitionService.ts`
- Remove AWS SDK imports and direct Rekognition client (lines 1-14)
- Add `API_BASE_URL` from env var
- Change `detectGroceryItems(imageBase64)` to `detectGroceryItems(s3Key)` — calls `POST /images/analyze`
- Falls back to mock when `API_BASE_URL` is not set
- Keep mock function and FOOD_CATEGORIES intact

**Modified:** `src/screens/CameraScreen.tsx`
- In photo mode: upload image to S3 first, then call `detectGroceryItems(s3Key)` with the returned key
- Replace `detectGroceryItemsMock(base64)` with `detectGroceryItems(s3Key)`
- The S3 key is reused when creating inventory items (already has `imageUrl` from #5)

---

## Files Summary

### New Files
- `backend/lambda/rekognition.ts`

### Modified Files
- `backend/lib/shelflife-stack.ts` — Lambda + route
- `src/services/rekognitionService.ts` — API Gateway fetch + mock fallback
- `src/screens/CameraScreen.tsx` — Upload first, then analyze
