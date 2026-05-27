import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});
const USERS_TABLE = process.env.USERS_TABLE!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_MIN_QUANTITY = 1;

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
}

export async function handler(): Promise<void> {
  const usersWithTokens: Array<{ id: string; pushToken: string; lowStockAlerts: boolean }> = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await client.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'attribute_exists(pushToken)',
      ProjectionExpression: 'id, pushToken, notificationSettings',
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      const record = unmarshall(item);
      if (!record.id || !record.pushToken) continue;
      const settings = (record.notificationSettings as any) || {};
      // Default to true if not set; respect explicit false.
      const lowStockAlerts = settings.lowStockAlerts !== false;
      usersWithTokens.push({
        id: record.id,
        pushToken: record.pushToken,
        lowStockAlerts,
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  if (usersWithTokens.length === 0) {
    console.log('No users with push tokens');
    return;
  }

  const messages: PushMessage[] = [];

  for (const user of usersWithTokens) {
    if (!user.lowStockAlerts) continue;

    const inventoryResult = await client.send(new QueryCommand({
      TableName: INVENTORY_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({ ':userId': user.id }),
    }));

    const lowStock: Array<{ name: string; quantity: number; unit: string }> = [];

    for (const item of inventoryResult.Items || []) {
      const record = unmarshall(item);
      const quantity = typeof record.quantity === 'number' ? record.quantity : 0;
      const threshold = typeof record.minQuantity === 'number' ? record.minQuantity : DEFAULT_MIN_QUANTITY;
      if (quantity <= threshold) {
        lowStock.push({
          name: record.name as string,
          quantity,
          unit: record.unit as string,
        });
      }
    }

    if (lowStock.length === 0) continue;

    if (lowStock.length === 1) {
      const item = lowStock[0];
      messages.push({
        to: user.pushToken,
        title: `📉 Low Stock: ${item.name}`,
        body: `Only ${item.quantity} ${item.unit} left of ${item.name}.`,
        data: { type: 'low-stock' },
        sound: 'default',
      });
    } else {
      messages.push({
        to: user.pushToken,
        title: `📉 ${lowStock.length} items running low`,
        body: lowStock.slice(0, 5).map((i) => i.name).join(', ') + (lowStock.length > 5 ? '…' : ''),
        data: { type: 'low-stock' },
        sound: 'default',
      });
    }
  }

  if (messages.length === 0) {
    console.log('No low-stock notifications to send');
    return;
  }

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

  console.log(`Sent ${totalSent} low-stock notifications`);
}
