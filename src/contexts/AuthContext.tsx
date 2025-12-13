import React, { createContext, useState, useContext, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AuthService } from '../services/authService';
import { TokenStorage } from '../services/tokenStorage';

interface User {
  id: number;
  username: string;
  name?: string;
  contactNumber?: string;
  district?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  name: string;
  username: string;
  password: string;
  contactNumber: string;
  district: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check internet connectivity first
      const netInfo = await NetInfo.fetch();
      const online = netInfo.isConnected ?? false;
      setIsOnline(online);

      // Try to get stored user
      const storedUser = await TokenStorage.getUser();
      const isAuth = await AuthService.isAuthenticated();
      
      if (isAuth && storedUser) {
        // User is already logged in
        setUser(storedUser);
      } else if (!online) {
        // If offline and no stored user, create anonymous offline user and auto-login
        console.log('📴 Offline mode detected: Auto-login as offline user');
        const offlineUser: User = {
          id: 0,
          username: 'offline',
          name: 'Offline User',
        };
        const offlineToken = 'offline-mode-' + Date.now();
        await TokenStorage.saveToken(offlineToken);
        await TokenStorage.saveUser(offlineUser);
        setUser(offlineUser);
        console.log('✓ Offline user created - bypassing login screen');
      }
      // If online and no user, stay on login screen (don't auto-login)
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await AuthService.login({ username, password });
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await AuthService.register(userData);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        isOnline,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
