import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '@/types';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'shelflife://', 'https://shelflife.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Inventory: 'inventory',
          Recipes: 'recipes',
          Shopping: 'shopping/:listId?',
        },
      },
      EditItem: 'inventory/:itemId',
      RecipeDetail: 'recipes/:recipeId',
      HouseholdManagement: 'household',
      Settings: 'settings',
      Profile: 'profile',
    },
  },
};
