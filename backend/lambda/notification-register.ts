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
