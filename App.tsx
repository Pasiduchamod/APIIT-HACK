import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import HomeScreen from './src/screens/HomeScreen';
import IncidentFormScreen from './src/screens/IncidentFormScreen';
import LoginScreen from './src/screens/LoginScreen';
import { initializeApp } from './src/utils/appInitializer';

const Stack = createNativeStackNavigator();

function Navigation() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen 
              name="IncidentForm" 
              component={IncidentFormScreen}
              options={{
                headerShown: true,
                title: 'Report Incident',
                headerStyle: {
                  backgroundColor: '#1a1a2e',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const setupApp = async () => {
      try {
        await initializeApp();
        setAppReady(true);
      } catch (error: any) {
        console.error('Failed to initialize app:', error);
        setInitError(error.message || 'Failed to initialize app');
        Alert.alert('Initialization Error', 'Failed to initialize the app. Please restart.');
      }
    };

    setupApp();
  }, []);

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#f44336" />
        <View style={{ marginTop: 20 }}>
          <View style={styles.alertBox}>
            <View />
          </View>
        </View>
      </View>
    );
  }

  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  alertBox: {
    backgroundColor: '#f44336',
    padding: 20,
    borderRadius: 8,
  },
});
