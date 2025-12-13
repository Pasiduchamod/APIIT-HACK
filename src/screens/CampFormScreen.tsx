import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import LocationPicker from '../components/LocationPicker';
import { dbService } from '../database/db';

interface CampFormScreenProps {
  navigation: any;
}

export default function CampFormScreen({ navigation }: CampFormScreenProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [capacity, setCapacity] = useState('');
  const [currentOccupancy, setCurrentOccupancy] = useState('0');
  const [facilities, setFacilities] = useState('');
  const [campStatus, setCampStatus] = useState<'operational' | 'full' | 'closed'>('operational');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    getCurrentLocation();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = (state.isInternetReachable ?? state.isConnected) ?? false;
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);

      // Check if GPS is enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Services Off', 'Please enable GPS to continue.');
        return;
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      // Get last known position first (fast)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        setLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      // Then get current position (more accurate)
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

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter camp name');
      return false;
    }

    if (!location) {
      Alert.alert('Validation Error', 'Please wait for location or select camp location on the map');
      return false;
    }

    if (!capacity.trim() || isNaN(Number(capacity)) || Number(capacity) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid capacity');
      return false;
    }

    if (isNaN(Number(currentOccupancy)) || Number(currentOccupancy) < 0) {
      Alert.alert('Validation Error', 'Please enter a valid current occupancy');
      return false;
    }

    if (!facilities.trim()) {
      Alert.alert('Validation Error', 'Please enter at least one facility (comma-separated)');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Parse facilities as comma-separated list
      const facilitiesArray = facilities
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const campData = {
        name: name.trim(),
        latitude: location!.latitude,
        longitude: location!.longitude,
        capacity: Number(capacity),
        current_occupancy: Number(currentOccupancy),
        facilities: JSON.stringify(facilitiesArray),
        campStatus,
        contact_person: contactPerson.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        description: description.trim() || undefined,
      };

      const campId = await dbService.addDetentionCamp(campData);

      Alert.alert(
        'Success',
        'Camp submitted for admin approval. It will appear on the map once approved.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting camp:', error);
      Alert.alert('Error', error.message || 'Failed to submit camp');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Add New Camp</Text>
          <Text style={styles.subtitle}>
            Submit a camp for admin approval
          </Text>
        </View>

        <View style={styles.form}>
          {/* Camp Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Camp Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Central Relief Camp"
              placeholderTextColor="#999"
            />
          </View>

          {/* Location Picker */}
          <View style={styles.fieldContainer}>
            <LocationPicker
              location={location}
              isOnline={isOnline}
              isLoadingLocation={isLoadingLocation}
              onLocationChange={setLocation}
              onRefresh={getCurrentLocation}
            />
          </View>

          {/* Capacity */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Capacity *</Text>
            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={setCapacity}
              placeholder="Maximum number of people"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
          </View>

          {/* Current Occupancy */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Current Occupancy *</Text>
            <TextInput
              style={styles.input}
              value={currentOccupancy}
              onChangeText={setCurrentOccupancy}
              placeholder="Current number of people"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
          </View>

          {/* Facilities */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Facilities * (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={facilities}
              onChangeText={setFacilities}
              placeholder="e.g., Medical, Food, Shelter, Water"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Camp Status */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Camp Status *</Text>
            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  campStatus === 'operational' && styles.statusButtonActive,
                ]}
                onPress={() => setCampStatus('operational')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    campStatus === 'operational' && styles.statusButtonTextActive,
                  ]}
                >
                  Operational
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  campStatus === 'full' && styles.statusButtonActive,
                ]}
                onPress={() => setCampStatus('full')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    campStatus === 'full' && styles.statusButtonTextActive,
                  ]}
                >
                  Full
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  campStatus === 'closed' && styles.statusButtonActive,
                ]}
                onPress={() => setCampStatus('closed')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    campStatus === 'closed' && styles.statusButtonTextActive,
                  ]}
                >
                  Closed
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contact Person */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Contact Person</Text>
            <TextInput
              style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="Person in charge"
              placeholderTextColor="#999"
            />
          </View>

          {/* Contact Phone */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Contact Phone</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="Phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* Description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details about the camp..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Camp for Approval'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
  },
  form: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderColor: '#4caf50',
    backgroundColor: '#4caf50',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#4caf50',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
