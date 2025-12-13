import { API_BASE_URL } from '../constants/config';
import { TokenStorage } from './tokenStorage';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    
    // Save token and user data to secure storage
    await TokenStorage.saveToken(data.token);
    await TokenStorage.saveUser(data.user);

    return data;
  },

  async logout(): Promise<void> {
    await TokenStorage.clearAll();
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await TokenStorage.getToken();
    return token !== null;
  },

  async getAuthHeader(): Promise<{ Authorization: string } | {}> {
    const token = await TokenStorage.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
