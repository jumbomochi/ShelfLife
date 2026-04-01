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
