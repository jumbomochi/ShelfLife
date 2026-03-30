import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

const TABLES = {
  USERS: process.env.USERS_TABLE!,
  HOUSEHOLDS: process.env.HOUSEHOLDS_TABLE!,
  INVENTORY: process.env.INVENTORY_TABLE!,
  SHOPPING_LISTS: process.env.SHOPPING_LISTS_TABLE!,
  SAVED_RECIPES: process.env.SAVED_RECIPES_TABLE!,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

async function putItem(table: string, item: Record<string, unknown>): Promise<void> {
  await client.send(new PutItemCommand({
    TableName: table,
    Item: marshall(item, { removeUndefinedValues: true }),
  }));
}

async function getItem(table: string, key: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const result = await client.send(new GetItemCommand({
    TableName: table,
    Key: marshall(key),
  }));
  return result.Item ? unmarshall(result.Item) : null;
}

async function queryByIndex(
  table: string,
  indexName: string,
  keyField: string,
  keyValue: string
): Promise<Record<string, unknown>[]> {
  const result = await client.send(new QueryCommand({
    TableName: table,
    IndexName: indexName,
    KeyConditionExpression: `${keyField} = :val`,
    ExpressionAttributeValues: marshall({ ':val': keyValue }),
  }));
  return (result.Items || []).map((item) => unmarshall(item));
}

async function deleteItemByKey(table: string, key: Record<string, unknown>): Promise<void> {
  await client.send(new DeleteItemCommand({
    TableName: table,
    Key: marshall(key),
  }));
}

async function updateItem(
  table: string,
  key: Record<string, unknown>,
  updates: Record<string, unknown>
): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  Object.entries(updates).forEach(([field, value], i) => {
    if (value !== undefined) {
      expressions.push(`#f${i} = :v${i}`);
      names[`#f${i}`] = field;
      values[`:v${i}`] = value;
    }
  });

  if (expressions.length === 0) return;

  await client.send(new UpdateItemCommand({
    TableName: table,
    Key: marshall(key),
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: marshall(values),
  }));
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;
  const pathParams = event.pathParameters || {};
  const queryParams = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : null;

  try {
    // --- Users ---
    if (resource === '/users' && method === 'POST') {
      await putItem(TABLES.USERS, body);
      return respond(201, { message: 'User created' });
    }
    if (resource === '/users/{id}' && method === 'GET') {
      const item = await getItem(TABLES.USERS, { id: pathParams.id });
      return item ? respond(200, item) : respond(404, { error: 'User not found' });
    }
    if (resource === '/users/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.USERS, { id: pathParams.id }, updates);
      return respond(200, { message: 'User updated' });
    }

    // --- Inventory ---
    if (resource === '/inventory' && method === 'POST') {
      await putItem(TABLES.INVENTORY, body);
      return respond(201, { message: 'Item created' });
    }
    if (resource === '/inventory' && method === 'GET') {
      const userId = queryParams.userId;
      if (!userId) return respond(400, { error: 'Missing userId query param' });
      const items = await queryByIndex(TABLES.INVENTORY, 'userId-index', 'userId', userId);
      return respond(200, items);
    }
    if (resource === '/inventory/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.INVENTORY, { id: pathParams.id }, updates);
      return respond(200, { message: 'Item updated' });
    }
    if (resource === '/inventory/{id}' && method === 'DELETE') {
      await deleteItemByKey(TABLES.INVENTORY, { id: pathParams.id });
      return respond(200, { message: 'Item deleted' });
    }
    if (resource === '/inventory/household/{householdId}' && method === 'GET') {
      const items = await queryByIndex(TABLES.INVENTORY, 'householdId-index', 'householdId', pathParams.householdId!);
      return respond(200, items);
    }

    // --- Shopping Lists ---
    if (resource === '/shopping-lists' && method === 'POST') {
      await putItem(TABLES.SHOPPING_LISTS, body);
      return respond(201, { message: 'List created' });
    }
    if (resource === '/shopping-lists' && method === 'GET') {
      const userId = queryParams.userId;
      if (!userId) return respond(400, { error: 'Missing userId query param' });
      const lists = await queryByIndex(TABLES.SHOPPING_LISTS, 'userId-index', 'userId', userId);
      return respond(200, lists);
    }
    if (resource === '/shopping-lists/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.SHOPPING_LISTS, { id: pathParams.id }, updates);
      return respond(200, { message: 'List updated' });
    }
    if (resource === '/shopping-lists/{id}' && method === 'DELETE') {
      await deleteItemByKey(TABLES.SHOPPING_LISTS, { id: pathParams.id });
      return respond(200, { message: 'List deleted' });
    }
    if (resource === '/shopping-lists/household/{householdId}' && method === 'GET') {
      const lists = await queryByIndex(TABLES.SHOPPING_LISTS, 'householdId-index', 'householdId', pathParams.householdId!);
      return respond(200, lists);
    }

    // --- Saved Recipes ---
    if (resource === '/saved-recipes' && method === 'POST') {
      await putItem(TABLES.SAVED_RECIPES, body);
      return respond(201, { message: 'Recipe saved' });
    }
    if (resource === '/saved-recipes' && method === 'GET') {
      const userId = queryParams.userId;
      if (!userId) return respond(400, { error: 'Missing userId query param' });
      const recipes = await queryByIndex(TABLES.SAVED_RECIPES, 'userId-index', 'userId', userId);
      return respond(200, recipes);
    }
    if (resource === '/saved-recipes/{id}' && method === 'DELETE') {
      await deleteItemByKey(TABLES.SAVED_RECIPES, { id: pathParams.id });
      return respond(200, { message: 'Recipe deleted' });
    }

    // --- Households ---
    if (resource === '/households' && method === 'POST') {
      await putItem(TABLES.HOUSEHOLDS, body);
      return respond(201, { message: 'Household created' });
    }
    if (resource === '/households/{id}' && method === 'GET') {
      const item = await getItem(TABLES.HOUSEHOLDS, { id: pathParams.id });
      return item ? respond(200, item) : respond(404, { error: 'Household not found' });
    }
    if (resource === '/households/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.HOUSEHOLDS, { id: pathParams.id }, updates);
      return respond(200, { message: 'Household updated' });
    }
    if (resource === '/households/invite/{code}' && method === 'GET') {
      const households = await queryByIndex(TABLES.HOUSEHOLDS, 'inviteCode-index', 'inviteCode', pathParams.code!);
      return households.length > 0 ? respond(200, households[0]) : respond(404, { error: 'Household not found' });
    }

    return respond(400, { error: 'Unknown route', resource, method });
  } catch (error: any) {
    console.error('DynamoDB CRUD error:', error);
    return respond(500, { error: 'Internal server error', message: error.message });
  }
}
