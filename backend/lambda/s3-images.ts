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

    if (resource === '/images/{key}' && method === 'GET') {
      const key = pathParams.key;
      if (!key) {
        return respond(400, { error: 'Missing image key' });
      }

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
