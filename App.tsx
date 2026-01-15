import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  HomeScreen,
  InventoryScreen,
  RecipesScreen,
  ShoppingListScreen,
  AddItemScreen,
  CameraScreen,
  RecipeDetailScreen,
  LoginScreen,
  RegisterScreen,
  ConfirmScreen,
  ForgotPasswordScreen,
  ProfileScreen,
  SettingsScreen,
  HouseholdScreen,
} from '@screens/index';
import { RootStackParamList, RootTabParamList } from '@/types';
import { useShoppingStore, useAuthStore, useInventoryStore, useRecipesStore } from '@/store';
import { useSync, useNotifications } from '@/hooks';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();

// ============ Auth Navigator ============
type AuthScreen = 'Login' | 'Register' | 'Confirm' | 'ForgotPassword';

function AuthNavigator() {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('Login');
  const [confirmEmail, setConfirmEmail] = useState('');

  if (currentScreen === 'Login') {
    return (
      <LoginScreen
        onNavigateToRegister={() => setCurrentScreen('Register')}
        onNavigateToForgotPassword={() => setCurrentScreen('ForgotPassword')}
      />
    );
  }

  if (currentScreen === 'Register') {
    return (
      <RegisterScreen
        onNavigateToLogin={() => setCurrentScreen('Login')}
        onNavigateToConfirm={(email) => {
          setConfirmEmail(email);
          setCurrentScreen('Confirm');
        }}
      />
    );
  }

  if (currentScreen === 'Confirm') {
    return (
      <ConfirmScreen
        email={confirmEmail}
        onConfirmSuccess={() => setCurrentScreen('Login')}
        onBack={() => setCurrentScreen('Register')}
      />
    );
  }

  if (currentScreen === 'ForgotPassword') {
    return (
      <ForgotPasswordScreen
        onBack={() => setCurrentScreen('Login')}
        onResetSuccess={() => setCurrentScreen('Login')}
      />
    );
  }

  return null;
}

// ============ Main Tab Navigator ============
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Inventory' }}
      />
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{ title: 'Recipes' }}
      />
      <Tab.Screen
        name="Shopping"
        component={ShoppingListScreen}
        options={{ title: 'Shopping' }}
      />
    </Tab.Navigator>
  );
}

// ============ Modal Screens ============
function AddItemModal({ navigation }: any) {
  return (
    <AddItemScreen
      onClose={() => navigation.goBack()}
      onSuccess={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}
    />
  );
}

function CameraModal({ navigation }: any) {
  return (
    <CameraScreen
      onClose={() => navigation.goBack()}
      onItemsAdded={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}
    />
  );
}

function RecipeDetailModal({ navigation, route }: any) {
  const { lists, activeListId, createList, addItems } = useShoppingStore();

  const handleAddToShoppingList = (ingredients: { name: string; amount: number; unit: string }[]) => {
    let targetListId = activeListId;

    if (!targetListId || lists.length === 0) {
      targetListId = createList('Recipe Ingredients');
    }

    addItems(
      targetListId,
      ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.amount,
        unit: ing.unit,
      }))
    );

    navigation.navigate('MainTabs', { screen: 'Shopping' });
  };

  return (
    <RecipeDetailScreen
      recipeId={route.params.recipeId}
      onClose={() => navigation.goBack()}
      onAddToShoppingList={handleAddToShoppingList}
    />
  );
}

function ProfileModal({ navigation }: any) {
  return (
    <ProfileScreen
      onClose={() => navigation.goBack()}
      onNavigateToSettings={() => navigation.navigate('Settings')}
      onNavigateToHousehold={() => navigation.navigate('HouseholdManagement')}
    />
  );
}

function SettingsModal({ navigation }: any) {
  return <SettingsScreen onClose={() => navigation.goBack()} />;
}

function HouseholdModal({ navigation }: any) {
  return <HouseholdScreen onClose={() => navigation.goBack()} />;
}

// ============ Main App Navigator ============
function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddItem"
        component={AddItemModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Camera"
        component={CameraModal}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="HouseholdManagement"
        component={HouseholdModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

// ============ Loading Screen ============
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

// ============ Root App ============
export default function App() {
  const { isAuthenticated, isInitialized, initialize } = useAuthStore();
  const { loadFromLocal: loadInventory } = useInventoryStore();
  const { loadFromLocal: loadRecipes } = useRecipesStore();
  const { loadFromLocal: loadShopping } = useShoppingStore();

  // Enable background sync
  useSync();

  // Enable push notifications
  useNotifications();

  useEffect(() => {
    initialize();
  }, []);

  // Load data from local storage when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadInventory();
      loadRecipes();
      loadShopping();
    }
  }, [isAuthenticated]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
