import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';

// AWS Configuration - these should be loaded from environment variables
const AWS_REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '';

const rekognitionClient = new RekognitionClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export interface DetectedItem {
  name: string;
  confidence: number;
}

// Food-related labels to filter for grocery items
const FOOD_CATEGORIES = [
  'Food',
  'Fruit',
  'Vegetable',
  'Meat',
  'Dairy',
  'Beverage',
  'Bread',
  'Snack',
  'Grocery',
  'Produce',
  'Seafood',
  'Bakery',
  'Condiment',
  'Sauce',
  'Spice',
  'Herb',
  'Grain',
  'Cereal',
  'Pasta',
  'Rice',
  'Egg',
  'Cheese',
  'Milk',
  'Juice',
  'Water',
  'Soda',
  'Wine',
  'Beer',
];

/**
 * Detects grocery items in an image using AWS Rekognition
 * @param imageBase64 Base64 encoded image data
 * @returns Array of detected food items with confidence scores
 */
export async function detectGroceryItems(imageBase64: string): Promise<DetectedItem[]> {
  try {
    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const command = new DetectLabelsCommand({
      Image: {
        Bytes: imageBytes,
      },
      MaxLabels: 20,
      MinConfidence: 70,
    });

    const response = await rekognitionClient.send(command);

    if (!response.Labels) {
      return [];
    }

    // Filter for food-related items and map to our format
    const foodItems = response.Labels.filter((label) => {
      const labelName = label.Name?.toLowerCase() || '';
      const parents = label.Parents?.map((p) => p.Name?.toLowerCase()) || [];

      // Check if this label or its parents are food-related
      return (
        FOOD_CATEGORIES.some((cat) => labelName.includes(cat.toLowerCase())) ||
        parents.some((parent) =>
          FOOD_CATEGORIES.some((cat) => parent?.includes(cat.toLowerCase()))
        )
      );
    });

    return foodItems.map((label) => ({
      name: label.Name || 'Unknown',
      confidence: label.Confidence || 0,
    }));
  } catch (error) {
    console.error('Error detecting labels:', error);
    throw new Error('Failed to analyze image. Please try again.');
  }
}

/**
 * Mock function for development/testing without AWS credentials
 */
export async function detectGroceryItemsMock(imageBase64: string): Promise<DetectedItem[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Return mock data
  return [
    { name: 'Apple', confidence: 98.5 },
    { name: 'Banana', confidence: 95.2 },
    { name: 'Milk', confidence: 89.7 },
    { name: 'Bread', confidence: 87.3 },
  ];
}
