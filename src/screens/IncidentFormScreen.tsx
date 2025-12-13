import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { INCIDENT_TYPES, IncidentType } from '../constants/config';
import { dbService } from '../database/db';
import { cloudSyncService } from '../services/cloudSyncService';
import { FirebaseStorageService } from '../services/firebaseStorageService';
import { imageService } from '../services/imageService';
import { imageSyncService } from '../services/imageSyncService';

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
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Trapped Civilians specific fields
  const [trappedPeopleCount, setTrappedPeopleCount] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  
  // Road Block specific fields
  const [roadBlockRoute, setRoadBlockRoute] = useState('');

  const MAX_IMAGES = 3;

  // Android GPS watcher refs
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-set severity to maximum for trapped civilians
  useEffect(() => {
    if (incidentType === 'Trapped Civilians') {
      setSeverity(5);
    }
  }, [incidentType]);

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

  const handleCapturePhoto = async () => {
    if (imageUris.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can only add up to ${MAX_IMAGES} images.`);
      return;
    }

    try {
      const uri = await imageService.capturePhoto();
      if (uri) {
        setImageUris(prev => [...prev, uri]);
        console.log('Photo captured:', uri);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const handlePickImage = async () => {
    if (imageUris.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can only add up to ${MAX_IMAGES} images.`);
      return;
    }

    try {
      const uri = await imageService.pickImage();
      if (uri) {
        setImageUris(prev => [...prev, uri]);
        console.log(' Image selected:', uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Missing Location', 'Please wait for GPS location.');
      return;
    }

    // Validate Trapped Civilians fields
    if (incidentType === 'Trapped Civilians') {
      if (!trappedPeopleCount || trappedPeopleCount.trim() === '') {
        Alert.alert('Missing Information', 'Please enter the number of trapped people.');
        return;
      }
      if (!additionalDetails || additionalDetails.trim() === '') {
        Alert.alert('Missing Information', 'Please provide additional details about the situation.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const incidentId = uuidv4();

      // Create incident in database
      let description: string | undefined;
      if (incidentType === 'Trapped Civilians') {
        description = `TRAPPED PEOPLE: ${trappedPeopleCount} | DETAILS: ${additionalDetails}`;
      } else if (incidentType === 'Road Block' && roadBlockRoute.trim()) {
        description = `ROUTE: ${roadBlockRoute.trim()}`;
      }

      await dbService.createIncident({
        id: incidentId,
        type: incidentType,
        severity,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
        status: 'pending',
        description,
      });

      // Process images if captured (optional - incident can be saved without images)
      if (imageUris.length > 0) {
        setIsUploadingImage(true);
        try {
          const localUris: string[] = [];
          const cloudUrls: string[] = [];
          const uploadStatuses: ('local_only' | 'low_uploaded' | 'high_uploaded')[] = [];
          const qualities: ('none' | 'low' | 'high')[] = [];

          // Process each image
          for (let i = 0; i < imageUris.length; i++) {
            const uri = imageUris[i];
            try {
              // Save image locally with unique name
              const localUri = await imageService.saveImageLocally(uri, `${incidentId}_img${i}`, 'original');
              localUris.push(localUri);

              // Try to upload to Firebase Storage if online
              if (isOnline) {
                try {
                  // Compress based on network quality
                  const compressed = await imageService.compressToHighQuality(localUri);
                  const compressedUri = await imageService.saveImageLocally(
                    compressed.uri,
                    `${incidentId}_img${i}`,
                    'high'
                  );

                  // Upload to Firebase Storage
                  const downloadUrl = await FirebaseStorageService.uploadWithRetry(
                    compressedUri,
                    `${incidentId}_img${i}`,
                    'high'
                  );

                  cloudUrls.push(downloadUrl);
                  uploadStatuses.push('high_uploaded');
                  qualities.push('high');
                  console.log(`Image ${i} uploaded to Firebase:`, downloadUrl);
                } catch (uploadError) {
                  console.error(`Failed to upload image ${i}:`, uploadError);
                  // Keep as local only
                  cloudUrls.push('');
                  uploadStatuses.push('local_only');
                  qualities.push('none');
                }
              } else {
                // Offline - save for later upload
                cloudUrls.push('');
                uploadStatuses.push('local_only');
                qualities.push('none');
              }
            } catch (imgError) {
              console.error(`Error processing image ${i}:`, imgError);
              // Continue with other images
            }
          }

          // Update incident with all image data
          if (localUris.length > 0) {
            await dbService.updateIncidentImage(incidentId, {
              localImageUris: localUris,
              cloudImageUrls: cloudUrls,
              imageUploadStatuses: uploadStatuses,
              imageQualities: qualities,
            });
          }
        } catch (imageError) {
          console.error('Image processing error:', imageError);
          // Don't fail the whole submission if images fail
          Alert.alert(
            'Image Warning',
            'Incident saved but some images may not have been processed.',
            [{ text: 'OK' }]
          );
        } finally {
          setIsUploadingImage(false);
        }
      }

      // Sync incident data to cloud
      if (isOnline) {
        cloudSyncService.syncToCloud().catch(() => {});
        // Also try to sync images immediately
        imageSyncService.syncAllPendingImages().catch(() => {});
      } else {
        console.log('📴 Offline mode: Incident and images saved locally. Will sync when online.');
      }

      Alert.alert('Saved', 'Incident saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

      // Reset form
      setIncidentType('Landslide');
      setSeverity(3);
      setImageUris([]);
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

        {/* Critical Incident Warning */}
        {incidentType === 'Trapped Civilians' && (
          <View style={styles.criticalWarning}>
            <Text style={styles.criticalWarningText}>⚠️ CRITICAL INCIDENT</Text>
          </View>
        )}

        {/* Trapped Civilians Specific Fields */}
        {incidentType === 'Trapped Civilians' && (
          <>
            <Text style={styles.label}>Number of People Trapped *</Text>
            <TextInput
              style={[styles.input, styles.criticalInput]}
              value={trappedPeopleCount}
              onChangeText={setTrappedPeopleCount}
              placeholder="Enter number of trapped people"
              keyboardType="number-pad"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Additional Details *</Text>
            <TextInput
              style={[styles.input, styles.textArea, styles.criticalInput]}
              value={additionalDetails}
              onChangeText={setAdditionalDetails}
              placeholder="Describe the situation, location details, any injuries, etc."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </>
        )}

        {/* Road Block Specific Fields */}
        {incidentType === 'Road Block' && (
          <>
            <Text style={styles.label}>Route (Optional)</Text>
            <TextInput
              style={styles.input}
              value={roadBlockRoute}
              onChangeText={setRoadBlockRoute}
              placeholder='e.g., "Kandy to Kurunegala road"'
              placeholderTextColor="#999"
            />
          </>
        )}

        <Text style={styles.label}>Severity Level: {severity}</Text>
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
              <Text style={styles.severityButtonText}>
                {lvl}
              </Text>
              <Text style={styles.severityLabel}>
                {lvl === 1 ? 'Low' : lvl === 2 ? 'Minor' : lvl === 3 ? 'Med' : lvl === 4 ? 'High' : 'Critical'}
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

        <Text style={styles.label}>Photos (Optional - up to {MAX_IMAGES})</Text>
        <View style={styles.imageContainer}>
          {imageUris.length > 0 && (
            <View style={styles.imageGrid}>
              {imageUris.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity 
                    onPress={() => handleRemoveImage(index)} 
                    style={styles.removeImageButton}
                  >
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {imageUris.length < MAX_IMAGES && (
            <View style={styles.imageButtonsContainer}>
              <TouchableOpacity onPress={handleCapturePhoto} style={styles.imageButton}>
                <Text style={styles.imageButtonText}> Capture Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickImage} style={styles.imageButton}>
                <Text style={styles.imageButtonText}> Pick from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
          {isUploadingImage && (
            <View style={styles.uploadingIndicator}>
              <ActivityIndicator size="small" color="#e94560" />
              <Text style={styles.uploadingText}>Processing image...</Text>
            </View>
          )}
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
  severityContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 10, 
    gap: 8 
  },
  severityButton: {
    flex: 1,
    height: 70,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  severityButtonActive: { 
    borderColor: '#1a1a2e',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  severityButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  severityLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.9,
  },
  locationContainer: { backgroundColor: '#fff', padding: 15, borderRadius: 8 },
  refreshButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e94560',
    alignItems: 'center',
    borderRadius: 6,
  },
  imageContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  imageWrapper: {
    width: '48%',
    position: 'relative',
  },
  imageButtonsContainer: {
    gap: 10,
  },
  imageButton: {
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  imageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    backgroundColor: '#f44336',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  uploadingText: {
    marginLeft: 10,
    color: '#666',
  },
  submitButton: {
    marginTop: 30,
    padding: 18,
    backgroundColor: '#e94560',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: 'bold' },
  criticalWarning: {
    backgroundColor: '#ff0000',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#cc0000',
  },
  criticalWarningText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  criticalInput: {
    borderColor: '#ff0000',
    borderWidth: 2,
  },
});
