import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ResendConfirmationCodeCommand,
  UpdateUserAttributesCommand,
  ChangePasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// AWS Cognito Configuration
const AWS_REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
const COGNITO_CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '';
const COGNITO_USER_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '';

const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CognitoUser {
  username: string;
  email: string;
  sub: string;
  householdId?: string;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthTokens> {
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const response = await cognitoClient.send(command);

  if (!response.AuthenticationResult) {
    throw new Error('Authentication failed');
  }

  return {
    accessToken: response.AuthenticationResult.AccessToken || '',
    idToken: response.AuthenticationResult.IdToken || '',
    refreshToken: response.AuthenticationResult.RefreshToken || '',
    expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
  };
}

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<{ userSub: string; codeDeliveryDetails: any }> {
  const command = new SignUpCommand({
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: name },
    ],
  });

  const response = await cognitoClient.send(command);

  return {
    userSub: response.UserSub || '',
    codeDeliveryDetails: response.CodeDeliveryDetails,
  };
}

/**
 * Confirm sign up with verification code
 */
export async function confirmSignUp(email: string, code: string): Promise<void> {
  const command = new ConfirmSignUpCommand({
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });

  await cognitoClient.send(command);
}

/**
 * Resend confirmation code
 */
export async function resendConfirmationCode(email: string): Promise<void> {
  const command = new ResendConfirmationCodeCommand({
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
  });

  await cognitoClient.send(command);
}

/**
 * Initiate forgot password flow
 */
export async function forgotPassword(email: string): Promise<void> {
  const command = new ForgotPasswordCommand({
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
  });

  await cognitoClient.send(command);
}

/**
 * Confirm forgot password with code and new password
 */
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const command = new ConfirmForgotPasswordCommand({
    ClientId: COGNITO_CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  });

  await cognitoClient.send(command);
}

/**
 * Get current user info
 */
export async function getCurrentUser(accessToken: string): Promise<CognitoUser> {
  const command = new GetUserCommand({
    AccessToken: accessToken,
  });

  const response = await cognitoClient.send(command);

  const emailAttr = response.UserAttributes?.find((attr) => attr.Name === 'email');
  const subAttr = response.UserAttributes?.find((attr) => attr.Name === 'sub');

  return {
    username: response.Username || '',
    email: emailAttr?.Value || '',
    sub: subAttr?.Value || '',
  };
}

/**
 * Refresh tokens
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const command = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  const response = await cognitoClient.send(command);

  if (!response.AuthenticationResult) {
    throw new Error('Token refresh failed');
  }

  return {
    accessToken: response.AuthenticationResult.AccessToken || '',
    idToken: response.AuthenticationResult.IdToken || '',
    refreshToken: refreshToken, // Refresh token doesn't change
    expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
  };
}

/**
 * Sign out globally (invalidate all tokens)
 */
export async function signOut(accessToken: string): Promise<void> {
  const command = new GlobalSignOutCommand({
    AccessToken: accessToken,
  });

  await cognitoClient.send(command);
}

/**
 * Update user attributes (e.g., name)
 */
export async function updateUserAttributes(
  accessToken: string,
  attributes: { name?: string }
): Promise<void> {
  const userAttributes = [];

  if (attributes.name) {
    userAttributes.push({ Name: 'name', Value: attributes.name });
  }

  if (userAttributes.length === 0) {
    return;
  }

  const command = new UpdateUserAttributesCommand({
    AccessToken: accessToken,
    UserAttributes: userAttributes,
  });

  await cognitoClient.send(command);
}

/**
 * Change password
 */
export async function changePassword(
  accessToken: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const command = new ChangePasswordCommand({
    AccessToken: accessToken,
    PreviousPassword: oldPassword,
    ProposedPassword: newPassword,
  });

  await cognitoClient.send(command);
}

// ============ Mock Functions for Development ============

let mockUser: CognitoUser | null = null;
let mockTokens: AuthTokens | null = null;

export async function signInMock(email: string, password: string): Promise<AuthTokens> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (password.length < 6) {
    throw new Error('Invalid email or password');
  }

  mockUser = {
    username: email,
    email: email,
    sub: 'mock-user-id-12345',
  };

  mockTokens = {
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  };

  return mockTokens;
}

export async function signUpMock(
  email: string,
  password: string,
  name: string
): Promise<{ userSub: string; codeDeliveryDetails: any }> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  return {
    userSub: 'mock-user-sub-12345',
    codeDeliveryDetails: {
      AttributeName: 'email',
      DeliveryMedium: 'EMAIL',
      Destination: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
    },
  };
}

export async function confirmSignUpMock(email: string, code: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (code !== '123456' && code.length !== 6) {
    throw new Error('Invalid verification code');
  }
}

export async function forgotPasswordMock(email: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export async function confirmForgotPasswordMock(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (code !== '123456' && code.length !== 6) {
    throw new Error('Invalid verification code');
  }
}

export async function getCurrentUserMock(): Promise<CognitoUser | null> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockUser;
}

export async function signOutMock(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  mockUser = null;
  mockTokens = null;
}

export async function updateProfileMock(name: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  // In a real implementation, this would update the user's profile in Cognito
}

export async function changePasswordMock(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (oldPassword.length < 6) {
    throw new Error('Current password is incorrect');
  }

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }

  if (oldPassword === newPassword) {
    throw new Error('New password must be different from current password');
  }
}
