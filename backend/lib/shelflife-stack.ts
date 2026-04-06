import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    // ============ S3 Image Storage ============

    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `shelflife-images-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 Images Lambda (presigned URLs)
    const s3Images = new lambda.Function(this, 'S3Images', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 's3-images.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
    });

    imagesBucket.grantReadWrite(s3Images);

    // Image Cleanup Lambda (scheduled)
    const imageCleanup = new lambda.Function(this, 'ImageCleanup', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'image-cleanup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      environment: {
        IMAGES_BUCKET: imagesBucket.bucketName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    imagesBucket.grantReadWrite(imageCleanup);
    inventoryTable.grantReadData(imageCleanup);

    new events.Rule(this, 'ImageCleanupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      targets: [new targets.LambdaFunction(imageCleanup)],
    });

    // ============ Rekognition Lambda ============

    const rekognitionAnalyzer = new lambda.Function(this, 'RekognitionAnalyzer', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'rekognition.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      environment: {
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
    });

    imagesBucket.grantRead(rekognitionAnalyzer);
    rekognitionAnalyzer.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rekognition:DetectLabels'],
      resources: ['*'],
    }));

    // ============ Notification Lambdas ============

    const notificationRegister = new lambda.Function(this, 'NotificationRegister', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'notification-register.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USERS_TABLE: usersTable.tableName,
      },
    });

    usersTable.grantWriteData(notificationRegister);

    const expirationNotifier = new lambda.Function(this, 'ExpirationNotifier', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'expiration-notifier.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: {
        USERS_TABLE: usersTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
      },
    });

    usersTable.grantReadData(expirationNotifier);
    inventoryTable.grantReadData(expirationNotifier);

    new events.Rule(this, 'ExpirationNotifierSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(expirationNotifier)],
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

    // --- Images ---
    const s3Integration = new apigateway.LambdaIntegration(s3Images);
    const images = api.root.addResource('images');
    const uploadUrl = images.addResource('upload-url');
    uploadUrl.addMethod('POST', s3Integration);
    const imageByKey = images.addResource('{key}');
    imageByKey.addMethod('GET', s3Integration);

    // POST /images/analyze
    const rekognitionIntegration = new apigateway.LambdaIntegration(rekognitionAnalyzer);
    const analyzeImage = images.addResource('analyze');
    analyzeImage.addMethod('POST', rekognitionIntegration);

    // --- Notifications ---
    const notifRegisterIntegration = new apigateway.LambdaIntegration(notificationRegister);
    const notifications = api.root.addResource('notifications');
    const registerRoute = notifications.addResource('register');
    registerRoute.addMethod('POST', notifRegisterIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL — set as EXPO_PUBLIC_API_GATEWAY_URL',
    });

    new cdk.CfnOutput(this, 'ImagesBucketName', {
      value: imagesBucket.bucketName,
      description: 'S3 bucket for item images',
    });
  }
}
