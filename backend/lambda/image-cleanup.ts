import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});
const BUCKET = process.env.IMAGES_BUCKET!;
const INVENTORY_TABLE = process.env.INVENTORY_TABLE!;

export async function handler(): Promise<void> {
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

  const orphanedKeys = Array.from(s3Keys).filter((key) => !referencedKeys.has(key));

  if (orphanedKeys.length === 0) {
    console.log(`All ${s3Keys.size} images are referenced, nothing to delete`);
    return;
  }

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
