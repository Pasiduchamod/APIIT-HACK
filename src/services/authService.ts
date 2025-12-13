import { firebaseService } from './firebaseService';
import { TokenStorage } from './tokenStorage';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
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
      // First, try to authenticate with Firebase
      const firebaseUser = await firebaseService.getUserByUsername(credentials.username);
      
      if (firebaseUser) {
        // User exists in Firebase
        const authResponse: AuthResponse = {
          success: true,
          token: `firebase-token-${firebaseUser.id}`,
          user: {
            id: firebaseUser.id,
            username: firebaseUser.username,
            name: firebaseUser.name,
            contactNumber: firebaseUser.contactNumber,
            district: firebaseUser.district,
          },
        };
        
        // Save token and user data to secure storage
        await TokenStorage.saveToken(authResponse.token);
        await TokenStorage.saveUser(authResponse.user);
        
        console.log('✓ Login successful via Firebase');
        return authResponse;
      }
      
      // If not in Firebase, try demo credentials
      if (credentials.username === 'demo' && credentials.password === 'demo') {
        const demoResponse: AuthResponse = {
          success: true,
          token: 'demo-token-' + Date.now(),
          user: {
            id: 1,
            username: 'demo',
            name: 'Demo User',
          },
        };
        
        await TokenStorage.saveToken(demoResponse.token);
        await TokenStorage.saveUser(demoResponse.user);
        
        console.log('✓ Demo login successful');
        return demoResponse;
      }
      
      // User not found
      throw new Error('Invalid username or password');
    } catch (error: any) {
      console.error('Login failed:', error.message);
      throw new Error(error.message || 'Login failed');
    }
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      // Save user data to Firebase Firestore
      const userId = Date.now(); // Generate unique ID based on timestamp
      
      const userRecord = {
        id: userId,
        username: userData.username,
        email: userData.email,
        name: userData.name,
        contactNumber: userData.contactNumber,
        district: userData.district,
        createdAt: Date.now(),
      };

      // Save to Firebase users collection
      await firebaseService.createUser(userRecord);

      const authResponse: AuthResponse = {
        success: true,
        token: `firebase-token-${userId}`,
        user: {
          id: userId,
          username: userData.username,
          name: userData.name,
          contactNumber: userData.contactNumber,
          district: userData.district,
        },
      };
      
      // Save token and user data to secure storage
      await TokenStorage.saveToken(authResponse.token);
      await TokenStorage.saveUser(authResponse.user);

      console.log('✓ User registered successfully in Firebase');
      return authResponse;
    } catch (error: any) {
      console.error('Registration failed:', error.message);
      throw new Error(error.message || 'Registration failed');
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
