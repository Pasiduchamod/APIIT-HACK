import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

interface LocationPickerProps {
  location: { latitude: number; longitude: number } | null;
  isOnline: boolean;
  isLoadingLocation: boolean;
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
  onRefresh: () => void;
}

export default function LocationPicker({
  location,
  isOnline,
  isLoadingLocation,
  onLocationChange,
  onRefresh,
}: LocationPickerProps) {
  const [region, setRegion] = useState<Region | undefined>(
    location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : undefined
  );

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onLocationChange({ latitude, longitude });
    // Don't update region - let user keep their current view
  };

  const handleMarkerDragEnd = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onLocationChange({ latitude, longitude });
    // Don't update region - let user keep their current view
  };
  
  const handleRefresh = () => {
    onRefresh();
    // When user refreshes, center map on new GPS location
    if (location) {
      setRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Initialize region only once when location first becomes available
  React.useEffect(() => {
    if (location && !region) {
      setRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [location, region]);

  // Offline mode or no location - show text display
  if (!isOnline || !location) {
    return (
      <View style={styles.locationContainer}>
        <Text style={styles.label}>Location *</Text>
        {isLoadingLocation ? (
          <ActivityIndicator />
        ) : location ? (
          <>
            <Text style={styles.locationText}>Lat: {location.latitude.toFixed(6)}</Text>
            <Text style={styles.locationText}>Lng: {location.longitude.toFixed(6)}</Text>
            <Text style={styles.offlineNote}>Offline - Using GPS location</Text>
          </>
        ) : (
          <Text style={styles.errorText}>Location not available</Text>
        )}
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Online mode with location - show map
  return (
    <View style={styles.mapContainer}>
      <Text style={styles.label}>Location * (Change marker to select another location)</Text>
      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          <Marker
            coordinate={location}
            draggable
            onDragEnd={handleMarkerDragEnd}
            title="Incident Location"
            description="Drag to adjust position"
          />
        </MapView>
      </View>
      <View style={styles.coordinatesBar}>
        <Text style={styles.coordinateText}>
          Lat: {location.latitude.toFixed(6)} | Lng: {location.longitude.toFixed(6)}
        </Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.smallRefreshButton}>
          <Text style={styles.smallRefreshButtonText}>My Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  locationContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  label: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  offlineNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
  },
  refreshButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e94560',
    alignItems: 'center',
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  mapContainer: {
    marginTop: 10,
  },
  mapWrapper: {
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  coordinatesBar: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  coordinateText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  smallRefreshButton: {
    backgroundColor: '#e94560',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  smallRefreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
