import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthTokens,
  CognitoUser,
  signInMock,
  signUpMock,
  confirmSignUpMock,
  forgotPasswordMock,
  confirmForgotPasswordMock,
  signOutMock,
  getCurrentUserMock,
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
      const tokens = await signInMock(email, password);

      const user: CognitoUser = {
        username: email,
        email: email,
        sub: 'user-' + Date.now(),
      };

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
      await signUpMock(email, password, name);
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
      await confirmSignUpMock(email, code);
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
      await forgotPasswordMock(email);
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
      await confirmForgotPasswordMock(email, code, newPassword);
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
      await signOutMock();
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

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (stored) {
        const { user, tokens } = JSON.parse(stored);
        set({
          user,
          tokens,
          isAuthenticated: true,
          isInitialized: true,
        });
      } else {
        set({ isInitialized: true });
      }
    } catch (error) {
      set({ isInitialized: true });
    }
  },

  clearError: () => set({ error: null }),
}));
