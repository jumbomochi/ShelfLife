# Push Notifications Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cloud-based push notifications for expiring items via Expo push API, with device token registration and a daily scheduled Lambda.

**Architecture:** Two new Lambdas added to CDK stack: one for token registration (API Gateway route), one for daily expiration scanning (EventBridge). The app registers its Expo push token on login. The scheduled Lambda scans DynamoDB for expiring items and sends push via Expo's push service.

**Tech Stack:** AWS CDK, Lambda, EventBridge, DynamoDB, Expo Push API

---

## File Map

### New Files (Backend)
- `backend/lambda/notification-register.ts` — Token registration handler
- `backend/lambda/expiration-notifier.ts` — Scheduled daily push sender

### Modified Files (Backend)
- `backend/lib/shelflife-stack.ts` — Lambdas, EventBridge rule, API route

### Modified Files (App)
- `src/services/notificationService.ts` — Add `registerPushToken`
- `src/hooks/useNotifications.ts` — Call registration on login

---

### Task 1: Add Notification Lambdas to CDK Stack

**Files:**
- Modify: `backend/lib/shelflife-stack.ts`

- [ ] **Step 1: Add notification Lambdas and EventBridge rule**

Insert after the Rekognition Lambda section (after `rekognitionAnalyzer.addToRolePolicy(...)`, before `// ============ DynamoDB CRUD Lambda ============`):

```typescript
    // ============ Notification Lambdas ============

    const notificationRegister = new lambda.Function(this, 'NotificationRegister', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'notification-register.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USERS_TABLE: usersTable.tableName,
      },
    });

    usersTable.grantWriteData(notificationRegister);

    const expirationNotifier = new lambda.Function(this, 'ExpirationNotifier', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'expiration-notifier.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: {
        USERS_TABLE: usersTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    usersTable.grantReadData(expirationNotifier);
    inventoryTable.grantReadData(expirationNotifier);

    new events.Rule(this, 'ExpirationNotifierSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }), // midnight UTC = 8am SGT
      targets: [new targets.LambdaFunction(expirationNotifier)],
    });
```

- [ ] **Step 2: Add API route for notification registration**

Insert after the images/analyze route (after `analyzeImage.addMethod('POST', rekognitionIntegration);`), before `// Outputs`:

```typescript
    // --- Notifications ---
    const notifRegisterIntegration = new apigateway.LambdaIntegration(notificationRegister);
    const notifications = api.root.addResource('notifications');
    const registerRoute = notifications.addResource('register');
    registerRoute.addMethod('POST', notifRegisterIntegration);
```

- [ ] **Step 3: Verify CDK synth**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`

- [ ] **Step 4: Commit**

```bash
git add backend/lib/shelflife-stack.ts
git commit -m "feat: add notification Lambdas and EventBridge schedule to CDK stack (#6)"
```

---

### Task 2: Notification Registration Lambda

**Files:**
- Create: `backend/lambda/notification-register.ts`

- [ ] **Step 1: Create the handler**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});
const USERS_TABLE = process.env.USERS_TABLE!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { userId, pushToken } = body;

    if (!userId || !pushToken) {
      return respond(400, { error: 'Missing userId or pushToken' });
    }

    await client.send(new UpdateItemCommand({
      TableName: USERS_TABLE,
      Key: marshall({ id: userId }),
      UpdateExpression: 'SET pushToken = :token, pushTokenUpdatedAt = :updatedAt',
      ExpressionAttributeValues: marshall({
        ':token': pushToken,
        ':updatedAt': new Date().toISOString(),
      }),
    }));

    return respond(200, { message: 'Push token registered' });
  } catch (error: any) {
    console.error('Token registration error:', error);
    return respond(500, { error: 'Failed to register push token', message: error.message });
  }
}
```

- [ ] **Step 2: Verify backend TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/lambda/notification-register.ts
git commit -m "feat: add notification token registration Lambda (#6)"
```

---

### Task 3: Expiration Notifier Lambda

**Files:**
- Create: `backend/lambda/expiration-notifier.ts`

- [ ] **Step 1: Create the handler**

```typescript
import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});
const USERS_TABLE = process.env.USERS_TABLE!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const WARNING_DAYS = [1, 3, 7];

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
}

export async function handler(): Promise<void> {
  // 1. Get all users with push tokens
  const usersWithTokens: Array<{ id: string; pushToken: string }> = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await client.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'attribute_exists(pushToken)',
      ProjectionExpression: 'id, pushToken',
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      const record = unmarshall(item);
      if (record.id && record.pushToken) {
        usersWithTokens.push({ id: record.id, pushToken: record.pushToken });
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  if (usersWithTokens.length === 0) {
    console.log('No users with push tokens registered');
    return;
  }

  console.log(`Found ${usersWithTokens.length} users with push tokens`);

  // 2. For each user, check their inventory for expiring items
  const messages: PushMessage[] = [];
  const now = new Date();

  for (const user of usersWithTokens) {
    const inventoryResult = await client.send(new QueryCommand({
      TableName: INVENTORY_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({ ':userId': user.id }),
    }));

    const expiringItems: Array<{ name: string; daysLeft: number; location: string }> = [];

    for (const item of inventoryResult.Items || []) {
      const record = unmarshall(item);
      if (!record.expirationDate) continue;

      const expDate = new Date(record.expirationDate as string);
      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (WARNING_DAYS.includes(daysLeft)) {
        expiringItems.push({
          name: record.name as string,
          daysLeft,
          location: record.location as string,
        });
      }
    }

    if (expiringItems.length === 0) continue;

    // Group by urgency
    if (expiringItems.length === 1) {
      const item = expiringItems[0];
      const emoji = item.daysLeft <= 1 ? '🚨' : item.daysLeft <= 3 ? '⚠️' : '📅';
      const dayText = item.daysLeft === 1 ? 'day' : 'days';
      messages.push({
        to: user.pushToken,
        title: `${emoji} Expiring Soon: ${item.name}`,
        body: `${item.name} expires in ${item.daysLeft} ${dayText}. Location: ${item.location}`,
        data: { type: 'expiration-warning' },
        sound: 'default',
      });
    } else {
      const urgent = expiringItems.filter((i) => i.daysLeft <= 1).length;
      const soon = expiringItems.filter((i) => i.daysLeft > 1).length;
      let body = `${expiringItems.length} items need attention: `;
      body += expiringItems.map((i) => `${i.name} (${i.daysLeft}d)`).join(', ');

      messages.push({
        to: user.pushToken,
        title: urgent > 0 ? `🚨 ${urgent} item(s) expiring today!` : `📦 ${soon} item(s) expiring soon`,
        body,
        data: { type: 'expiration-warning' },
        sound: 'default',
      });
    }
  }

  if (messages.length === 0) {
    console.log('No expiration notifications to send');
    return;
  }

  // 3. Send via Expo push API (batch up to 100)
  let totalSent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error(`Expo push failed: ${response.status}`);
    } else {
      totalSent += batch.length;
    }
  }

  console.log(`Sent ${totalSent} expiration notifications`);
}
```

- [ ] **Step 2: Verify backend TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/lambda/expiration-notifier.ts
git commit -m "feat: add daily expiration notifier Lambda with Expo push (#6)"
```

---

### Task 4: Client Push Token Registration

**Files:**
- Modify: `src/services/notificationService.ts`
- Modify: `src/hooks/useNotifications.ts`

- [ ] **Step 1: Add registerPushToken to notificationService**

In `src/services/notificationService.ts`, add at the end of the file (before the last line or after `clearBadge`):

```typescript
// ============ Cloud Push Token Registration ============

const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';

export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    if (!API_BASE_URL) {
      console.log('Push token (mock):', pushToken);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/notifications/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pushToken }),
    });

    if (!response.ok) {
      console.error('Failed to register push token:', response.status);
    }
  } catch (error) {
    console.error('Push token registration error:', error);
  }
}
```

- [ ] **Step 2: Update useNotifications to register token on login**

In `src/hooks/useNotifications.ts`, add the import for `registerPushToken`:

Replace line 4-8:
```typescript
import {
  requestNotificationPermissions,
  scheduleExpirationNotifications,
  setBadgeCount,
  getNotificationSettings,
  registerPushToken,
} from '@/services/notificationService';
```

Add a ref to track registration. After the existing refs (after line 13), add:

```typescript
  const hasRegistered = useRef(false);
```

Inside the `setup` async function, after `if (!granted) return;`, add:

```typescript
      // Register push token with backend (once per session)
      if (!hasRegistered.current && user?.sub) {
        hasRegistered.current = true;
        registerPushToken(user.sub);
      }
```

Also add `user` to the destructured auth store. Replace line 15:
```typescript
  const { isAuthenticated, user } = useAuthStore();
```

- [ ] **Step 3: Verify app TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/services/notificationService.ts src/hooks/useNotifications.ts
git commit -m "feat: register Expo push token with backend on login (#6)"
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

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo export --platform ios --output-dir /tmp/shelflife-export-test-6 2>&1 | tail -3`

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve any remaining issues for push notifications integration (#6)"
```
