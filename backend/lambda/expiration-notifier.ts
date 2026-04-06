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
