# Rekognition Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock image recognition with real AWS Rekognition via Lambda, analyzing images already uploaded to S3.

**Architecture:** New Rekognition Lambda added to CDK stack. CameraScreen uploads image to S3 first, then calls the analyze endpoint with the S3 key. The rekognitionService switches from direct SDK to API Gateway fetch with mock fallback.

**Tech Stack:** AWS CDK, Rekognition, Lambda, API Gateway, @aws-sdk/client-rekognition

---

## File Map

### New Files
- `backend/lambda/rekognition.ts` — Rekognition Lambda handler

### Modified Files
- `backend/lib/shelflife-stack.ts` — Add Lambda + route
- `src/services/rekognitionService.ts` — API Gateway fetch + mock fallback
- `src/screens/CameraScreen.tsx` — Upload to S3 first, then analyze

---

### Task 1: Add Rekognition Lambda to CDK Stack

**Files:**
- Modify: `backend/lib/shelflife-stack.ts`

- [ ] **Step 1: Add IAM import**

At the top of `backend/lib/shelflife-stack.ts`, add after the existing imports:

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';
```

- [ ] **Step 2: Add Rekognition Lambda after the S3 Images Lambda section**

Insert after the `ImageCleanupSchedule` EventBridge rule, before the `// ============ DynamoDB CRUD Lambda ============` section:

```typescript
    // ============ Rekognition Lambda ============

    const rekognitionAnalyzer = new lambda.Function(this, 'RekognitionAnalyzer', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'rekognition.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      environment: {
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
    });

    imagesBucket.grantRead(rekognitionAnalyzer);
    rekognitionAnalyzer.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rekognition:DetectLabels'],
      resources: ['*'],
    }));
```

- [ ] **Step 3: Add API route**

Insert after the existing images routes (`imageByKey.addMethod('GET', s3Integration);`), before the `// --- Users ---` section:

```typescript
    // POST /images/analyze
    const rekognitionIntegration = new apigateway.LambdaIntegration(rekognitionAnalyzer);
    const analyzeImage = images.addResource('analyze');
    analyzeImage.addMethod('POST', rekognitionIntegration);
```

- [ ] **Step 4: Verify CDK synth**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`

- [ ] **Step 5: Commit**

```bash
git add backend/lib/shelflife-stack.ts
git commit -m "feat: add Rekognition analyzer Lambda to CDK stack (#4)"
```

---

### Task 2: Rekognition Lambda Handler

**Files:**
- Create: `backend/lambda/rekognition.ts`

- [ ] **Step 1: Install Rekognition SDK**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npm install @aws-sdk/client-rekognition`

- [ ] **Step 2: Create the Lambda handler**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';

const rekognition = new RekognitionClient({});
const BUCKET = process.env.IMAGES_BUCKET!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

const FOOD_CATEGORIES = [
  'food', 'fruit', 'vegetable', 'meat', 'dairy', 'beverage', 'bread',
  'snack', 'grocery', 'produce', 'seafood', 'bakery', 'condiment',
  'sauce', 'spice', 'herb', 'grain', 'cereal', 'pasta', 'rice',
  'egg', 'cheese', 'milk', 'juice', 'water', 'soda', 'wine', 'beer',
  'can', 'bottle', 'jar', 'package', 'box', 'bag', 'frozen',
  'dessert', 'candy', 'chocolate', 'yogurt', 'butter', 'cream',
  'soup', 'noodle', 'pizza', 'sandwich', 'salad', 'cake', 'cookie',
];

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { key } = body;

    if (!key) {
      return respond(400, { error: 'Missing image key' });
    }

    const command = new DetectLabelsCommand({
      Image: {
        S3Object: {
          Bucket: BUCKET,
          Name: key,
        },
      },
      MaxLabels: 20,
      MinConfidence: 70,
    });

    const result = await rekognition.send(command);

    if (!result.Labels) {
      return respond(200, { items: [] });
    }

    // Filter for food-related labels
    const foodItems = result.Labels.filter((label) => {
      const labelName = label.Name?.toLowerCase() || '';
      const parents = label.Parents?.map((p) => p.Name?.toLowerCase() || '') || [];

      return (
        FOOD_CATEGORIES.some((cat) => labelName.includes(cat)) ||
        parents.some((parent) => FOOD_CATEGORIES.some((cat) => parent.includes(cat)))
      );
    });

    const items = foodItems.map((label) => ({
      name: label.Name || 'Unknown',
      confidence: label.Confidence || 0,
    }));

    return respond(200, { items });
  } catch (error: any) {
    console.error('Rekognition error:', error);
    return respond(500, { error: 'Failed to analyze image', message: error.message });
  }
}
```

- [ ] **Step 3: Verify backend TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/lambda/rekognition.ts backend/package.json backend/package-lock.json
git commit -m "feat: add Rekognition Lambda handler for image analysis (#4)"
```

---

### Task 3: Update rekognitionService to Use API Gateway

**Files:**
- Modify: `src/services/rekognitionService.ts`

- [ ] **Step 1: Replace the entire file**

Replace all of `/Users/huiliang/GitHub/ShelfLife/src/services/rekognitionService.ts` with:

```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';

export interface DetectedItem {
  name: string;
  confidence: number;
}

/**
 * Detects grocery items in an S3 image using AWS Rekognition via API Gateway
 * @param s3Key The S3 object key of the uploaded image
 * @returns Array of detected food items with confidence scores
 */
export async function detectGroceryItems(s3Key: string): Promise<DetectedItem[]> {
  if (!API_BASE_URL) return detectGroceryItemsMock(s3Key);

  const response = await fetch(`${API_BASE_URL}/images/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: s3Key }),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze image');
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Mock function for development/testing without AWS backend
 */
export async function detectGroceryItemsMock(imageBase64OrKey: string): Promise<DetectedItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return [
    { name: 'Apple', confidence: 98.5 },
    { name: 'Banana', confidence: 95.2 },
    { name: 'Milk', confidence: 89.7 },
    { name: 'Bread', confidence: 87.3 },
  ];
}
```

- [ ] **Step 2: Verify app TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

Expected: Errors in CameraScreen.tsx because it still calls `detectGroceryItemsMock(base64)` — this is fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/services/rekognitionService.ts
git commit -m "feat: replace direct Rekognition SDK with API Gateway fetch (#4)"
```

---

### Task 4: Update CameraScreen to Upload Then Analyze

**Files:**
- Modify: `src/screens/CameraScreen.tsx`

- [ ] **Step 1: Update imports**

Replace line 16:
```typescript
import { detectGroceryItemsMock, DetectedItem } from '@/services/rekognitionService';
```
with:
```typescript
import { detectGroceryItems, DetectedItem } from '@/services/rekognitionService';
```

- [ ] **Step 2: Add s3Key state**

After the `isUploading` state (line 40), add:

```typescript
  const [uploadedS3Key, setUploadedS3Key] = useState<string | null>(null);
```

- [ ] **Step 3: Replace the `analyzeImage` function**

Replace the `analyzeImage` function (lines 75-88) with a new version that uploads to S3 first, then analyzes:

```typescript
  const analyzeImage = async (imageUri: string) => {
    setIsAnalyzing(true);
    try {
      // Upload to S3 first
      const s3Key = await uploadImage(imageUri);
      setUploadedS3Key(s3Key);

      // Analyze the uploaded image via Rekognition
      const items = await detectGroceryItems(s3Key);
      setDetectedItems(items);
      setSelectedItems(new Set(items.map((item) => item.name)));
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };
```

- [ ] **Step 4: Update `takePicture` to pass URI instead of base64**

Replace lines 53-56:
```typescript
      if (photo?.uri) {
        setCapturedImage(photo.uri);
        analyzeImage(photo.base64 || '');
      }
```
with:
```typescript
      if (photo?.uri) {
        setCapturedImage(photo.uri);
        analyzeImage(photo.uri);
      }
```

- [ ] **Step 5: Update `pickImage` to pass URI instead of base64**

Replace lines 69-72:
```typescript
    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64 || '');
    }
```
with:
```typescript
    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      analyzeImage(result.assets[0].uri);
    }
```

- [ ] **Step 6: Update `addSelectedItems` to reuse the S3 key**

Replace the `addSelectedItems` function. Since the image is already uploaded during `analyzeImage`, we don't need to upload again. Replace the function with:

```typescript
  const addSelectedItems = async () => {
    selectedItems.forEach((itemName) => {
      addItem({
        userId: 'current-user',
        name: itemName,
        quantity: 1,
        unit: 'pcs',
        location: 'fridge',
        ownership: 'personal',
        imageUrl: uploadedS3Key || undefined,
      });
    });

    Alert.alert('Success', `Added ${selectedItems.size} item(s) to inventory`);
    onItemsAdded?.();
    onClose();
  };
```

- [ ] **Step 7: Update resetCapture to clear S3 key**

Replace the `resetCapture` function:

```typescript
  const resetCapture = () => {
    setCapturedImage(null);
    setDetectedItems([]);
    setSelectedItems(new Set());
    setUploadedS3Key(null);
  };
```

- [ ] **Step 8: Remove the `isUploading` state and update the Add button**

Since upload now happens during analysis (not during add), remove the `isUploading` state. The Add button no longer needs the upload spinner — it's just instant. Revert the Add button to simple:

```typescript
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    selectedItems.size === 0 && styles.addButtonDisabled,
                  ]}
                  onPress={addSelectedItems}
                  disabled={selectedItems.size === 0}
                >
                  <Text style={styles.addButtonText}>
                    Add {selectedItems.size} Item(s)
                  </Text>
                </TouchableOpacity>
```

- [ ] **Step 9: Verify app TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

- [ ] **Step 10: Commit**

```bash
git add src/screens/CameraScreen.tsx
git commit -m "feat: upload to S3 then analyze with Rekognition in camera flow (#4)"
```

---

### Task 5: Verification

- [ ] **Step 1: Full app TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

- [ ] **Step 2: Backend TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`

- [ ] **Step 3: Verify CDK synth**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`

- [ ] **Step 4: Verify Expo bundler**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo export --platform ios --output-dir /tmp/shelflife-export-test-5 2>&1 | tail -3`

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve any remaining issues for Rekognition integration (#4)"
```
