# S3 Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add S3 image storage with presigned URL uploads, on-device compression, and scheduled orphan cleanup.

**Architecture:** Extend CDK stack with S3 bucket, presigned URL Lambda, and EventBridge-triggered cleanup Lambda. New `s3Service.ts` in the app handles compression + upload. CameraScreen uploads after capture, InventoryItemCard displays S3 images.

**Tech Stack:** AWS CDK, S3, Lambda, EventBridge, expo-image-manipulator, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

---

## File Map

### New Files (Backend)
- `backend/lambda/s3-images.ts` — Presigned URL generation Lambda
- `backend/lambda/image-cleanup.ts` — Scheduled orphan cleanup Lambda

### New Files (App)
- `src/services/s3Service.ts` — Compress, upload, download helpers

### Modified Files (Backend)
- `backend/lib/shelflife-stack.ts` — S3 bucket, Lambdas, routes, EventBridge rule

### Modified Files (App)
- `src/screens/CameraScreen.tsx` — Upload image after capture
- `src/components/InventoryItemCard.tsx` — Display S3 images

---

### Task 1: Add S3 Bucket and Lambdas to CDK Stack

**Files:**
- Modify: `backend/lib/shelflife-stack.ts`

- [ ] **Step 1: Add S3 and Events imports**

At the top of `backend/lib/shelflife-stack.ts`, add after the existing imports (after line 4):

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
```

- [ ] **Step 2: Add S3 bucket after the DynamoDB tables section**

Insert after the `savedRecipesTable` GSI (after line 90), before the CRUD Lambda section:

```typescript
    // ============ S3 Image Storage ============

    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `shelflife-images-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
```

- [ ] **Step 3: Add S3 Images Lambda**

Insert after the bucket definition:

```typescript
    // S3 Images Lambda (presigned URLs)
    const s3Images = new lambda.Function(this, 'S3Images', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 's3-images.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
    });

    imagesBucket.grantReadWrite(s3Images);
```

- [ ] **Step 4: Add Image Cleanup Lambda with EventBridge schedule**

Insert after the S3 Images Lambda:

```typescript
    // Image Cleanup Lambda (scheduled)
    const imageCleanup = new lambda.Function(this, 'ImageCleanup', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'image-cleanup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      environment: {
        IMAGES_BUCKET: imagesBucket.bucketName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    imagesBucket.grantReadWrite(imageCleanup);
    inventoryTable.grantReadData(imageCleanup);

    new events.Rule(this, 'ImageCleanupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      targets: [new targets.LambdaFunction(imageCleanup)],
    });
```

- [ ] **Step 5: Add API Gateway routes for images**

Insert before the `CfnOutput` (before line 190):

```typescript
    // --- Images ---
    const s3Integration = new apigateway.LambdaIntegration(s3Images);
    const images = api.root.addResource('images');
    const uploadUrl = images.addResource('upload-url');
    uploadUrl.addMethod('POST', s3Integration);
    const imageByKey = images.addResource('{key}');
    imageByKey.addMethod('GET', s3Integration);
```

- [ ] **Step 6: Add bucket name to outputs**

Add before the closing `}` of the constructor:

```typescript
    new cdk.CfnOutput(this, 'ImagesBucketName', {
      value: imagesBucket.bucketName,
      description: 'S3 bucket for item images',
    });
```

- [ ] **Step 7: Verify CDK synth**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`

- [ ] **Step 8: Commit**

```bash
git add backend/lib/shelflife-stack.ts
git commit -m "feat: add S3 bucket, image Lambdas, and cleanup schedule to CDK stack (#5)"
```

---

### Task 2: S3 Presigned URL Lambda

**Files:**
- Create: `backend/lambda/s3-images.ts`

- [ ] **Step 1: Install S3 SDK dependencies**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

- [ ] **Step 2: Create the Lambda handler**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const BUCKET = process.env.IMAGES_BUCKET!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;
  const pathParams = event.pathParameters || {};

  try {
    // POST /images/upload-url — generate presigned PUT URL
    if (resource === '/images/upload-url' && method === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { fileName, contentType } = body;

      if (!fileName || !contentType) {
        return respond(400, { error: 'Missing fileName or contentType' });
      }

      const key = `images/${randomUUID()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      return respond(200, { uploadUrl, key });
    }

    // GET /images/{key} — generate presigned GET URL
    if (resource === '/images/{key}' && method === 'GET') {
      const key = pathParams.key;
      if (!key) {
        return respond(400, { error: 'Missing image key' });
      }

      // The key from path params may be URL-encoded; the actual S3 key uses 'images/' prefix
      const s3Key = key.startsWith('images/') ? key : `images/${key}`;

      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return respond(200, { url });
    }

    return respond(400, { error: 'Unknown route' });
  } catch (error: any) {
    console.error('S3 Images error:', error);
    return respond(500, { error: 'Internal server error', message: error.message });
  }
}
```

- [ ] **Step 3: Verify backend TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/lambda/s3-images.ts backend/package.json backend/package-lock.json
git commit -m "feat: add S3 presigned URL Lambda handler (#5)"
```

---

### Task 3: Image Cleanup Lambda

**Files:**
- Create: `backend/lambda/image-cleanup.ts`

- [ ] **Step 1: Create the cleanup Lambda handler**

```typescript
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});
const BUCKET = process.env.IMAGES_BUCKET!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;

export async function handler(): Promise<void> {
  // 1. Get all image keys from S3
  const s3Keys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'images/',
      ContinuationToken: continuationToken,
    }));

    for (const obj of listResult.Contents || []) {
      if (obj.Key) s3Keys.add(obj.Key);
    }

    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);

  if (s3Keys.size === 0) {
    console.log('No images in S3, nothing to clean up');
    return;
  }

  // 2. Get all imageUrl values from DynamoDB inventory
  const referencedKeys = new Set<string>();
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const scanResult = await dynamodb.send(new ScanCommand({
      TableName: INVENTORY_TABLE,
      ProjectionExpression: 'imageUrl',
      FilterExpression: 'attribute_exists(imageUrl)',
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    for (const item of scanResult.Items || []) {
      const record = unmarshall(item);
      if (record.imageUrl) {
        referencedKeys.add(record.imageUrl);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // 3. Find orphaned keys
  const orphanedKeys = Array.from(s3Keys).filter((key) => !referencedKeys.has(key));

  if (orphanedKeys.length === 0) {
    console.log(`All ${s3Keys.size} images are referenced, nothing to delete`);
    return;
  }

  // 4. Delete orphaned objects (max 1000 per request)
  let totalDeleted = 0;
  for (let i = 0; i < orphanedKeys.length; i += 1000) {
    const batch = orphanedKeys.slice(i, i + 1000);
    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: batch.map((key) => ({ Key: key })),
      },
    }));
    totalDeleted += batch.length;
  }

  console.log(`Deleted ${totalDeleted} orphaned images out of ${s3Keys.size} total`);
}
```

- [ ] **Step 2: Verify backend TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/lambda/image-cleanup.ts
git commit -m "feat: add scheduled image cleanup Lambda (#5)"
```

---

### Task 4: App S3 Service

**Files:**
- Create: `src/services/s3Service.ts`

- [ ] **Step 1: Install expo-image-manipulator**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo install expo-image-manipulator`

- [ ] **Step 2: Create s3Service.ts**

```typescript
import * as ImageManipulator from 'expo-image-manipulator';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';

// In-memory cache for presigned download URLs (valid 1 hour)
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function uploadImage(uri: string): Promise<string> {
  if (!API_BASE_URL) return uploadImageMock(uri);

  // 1. Compress
  const compressedUri = await compressImage(uri);

  // 2. Get presigned upload URL
  const fileName = `item-${Date.now()}.jpg`;
  const response = await fetch(`${API_BASE_URL}/images/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType: 'image/jpeg' }),
  });

  if (!response.ok) throw new Error('Failed to get upload URL');
  const { uploadUrl, key } = await response.json();

  // 3. Read file as blob and upload directly to S3
  const fileResponse = await fetch(compressedUri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });

  if (!uploadResponse.ok) throw new Error('Failed to upload image to S3');

  return key;
}

export async function getImageUrl(key: string): Promise<string> {
  if (!API_BASE_URL) return getImageUrlMock(key);

  // Check cache
  const cached = urlCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const encodedKey = encodeURIComponent(key);
  const response = await fetch(`${API_BASE_URL}/images/${encodedKey}`);
  if (!response.ok) throw new Error('Failed to get image URL');

  const { url } = await response.json();

  // Cache for 50 minutes (URL valid for 60)
  urlCache.set(key, { url, expiresAt: Date.now() + 50 * 60 * 1000 });

  return url;
}

// ============ Mock Functions ============

export async function uploadImageMock(uri: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return `images/mock-${Date.now()}.jpg`;
}

export async function getImageUrlMock(key: string): Promise<string> {
  return key; // Return the key as-is for mock (won't render but won't crash)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/s3Service.ts package.json package-lock.json
git commit -m "feat: add S3 image service with compression and upload (#5)"
```

---

### Task 5: Upload Images in CameraScreen

**Files:**
- Modify: `src/screens/CameraScreen.tsx`

- [ ] **Step 1: Add import for uploadImage**

In `src/screens/CameraScreen.tsx`, add after the existing imports (after line 18):

```typescript
import { uploadImage } from '@/services/s3Service';
```

- [ ] **Step 2: Add upload state**

After the existing state declarations (after line 38), add:

```typescript
  const [isUploading, setIsUploading] = useState(false);
```

- [ ] **Step 3: Update addSelectedItems to upload the captured image**

Replace the `addSelectedItems` function (lines 100-114) with:

```typescript
  const addSelectedItems = async () => {
    let imageUrl: string | undefined;

    // Upload captured image if available
    if (capturedImage) {
      try {
        setIsUploading(true);
        imageUrl = await uploadImage(capturedImage);
      } catch (error) {
        console.error('Image upload failed:', error);
        // Continue without image — don't block item creation
      } finally {
        setIsUploading(false);
      }
    }

    selectedItems.forEach((itemName) => {
      addItem({
        userId: 'current-user',
        name: itemName,
        quantity: 1,
        unit: 'pcs',
        location: 'fridge',
        ownership: 'personal',
        imageUrl,
      });
    });

    Alert.alert('Success', `Added ${selectedItems.size} item(s) to inventory`);
    onItemsAdded?.();
    onClose();
  };
```

- [ ] **Step 4: Update the Add button to show uploading state**

Find the "Add {selectedItems.size} Item(s)" button (around line 187-198) and replace it with:

```typescript
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    (selectedItems.size === 0 || isUploading) && styles.addButtonDisabled,
                  ]}
                  onPress={addSelectedItems}
                  disabled={selectedItems.size === 0 || isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.addButtonText}>
                      Add {selectedItems.size} Item(s)
                    </Text>
                  )}
                </TouchableOpacity>
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/CameraScreen.tsx
git commit -m "feat: upload item images to S3 from camera screen (#5)"
```

---

### Task 6: Display S3 Images in InventoryItemCard

**Files:**
- Modify: `src/components/InventoryItemCard.tsx`

- [ ] **Step 1: Add imports and image state**

Replace lines 1-2 with:

```typescript
import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { InventoryItem } from '@/types';
import { getImageUrl } from '@/services/s3Service';
```

- [ ] **Step 2: Add image URL resolution inside the component**

Inside the `InventoryItemCard` component, after `const isHousehold = ...` (after line 37), add:

```typescript
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item.imageUrl && item.imageUrl.startsWith('images/')) {
      getImageUrl(item.imageUrl).then(setResolvedImageUrl).catch(() => {});
    } else if (item.imageUrl) {
      setResolvedImageUrl(item.imageUrl);
    }
  }, [item.imageUrl]);
```

- [ ] **Step 3: Add image thumbnail to the card layout**

In the return JSX, add an image thumbnail before `leftContent`. Replace the opening `<View style={styles.leftContent}>` with:

```typescript
      {resolvedImageUrl && (
        <Image
          source={{ uri: resolvedImageUrl }}
          style={styles.thumbnail}
        />
      )}
      <View style={[styles.leftContent, resolvedImageUrl && styles.leftContentWithImage]}>
```

- [ ] **Step 4: Add thumbnail styles**

Add to the StyleSheet:

```typescript
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#E5E5EA',
  },
  leftContentWithImage: {
    flex: 1,
  },
```

- [ ] **Step 5: Commit**

```bash
git add src/components/InventoryItemCard.tsx
git commit -m "feat: display S3 item images in inventory cards (#5)"
```

---

### Task 7: Verification

**Files:**
- All modified files

- [ ] **Step 1: Full app TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Backend TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify CDK synth**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`
Expected: YAML template output

- [ ] **Step 4: Verify Expo bundler**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo export --platform ios --output-dir /tmp/shelflife-export-test-4 2>&1 | tail -3`
Expected: Exported successfully

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve any remaining issues for S3 image integration (#5)"
```
