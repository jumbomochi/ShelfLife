import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function buildResponse(statusCode: number, body: string): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return buildResponse(500, JSON.stringify({ error: 'Server configuration error' }));
  }

  const path = event.resource;
  const queryParams = event.queryStringParameters || {};
  const pathParams = event.pathParameters || {};

  let spoonacularUrl: string;

  switch (path) {
    case '/recipes/search': {
      const params = new URLSearchParams({ ...queryParams, apiKey });
      spoonacularUrl = `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`;
      break;
    }
    case '/recipes/findByIngredients': {
      const params = new URLSearchParams({ ...queryParams, apiKey });
      spoonacularUrl = `${SPOONACULAR_BASE_URL}/recipes/findByIngredients?${params}`;
      break;
    }
    case '/recipes/{id}': {
      const recipeId = pathParams.id;
      if (!recipeId) {
        return buildResponse(400, JSON.stringify({ error: 'Missing recipe ID' }));
      }
      const params = new URLSearchParams({ apiKey });
      spoonacularUrl = `${SPOONACULAR_BASE_URL}/recipes/${recipeId}/information?${params}`;
      break;
    }
    default:
      return buildResponse(400, JSON.stringify({ error: 'Unknown route' }));
  }

  try {
    const response = await fetch(spoonacularUrl);
    const data = await response.text();

    if (!response.ok) {
      return buildResponse(502, JSON.stringify({
        error: 'Spoonacular API error',
        status: response.status,
      }));
    }

    return buildResponse(200, data);
  } catch (error) {
    return buildResponse(502, JSON.stringify({ error: 'Failed to reach Spoonacular API' }));
  }
}
