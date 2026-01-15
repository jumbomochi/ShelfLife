# ShelfLife - Pantry & Fridge Organizer App

## Project Overview

ShelfLife is a mobile application that helps users manage their kitchen inventory by tracking items in their fridge and pantry. Users can add items by taking photos, and the app provides recipe suggestions and shopping list generation based on available ingredients.

## Core Features

### 1. Inventory Management
- **Item Entry Methods:**
  - Camera capture with AWS Rekognition for item identification
  - Manual text entry for items that can't be recognized
- **Item Details (Basic):**
  - Name
  - Quantity and unit
  - Location (fridge or pantry)
  - Expiration date
- **Organization:**
  - Personal items (private to user)
  - Shared household inventory (accessible by household members)

### 2. User & Household System
- Individual user accounts via AWS Cognito
- Household sharing - multiple users can share the same inventory
- Both personal and shared inventory modes
- User preferences and settings

### 3. Recipe Feature
- **Recipe Matching:** Show recipes that can be made with current inventory
- **External Search:** Integration with Spoonacular API for recipe discovery
- **Save Favorites:** Users can save recipes to their personal collection
- Filter by dietary restrictions and preferences

### 4. Shopping List
- **Recipe-based Generation:** Create shopping lists from selected recipes
- **Auto-suggestions:** Suggest items based on low stock and expiring items
- **Manual Management:** Add, edit, remove items manually
- Check off items while shopping

### 5. Notifications
- Push notifications for items expiring soon
- Configurable notification timing (e.g., 3 days before, 1 day before)
- Low stock alerts

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Zustand (lightweight and simple)
- **Backend/Database**: AWS DynamoDB
- **Authentication**: AWS Cognito
- **Image Recognition**: AWS Rekognition
- **Cloud Infrastructure**: AWS (Lambda, API Gateway, S3 for image storage)
- **Recipe API**: Spoonacular API
- **Push Notifications**: Expo Notifications + AWS SNS

## AWS Architecture

```
Mobile App
    │
    ├── AWS Cognito (Auth)
    │
    ├── API Gateway + Lambda
    │       │
    │       ├── DynamoDB (inventory, recipes, shopping lists)
    │       │
    │       └── S3 (image storage)
    │
    └── AWS Rekognition (image analysis for item detection)
```

### DynamoDB Tables
- **Users** - user profiles, preferences, notification settings
- **Households** - household groups with member lists
- **InventoryItems** - pantry/fridge items with expiration dates (supports personal & shared)
- **SavedRecipes** - user's saved/favorite recipes from Spoonacular
- **ShoppingLists** - user shopping lists with items

## Project Structure

```
/src
  /components    # Reusable UI components
  /screens       # App screens/pages
  /services      # API and external service integrations
  /hooks         # Custom React hooks
  /utils         # Helper functions
  /types         # TypeScript type definitions
  /assets        # Images, fonts, etc.
```

## Development Guidelines

- Use functional components with hooks
- Maintain strict TypeScript typing
- Follow React Native best practices
- Keep components small and focused
- Write meaningful commit messages

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npx expo start
```

## Status

Project initialized with basic navigation structure. Ready for feature development.

## App Screens

1. **Home** - Dashboard with expiring items, quick actions
2. **Inventory** - List/grid view of all items, filter by fridge/pantry
3. **Add Item** - Camera capture or manual entry
4. **Recipes** - Browse recipes, search, view saved
5. **Recipe Detail** - Full recipe with ingredients, instructions
6. **Shopping List** - Manage shopping lists
7. **Profile/Settings** - User settings, household management, notifications
