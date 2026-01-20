import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthTokens,
  CognitoUser,
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  forgotPassword as cognitoForgotPassword,
  confirmForgotPassword as cognitoConfirmForgotPassword,
  signOut as cognitoSignOut,
  getCurrentUser,
  refreshTokens,
  updateUserAttributes,
  changePassword as cognitoChangePassword,
} from '@/services/authService';

const AUTH_STORAGE_KEY = '@shelflife_auth';

interface AuthState {
  user: CognitoUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;

  // Session management
  initialize: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const tokens = await cognitoSignIn(email, password);
      const user = await getCurrentUser(tokens.accessToken);

      // Persist auth state
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user, tokens })
      );

      set({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Sign in failed',
        isLoading: false,
      });
      throw error;
    }
  },

  signUp: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      await cognitoSignUp(email, password, name);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Sign up failed',
        isLoading: false,
      });
      throw error;
    }
  },

  confirmSignUp: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      await cognitoConfirmSignUp(email, code);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Confirmation failed',
        isLoading: false,
      });
      throw error;
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await cognitoForgotPassword(email);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to send reset code',
        isLoading: false,
      });
      throw error;
    }
  },

  confirmForgotPassword: async (email, code, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      await cognitoConfirmForgotPassword(email, code, newPassword);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Password reset failed',
        isLoading: false,
      });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      const tokens = get().tokens;
      if (tokens?.accessToken) {
        await cognitoSignOut(tokens.accessToken);
      }
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);

      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error: any) {
      // Still clear local state even if remote sign out fails
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateProfile: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const tokens = get().tokens;
      if (!tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      await updateUserAttributes(tokens.accessToken, { name });

      // Update local user state with new name
      const currentUser = get().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, username: name };
        set({ user: updatedUser, isLoading: false });

        // Persist updated user
        await AsyncStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ user: updatedUser, tokens })
        );
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update profile',
        isLoading: false,
      });
      throw error;
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      const tokens = get().tokens;
      if (!tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      await cognitoChangePassword(tokens.accessToken, oldPassword, newPassword);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to change password',
        isLoading: false,
      });
      throw error;
    }
  },

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (stored) {
        const { user, tokens } = JSON.parse(stored);

        // Try to refresh tokens on app start
        if (tokens?.refreshToken) {
          try {
            const newTokens = await refreshTokens(tokens.refreshToken);
            const updatedUser = await getCurrentUser(newTokens.accessToken);

            await AsyncStorage.setItem(
              AUTH_STORAGE_KEY,
              JSON.stringify({ user: updatedUser, tokens: newTokens })
            );

            set({
              user: updatedUser,
              tokens: newTokens,
              isAuthenticated: true,
              isInitialized: true,
            });
          } catch (refreshError) {
            // Refresh failed, use stored tokens (may be expired)
            set({
              user,
              tokens,
              isAuthenticated: true,
              isInitialized: true,
            });
          }
        } else {
          set({
            user,
            tokens,
            isAuthenticated: true,
            isInitialized: true,
          });
        }
      } else {
        set({ isInitialized: true });
      }
    } catch (error) {
      set({ isInitialized: true });
    }
  },

  clearError: () => set({ error: null }),
}));
