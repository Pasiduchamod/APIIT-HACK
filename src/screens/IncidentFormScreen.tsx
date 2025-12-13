import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { INCIDENT_TYPES, IncidentType } from '../constants/config';
import { dbService } from '../database/db';
import { syncService } from '../services/syncService';

interface IncidentFormScreenProps {
  navigation: any;
}

export default function IncidentFormScreen({ navigation }: IncidentFormScreenProps) {
  const [incidentType, setIncidentType] = useState<IncidentType>('Landslide');
  const [severity, setSeverity] = useState(3);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Android GPS watcher refs
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getCurrentLocation();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = (state.isInternetReachable ?? state.isConnected) ?? false;
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
      cleanupWatcher();
    };
  }, []);

  const cleanupWatcher = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const getCurrentLocation = async () => {
    cleanupWatcher();

    try {
      setIsLoadingLocation(true);

      // 1️⃣ GPS enabled?
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Services Off', 'Please enable GPS to continue.');
        return;
      }

      // 2️⃣ Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      // 3️⃣ FAST: last known (offline-safe)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        setLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      // 4️⃣ ANDROID: wait for satellite fix (OFFLINE SAFE)
      if (Platform.OS === 'android') {
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (pos) => {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            cleanupWatcher(); // stop after first fix
          }
        );

        // Safety timeout (avoid endless waiting)
        timeoutRef.current = setTimeout(() => {
          cleanupWatcher();
          if (!location) {
            Alert.alert('Location Error', 'Unable to get GPS fix. Try again.');
          }
        }, 15000);

        return;
      }

      // 5️⃣ iOS (simple)
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Could not get your location.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Missing Location', 'Please wait for GPS location.');
      return;
    }

    setIsSaving(true);
    try {
      const incidentId = uuidv4();

      await dbService.createIncident({
        id: incidentId,
        type: incidentType,
        severity,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
        status: 'pending',
      });

      if (isOnline) {
        syncService.syncIncidents().catch(() => {});
      }

      Alert.alert('Saved', 'Incident saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

      setIncidentType('Landslide');
      setSeverity(3);
      getCurrentLocation();
    } catch (e) {
      Alert.alert('Error', 'Failed to save incident.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Incident</Text>
        <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
          <Text style={styles.statusText}>{isOnline ? '● Online' : '● Offline'}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Incident Type *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={incidentType}
            onValueChange={(v) => setIncidentType(v as IncidentType)}
            style={styles.picker}
          >
            {INCIDENT_TYPES.map((t) => (
              <Picker.Item key={t} label={t} value={t} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Severity: {severity}</Text>
        <View style={styles.severityContainer}>
          {[1, 2, 3, 4, 5].map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[
                styles.severityButton,
                severity === lvl && styles.severityButtonActive,
                { backgroundColor: getSeverityColor(lvl, severity === lvl) },
              ]}
              onPress={() => setSeverity(lvl)}
            >
              <Text style={{ color: severity === lvl ? '#fff' : '#000', fontWeight: 'bold' }}>
                {lvl}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Location *</Text>
        <View style={styles.locationContainer}>
          {isLoadingLocation ? (
            <ActivityIndicator />
          ) : location ? (
            <>
              <Text>Lat: {location.latitude.toFixed(6)}</Text>
              <Text>Lng: {location.longitude.toFixed(6)}</Text>
            </>
          ) : (
            <Text style={{ color: 'red' }}>Location not available</Text>
          )}
          <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
            <Text style={{ color: '#fff' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!location || isSaving) && { opacity: 0.5 }]}
          disabled={!location || isSaving}
          onPress={handleSubmit}
        >
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Incident</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getSeverityColor = (level: number, active: boolean) =>
  active ? ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'][level - 1] : '#e0e0e0';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  statusBadge: { padding: 6, borderRadius: 12 },
  onlineBadge: { backgroundColor: '#4caf50' },
  offlineBadge: { backgroundColor: '#f44336' },
  statusText: { color: '#fff', fontSize: 12 },
  form: { padding: 20 },
  label: { fontWeight: 'bold', marginTop: 15 },
  pickerContainer: { backgroundColor: '#fff', borderRadius: 8 },
  picker: { height: 52 },
  severityContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  severityButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  severityButtonActive: { borderColor: '#1a1a2e' },
  locationContainer: { backgroundColor: '#fff', padding: 15, borderRadius: 8 },
  refreshButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e94560',
    alignItems: 'center',
    borderRadius: 6,
  },
  submitButton: {
    marginTop: 30,
    padding: 18,
    backgroundColor: '#e94560',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: 'bold' },
});
