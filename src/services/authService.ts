import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../config/firebase';
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
      // Check if it's demo login
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
        
        return demoResponse;
      }

      // Get user from Firestore to find email by username
      const firebaseUser = await firebaseService.getUserByUsername(credentials.username);
      
      if (!firebaseUser) {
        throw new Error('Invalid username or password');
      }

      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        firebaseUser.email,
        credentials.password
      );

      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      }

      // Update emailVerified status in Firestore if it changed
      if (!firebaseUser.emailVerified && userCredential.user.emailVerified) {
        await firebaseService.updateUserEmailVerified(firebaseUser.id, true);
      }

      // Get auth token
      const token = await userCredential.user.getIdToken();

      const authResponse: AuthResponse = {
        success: true,
        token,
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
      
      return authResponse;
    } catch (error: any) {
      // Handle Firebase Auth errors
      let errorMessage = 'Login failed';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errorMessage = 'Invalid username or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      // Send email verification
      await sendEmailVerification(userCredential.user);
      console.log('✓ Verification email sent to:', userData.email);

      // Save additional user data to Firestore
      const userId = Date.now();
      const userRecord = {
        id: userId,
        username: userData.username,
        email: userData.email,
        name: userData.name,
        contactNumber: userData.contactNumber,
        district: userData.district,
        createdAt: Date.now(),
        firebaseUid: userCredential.user.uid,
        emailVerified: false,
      };

      // Save to Firebase users collection
      await firebaseService.createUser(userRecord);

      console.log('✓ User registered successfully in Firebase');
      console.log('✓ Verification email sent - user must verify before login');
      
      // Don't return auth response - user should not be logged in until email is verified
      // Return minimal response indicating registration success
      return {
        success: true,
        token: '',
        user: {
          id: userId,
          username: userData.username,
          name: userData.name,
          contactNumber: userData.contactNumber,
          district: userData.district,
        },
      };
    } catch (error: any) {
      console.error('Registration failed:', error.message);
      
      // Handle Firebase Auth errors
      let errorMessage = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters';
      }
      
      throw new Error(errorMessage);
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
