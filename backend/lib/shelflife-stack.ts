import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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

    // ============ DynamoDB Tables ============

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'ShelfLife-Users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const householdsTable = new dynamodb.Table(this, 'HouseholdsTable', {
      tableName: 'ShelfLife-Households',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    householdsTable.addGlobalSecondaryIndex({
      indexName: 'inviteCode-index',
      partitionKey: { name: 'inviteCode', type: dynamodb.AttributeType.STRING },
    });

    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName: 'ShelfLife-Inventory',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    inventoryTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });
    inventoryTable.addGlobalSecondaryIndex({
      indexName: 'householdId-index',
      partitionKey: { name: 'householdId', type: dynamodb.AttributeType.STRING },
    });

    const shoppingListsTable = new dynamodb.Table(this, 'ShoppingListsTable', {
      tableName: 'ShelfLife-ShoppingLists',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    shoppingListsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });
    shoppingListsTable.addGlobalSecondaryIndex({
      indexName: 'householdId-index',
      partitionKey: { name: 'householdId', type: dynamodb.AttributeType.STRING },
    });

    const savedRecipesTable = new dynamodb.Table(this, 'SavedRecipesTable', {
      tableName: 'ShelfLife-SavedRecipes',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    savedRecipesTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // ============ DynamoDB CRUD Lambda ============

    const dynamodbCrud = new lambda.Function(this, 'DynamoDBCrud', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dynamodb-crud.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USERS_TABLE: usersTable.tableName,
        HOUSEHOLDS_TABLE: householdsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
        SHOPPING_LISTS_TABLE: shoppingListsTable.tableName,
        SAVED_RECIPES_TABLE: savedRecipesTable.tableName,
      },
    });

    usersTable.grantReadWriteData(dynamodbCrud);
    householdsTable.grantReadWriteData(dynamodbCrud);
    inventoryTable.grantReadWriteData(dynamodbCrud);
    shoppingListsTable.grantReadWriteData(dynamodbCrud);
    savedRecipesTable.grantReadWriteData(dynamodbCrud);

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

    const crudIntegration = new apigateway.LambdaIntegration(dynamodbCrud);

    // --- Users ---
    const users = api.root.addResource('users');
    users.addMethod('POST', crudIntegration);
    const userById = users.addResource('{id}');
    userById.addMethod('GET', crudIntegration);
    userById.addMethod('PUT', crudIntegration);

    // --- Inventory ---
    const inventory = api.root.addResource('inventory');
    inventory.addMethod('POST', crudIntegration);
    inventory.addMethod('GET', crudIntegration);
    const inventoryById = inventory.addResource('{id}');
    inventoryById.addMethod('PUT', crudIntegration);
    inventoryById.addMethod('DELETE', crudIntegration);
    const inventoryHousehold = inventory.addResource('household');
    const inventoryByHousehold = inventoryHousehold.addResource('{householdId}');
    inventoryByHousehold.addMethod('GET', crudIntegration);

    // --- Shopping Lists ---
    const shoppingLists = api.root.addResource('shopping-lists');
    shoppingLists.addMethod('POST', crudIntegration);
    shoppingLists.addMethod('GET', crudIntegration);
    const shoppingListById = shoppingLists.addResource('{id}');
    shoppingListById.addMethod('PUT', crudIntegration);
    shoppingListById.addMethod('DELETE', crudIntegration);
    const shoppingListHousehold = shoppingLists.addResource('household');
    const shoppingListByHousehold = shoppingListHousehold.addResource('{householdId}');
    shoppingListByHousehold.addMethod('GET', crudIntegration);

    // --- Saved Recipes ---
    const savedRecipes = api.root.addResource('saved-recipes');
    savedRecipes.addMethod('POST', crudIntegration);
    savedRecipes.addMethod('GET', crudIntegration);
    const savedRecipeById = savedRecipes.addResource('{id}');
    savedRecipeById.addMethod('DELETE', crudIntegration);

    // --- Households ---
    const households = api.root.addResource('households');
    households.addMethod('POST', crudIntegration);
    const householdById = households.addResource('{id}');
    householdById.addMethod('GET', crudIntegration);
    householdById.addMethod('PUT', crudIntegration);
    const householdInvite = households.addResource('invite');
    const householdByInvite = householdInvite.addResource('{code}');
    householdByInvite.addMethod('GET', crudIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL — set as EXPO_PUBLIC_API_GATEWAY_URL',
    });
  }
}
