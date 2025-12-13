import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { database } from '../database';
import Incident from '../database/models/Incident';
import { INCIDENT_TYPES, IncidentType } from '../constants/config';
import { syncService } from '../services/syncService';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

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

  useEffect(() => {
    getCurrentLocation();
    
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to record incident location.');
        return;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Missing Location', 'Please wait for location to be acquired.');
      return;
    }

    setIsSaving(true);
    try {
      // Save to local WatermelonDB
      await database.write(async () => {
        await database.get<Incident>('incidents').create(incident => {
          incident._raw.id = uuidv4();
          incident.type = incidentType;
          incident.severity = severity;
          incident.latitude = location.latitude;
          incident.longitude = location.longitude;
          incident.timestamp = new Date();
          incident.isSynced = false;
        });
      });

      console.log('✓ Incident saved locally');

      // Show appropriate message based on network status
      if (isOnline) {
        Alert.alert(
          'Incident Saved',
          'Incident saved locally and will sync automatically.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        // Trigger sync
        syncService.syncIncidents();
      } else {
        Alert.alert(
          'Saved Locally (Offline)',
          'No internet connection. Incident saved locally and will sync when connection is restored.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }

      // Reset form
      setIncidentType('Landslide');
      setSeverity(3);
      getCurrentLocation();
    } catch (error) {
      console.error('Error saving incident:', error);
      Alert.alert('Error', 'Failed to save incident. Please try again.');
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
        {/* Incident Type */}
        <Text style={styles.label}>Incident Type *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={incidentType}
            onValueChange={(itemValue) => setIncidentType(itemValue as IncidentType)}
            style={styles.picker}
          >
            {INCIDENT_TYPES.map(type => (
              <Picker.Item key={type} label={type} value={type} />
            ))}
          </Picker>
        </View>

        {/* Severity */}
        <Text style={styles.label}>Severity: {severity}</Text>
        <View style={styles.severityContainer}>
          {[1, 2, 3, 4, 5].map(level => (
            <TouchableOpacity
              key={level}
              style={[
                styles.severityButton,
                severity === level && styles.severityButtonActive,
                { backgroundColor: getSeverityColor(level, severity === level) },
              ]}
              onPress={() => setSeverity(level)}
            >
              <Text style={styles.severityButtonText}>{level}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location */}
        <Text style={styles.label}>Location (GPS) *</Text>
        <View style={styles.locationContainer}>
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color="#e94560" />
          ) : location ? (
            <>
              <Text style={styles.locationText}>
                Lat: {location.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Lng: {location.longitude.toFixed(6)}
              </Text>
            </>
          ) : (
            <Text style={styles.locationError}>Location not available</Text>
          )}
          <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (isSaving || !location) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSaving || !location}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Save Incident</Text>
          )}
        </TouchableOpacity>

        {!isOnline && (
          <View style={styles.offlineWarning}>
            <Text style={styles.offlineWarningText}>
              ⚠ You are offline. Data will be saved locally and synced when connection is restored.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const getSeverityColor = (level: number, isActive: boolean): string => {
  const colors = ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'];
  return isActive ? colors[level - 1] : '#e0e0e0';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  onlineBadge: {
    backgroundColor: '#4caf50',
  },
  offlineBadge: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  picker: {
    height: 50,
  },
  severityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  severityButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  severityButtonActive: {
    borderColor: '#1a1a2e',
    borderWidth: 3,
  },
  severityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  locationContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  locationError: {
    fontSize: 14,
    color: '#f44336',
  },
  refreshButton: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#e94560',
    borderRadius: 4,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#e94560',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  offlineWarning: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  offlineWarningText: {
    color: '#856404',
    fontSize: 12,
    textAlign: 'center',
  },
});
