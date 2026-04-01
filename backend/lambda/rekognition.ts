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
