import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';

export class ShelfLifeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const spoonacularApiKey = this.node.tryGetContext('spoonacularApiKey');
    if (!spoonacularApiKey) {
      throw new Error(
        'Missing spoonacularApiKey context. Deploy with: cdk deploy --context spoonacularApiKey=YOUR_KEY'
      );
    }

    // Lambda function
    const spoonacularProxy = new lambda.Function(this, 'SpoonacularProxy', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'spoonacular.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SPOONACULAR_API_KEY: spoonacularApiKey,
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'ShelfLifeApi', {
      restApiName: 'ShelfLife API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(spoonacularProxy);

    // Routes
    const recipes = api.root.addResource('recipes');

    // GET /recipes/search
    const search = recipes.addResource('search');
    search.addMethod('GET', lambdaIntegration);

    // GET /recipes/findByIngredients
    const findByIngredients = recipes.addResource('findByIngredients');
    findByIngredients.addMethod('GET', lambdaIntegration);

    // GET /recipes/{id}
    const recipeById = recipes.addResource('{id}');
    recipeById.addMethod('GET', lambdaIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL — set as EXPO_PUBLIC_API_GATEWAY_URL',
    });
  }
}
