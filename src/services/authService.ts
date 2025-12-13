import { API_BASE_URL } from '../constants/config';
import { TokenStorage } from './tokenStorage';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  name: string;
  username: string;
  password: string;
  contactNumber: string;
  district: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    username: string;
    name?: string;
    contactNumber?: string;
    district?: string;
  };
}

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
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
    } catch (error: any) {
      // Fallback: Allow offline demo login for testing
      console.warn('Online login failed, attempting offline demo login:', error.message);
      
      // Check if credentials are demo credentials
      if (credentials.username === 'demo' && credentials.password === 'demo') {
        const demoResponse: AuthResponse = {
          success: true,
          token: 'demo-token-offline-' + Date.now(),
          user: {
            id: 1,
            username: 'demo',
          },
        };
        
        // Save demo token to secure storage
        await TokenStorage.saveToken(demoResponse.token);
        await TokenStorage.saveUser(demoResponse.user);
        
        console.log('✓ Demo login successful (offline mode)');
        return demoResponse;
      }
      
      throw error;
    }
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data: AuthResponse = await response.json();
      
      // Save token and user data to secure storage
      await TokenStorage.saveToken(data.token);
      await TokenStorage.saveUser(data.user);

      return data;
    } catch (error: any) {
      console.error('Registration failed:', error.message);
      throw error;
    }
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
