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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import LocationPicker from '../components/LocationPicker';
import { AID_TYPES, AidType } from '../constants/config';
import { dbService } from '../database/db';
import { cloudSyncService } from '../services/cloudSyncService';

interface AidRequestFormScreenProps {
  navigation: any;
}

export default function AidRequestFormScreen({ navigation }: AidRequestFormScreenProps) {
  const [selectedAidTypes, setSelectedAidTypes] = useState<AidType[]>([]);
  const [currentAidType, setCurrentAidType] = useState<AidType>('Food');
  const [priorityLevel, setPriorityLevel] = useState(3);
  const [description, setDescription] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState('');
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

      // GPS enabled?
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Services Off', 'Please enable GPS to continue.');
        return;
      }

      // Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      // FAST: last known (offline-safe)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        setLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      // ANDROID: wait for satellite fix (OFFLINE SAFE)
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
            cleanupWatcher();
          }
        );

        // Safety timeout
        timeoutRef.current = setTimeout(() => {
          cleanupWatcher();
          if (!location) {
            Alert.alert('Location Error', 'Unable to get GPS fix. Try again.');
          }
        }, 15000);

        return;
      }

      // iOS (simple)
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error) {
      Alert.alert('Location Error', 'Could not get your location.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleAddAidType = () => {
    if (selectedAidTypes.includes(currentAidType)) {
      Alert.alert('Already Added', `${currentAidType} is already in your list.`);
      return;
    }

    setSelectedAidTypes([...selectedAidTypes, currentAidType]);
  };

  const handleRemoveAidType = (aidType: AidType) => {
    setSelectedAidTypes(selectedAidTypes.filter((type) => type !== aidType));
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Missing Location', 'Please wait for GPS location.');
      return;
    }

    if (selectedAidTypes.length === 0) {
      Alert.alert('Select Aid Types', 'Please select at least one type of aid needed.');
      return;
    }

    if (!requesterName.trim()) {
      Alert.alert('Missing Name', 'Please enter your name.');
      return;
    }

    if (!contactNumber.trim()) {
      Alert.alert('Missing Contact', 'Please enter your contact number.');
      return;
    }

    if (!numberOfPeople.trim() || isNaN(parseInt(numberOfPeople)) || parseInt(numberOfPeople) < 1) {
      Alert.alert('Invalid Number', 'Please enter a valid number of people (minimum 1).');
      return;
    }

    setIsSaving(true);
    try {
      const aidRequestId = uuidv4();

      // Create aid request in database
      const aidRequestData = {
        id: aidRequestId,
        aid_types: JSON.stringify(selectedAidTypes),
        latitude: location.latitude,
        longitude: location.longitude,
        description: description.trim() || null,
        priority_level: priorityLevel,
        status: 'pending' as const,
        aidStatus: 'pending' as const,
        requester_name: requesterName.trim(),
        contact_number: contactNumber.trim(),
        number_of_people: parseInt(numberOfPeople),
      };

      await dbService.createAidRequest(aidRequestData);

      // Sync to cloud if online
      if (isOnline) {
        cloudSyncService.syncToCloud().catch((err) => {
          // Sync error will be handled by sync service
        });
      }

      Alert.alert(
        'Saved Successfully',
        isOnline 
          ? 'Aid request saved and will be synced to cloud.' 
          : 'Aid request saved locally. Will sync when online.',
        [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );

      // Reset form
      setSelectedAidTypes([]);
      setCurrentAidType('Food');
      setPriorityLevel(3);
      setDescription('');
      setRequesterName('');
      setContactNumber('');
      setNumberOfPeople('');
      getCurrentLocation();
    } catch (e) {
      Alert.alert('Error', `Failed to save aid request: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Request Aid</Text>
        <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
          <Text style={styles.statusText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Aid Types Needed *</Text>
        <View style={styles.aidTypeSelector}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={currentAidType}
              onValueChange={(v) => setCurrentAidType(v as AidType)}
              style={styles.picker}
            >
              {AID_TYPES.map((t) => (
                <Picker.Item key={t} label={t} value={t} />
              ))}
            </Picker>
          </View>
          <TouchableOpacity onPress={handleAddAidType} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {selectedAidTypes.length > 0 && (
          <View style={styles.selectedAidTypesContainer}>
            <Text style={styles.selectedLabel}>Selected Aid Types:</Text>
            {selectedAidTypes.map((aidType) => (
              <View key={aidType} style={styles.aidTypeChip}>
                <Text style={styles.aidTypeChipText}>{aidType}</Text>
                <TouchableOpacity onPress={() => handleRemoveAidType(aidType)}>
                  <Text style={styles.removeChipText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.label}>Priority Level: {priorityLevel}</Text>
        <View style={styles.priorityContainer}>
          {[1, 2, 3, 4, 5].map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[
                styles.priorityButton,
                priorityLevel === lvl && styles.priorityButtonActive,
                { backgroundColor: getPriorityColor(lvl, priorityLevel === lvl) },
              ]}
              onPress={() => setPriorityLevel(lvl)}
            >
              <Text style={styles.priorityButtonText}>
                {lvl}
              </Text>
              <Text style={styles.priorityLabel}>
                {lvl === 1 ? 'Low' : lvl === 2 ? 'Minor' : lvl === 3 ? 'Med' : lvl === 4 ? 'High' : 'Critical'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Your Name *</Text>
        <TextInput
          style={styles.input}
          value={requesterName}
          onChangeText={setRequesterName}
          placeholder="Enter your full name"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Contact Number *</Text>
        <TextInput
          style={styles.input}
          value={contactNumber}
          onChangeText={setContactNumber}
          placeholder="Enter your phone number"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Number of People Needing Aid *</Text>
        <TextInput
          style={styles.input}
          value={numberOfPeople}
          onChangeText={setNumberOfPeople}
          placeholder="How many people need aid?"
          placeholderTextColor="#999"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Additional Details (Optional)</Text>
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your situation..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <LocationPicker
          location={location}
          isOnline={isOnline}
          isLoadingLocation={isLoadingLocation}
          onLocationChange={setLocation}
          onRefresh={getCurrentLocation}
        />

        <TouchableOpacity
          style={[
            styles.submitButton, 
            (!location || isSaving || selectedAidTypes.length === 0 || !requesterName.trim() || !contactNumber.trim() || !numberOfPeople.trim()) && { opacity: 0.5 }
          ]}
          disabled={!location || isSaving || selectedAidTypes.length === 0 || !requesterName.trim() || !contactNumber.trim() || !numberOfPeople.trim()}
          onPress={handleSubmit}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Aid Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getPriorityColor = (level: number, active: boolean) =>
  active ? ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'][level - 1] : '#e0e0e0';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  statusBadge: { padding: 8, borderRadius: 12 },
  onlineBadge: { backgroundColor: '#4caf50' },
  offlineBadge: { backgroundColor: '#f44336' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  form: { padding: 20 },
  label: { fontWeight: 'bold', marginTop: 15, fontSize: 16 },
  aidTypeSelector: { marginTop: 10 },
  pickerContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  picker: { 
    height: 52,
    color: '#000',
  },
  addButton: {
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  selectedAidTypesContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  selectedLabel: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  aidTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e94560',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  aidTypeChipText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  removeChipText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingLeft: 10,
  },
  priorityContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 10,
    gap: 8
  },
  priorityButton: {
    flex: 1,
    height: 70,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  priorityButtonActive: { 
    borderColor: '#1a1a2e',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  priorityButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  priorityLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.9,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    fontSize: 16,
    color: '#000',
  },
  descriptionInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    minHeight: 100,
    fontSize: 16,
    color: '#000',
  },
  locationContainer: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 8,
    marginTop: 10,
  },
  refreshButton: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#e94560',
    alignItems: 'center',
    borderRadius: 6,
  },
  submitButton: {
    marginTop: 30,
    marginBottom: 100,
    padding: 18,
    backgroundColor: '#e94560',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
