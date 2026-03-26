import { BarcodeProduct } from '@/types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2/product';

// Categories that suggest fridge storage
const FRIDGE_CATEGORIES = [
  'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream',
  'meat', 'poultry', 'fish', 'seafood', 'eggs',
  'fresh', 'vegetables', 'fruits', 'salad', 'juice',
  'deli', 'tofu', 'sausage',
];

export function suggestLocation(categories: string[]): 'fridge' | 'pantry' {
  const lowerCategories = categories.map((c) => c.toLowerCase());
  const isFridge = lowerCategories.some((cat) =>
    FRIDGE_CATEGORIES.some((fc) => cat.includes(fc))
  );
  return isFridge ? 'fridge' : 'pantry';
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_API}/${barcode}.json`);
    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    return {
      barcode,
      name: product.product_name || product.product_name_en || '',
      quantity: product.quantity || undefined,
      brand: product.brands || undefined,
      categories: product.categories_tags || [],
      imageUrl: product.image_url || undefined,
    };
  } catch {
    return null;
  }
}

export async function lookupBarcodeMock(barcode: string): Promise<BarcodeProduct | null> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const mockProducts: Record<string, BarcodeProduct> = {
    '4902430590990': {
      barcode: '4902430590990',
      name: 'Meiji Fresh Milk',
      quantity: '1L',
      brand: 'Meiji',
      categories: ['en:dairy', 'en:milk'],
      imageUrl: undefined,
    },
    '8888163100015': {
      barcode: '8888163100015',
      name: 'Yeo\'s Soy Bean Drink',
      quantity: '250ml',
      brand: 'Yeo\'s',
      categories: ['en:beverages', 'en:soy-drinks'],
      imageUrl: undefined,
    },
    default: {
      barcode,
      name: 'Sample Product',
      quantity: '500g',
      brand: 'Test Brand',
      categories: ['en:snacks'],
      imageUrl: undefined,
    },
  };

  return mockProducts[barcode] || mockProducts['default'];
}
