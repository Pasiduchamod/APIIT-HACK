import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { DetentionCamp, dbService } from '../database/db';
import { cloudSyncService } from '../services/cloudSyncService';
interface CampsListScreenProps {
  navigation: any;
}

export default function CampsListScreen({ navigation }: CampsListScreenProps) {
  const [camps, setCamps] = useState<DetentionCamp[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCamps();
    }, [])
  );

  const loadCamps = async () => {
    try {
      if (!dbService.isInitialized()) {
        console.log('⏳ Database not yet initialized, waiting...');
        return;
      }

      // Load only approved camps from local database (cached data)
      const allCamps = await dbService.getAllDetentionCamps(false);
      setCamps(allCamps);
      
      // If online, sync with Firebase in the background
      if (isOnline) {
        console.log('🌐 Online - syncing camps from Firebase...');
        try {
          await cloudSyncService.syncFromCloud();
          // Reload approved camps after sync
          const updatedCamps = await dbService.getAllDetentionCamps(false);
          setCamps(updatedCamps);
          console.log('✓ Camps synced from Firebase');
        } catch (error) {
          console.error('Failed to sync camps from Firebase:', error);
          // Still use cached data
        }
      } else {
        console.log('📴 Offline - using cached camps');
      }
    } catch (error) {
      console.error('Error loading camps:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (isOnline) {
        console.log('🔄 Refreshing camps from Firebase...');
        await cloudSyncService.syncFromCloud();
      }
      await loadCamps();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getCampStatusColor = (status: string): string => {
    switch (status) {
      case 'operational':
        return '#4caf50';
      case 'full':
        return '#ff9800';
      case 'closed':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getCampStatusText = (status: string): string => {
    switch (status) {
      case 'operational':
        return '✓ Operational';
      case 'full':
        return '⚠ Full';
      case 'closed':
        return '✕ Closed';
      default:
        return status;
    }
  };

  const renderCamp = ({ item }: { item: DetentionCamp }) => {
    const facilities = JSON.parse(item.facilities) as string[];
    const occupancyPercentage = (item.current_occupancy / item.capacity) * 100;

    return (
      <View style={styles.campCard}>
        <View style={styles.campHeader}>
          <Text style={styles.campName}>{item.name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getCampStatusColor(item.campStatus) },
            ]}
          >
            <Text style={styles.statusText}>{getCampStatusText(item.campStatus)}</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.campDetail}>
          <Text style={styles.campDetailLabel}>Location:</Text>
          <Text style={styles.campDetailValue}>
            {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
          </Text>
        </View>

        {/* Capacity */}
        <View style={styles.campDetail}>
          <Text style={styles.campDetailLabel}>Capacity:</Text>
          <Text style={styles.campDetailValue}>
            {item.current_occupancy} / {item.capacity} ({occupancyPercentage.toFixed(0)}%)
          </Text>
        </View>

        {/* Occupancy Bar */}
        <View style={styles.occupancyBarContainer}>
          <View
            style={[
              styles.occupancyBar,
              {
                width: `${Math.min(occupancyPercentage, 100)}%`,
                backgroundColor:
                  occupancyPercentage >= 100
                    ? '#f44336'
                    : occupancyPercentage >= 80
                    ? '#ff9800'
                    : '#4caf50',
              },
            ]}
          />
        </View>

        {/* Facilities */}
        <View style={styles.facilitiesContainer}>
          <Text style={styles.campDetailLabel}>Facilities:</Text>
          <View style={styles.facilitiesList}>
            {facilities.map((facility, index) => (
              <View key={index} style={styles.facilityTag}>
                <Text style={styles.facilityText}>{facility}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Contact Information */}
        {(item.contact_person || item.contact_phone) && (
          <View style={styles.contactContainer}>
            {item.contact_person && (
              <View style={styles.campDetail}>
                <Text style={styles.campDetailLabel}>Contact:</Text>
                <Text style={styles.campDetailValue}>{item.contact_person}</Text>
              </View>
            )}
            {item.contact_phone && (
              <View style={styles.campDetail}>
                <Text style={styles.campDetailLabel}>Phone:</Text>
                <Text style={styles.campDetailValue}>{item.contact_phone}</Text>
              </View>
            )}
          </View>
        )}

        {/* Description */}
        {item.description && (
          <Text style={styles.campDescription}>{item.description}</Text>
        )}

        {/* Sync Status */}
        <View style={styles.syncBadge}>
          <Text
            style={[
              styles.syncText,
              item.status === 'synced'
                ? styles.synced
                : item.status === 'failed'
                ? styles.failed
                : styles.unsynced,
            ]}
          >
            {item.status === 'synced'
              ? '✓ Synced'
              : item.status === 'failed'
              ? '⚠ Failed'
              : '⏳ Pending Sync'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detention Camps</Text>
        </View>
        <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
          <Text style={styles.statusText}>{isOnline ? '● Online' : '● Offline'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{camps.length}</Text>
          <Text style={styles.statLabel}>Total Camps</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#4caf50' }]}>
            {camps.filter((c) => c.campStatus === 'operational').length}
          </Text>
          <Text style={styles.statLabel}>Operational</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#ff9800' }]}>
            {camps.filter((c) => c.campStatus === 'full').length}
          </Text>
          <Text style={styles.statLabel}>Full</Text>
        </View>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, showMap && styles.toggleButtonActive]}
          onPress={() => setShowMap(true)}
        >
          <Text style={[styles.toggleButtonText, showMap && styles.toggleButtonTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !showMap && styles.toggleButtonActive]}
          onPress={() => setShowMap(false)}
        >
          <Text style={[styles.toggleButtonText, !showMap && styles.toggleButtonTextActive]}>
            List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map View */}
      {showMap && camps.length > 0 && (
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: camps[0]?.latitude || 6.9271,
              longitude: camps[0]?.longitude || 79.8612,
              latitudeDelta: 2,
              longitudeDelta: 2,
            }}
          >
            {camps.map((camp) => (
              <Marker
                key={camp.id}
                coordinate={{
                  latitude: camp.latitude,
                  longitude: camp.longitude,
                }}
                title={camp.name}
                description={`${camp.current_occupancy}/${camp.capacity} - ${camp.campStatus}`}
                pinColor={
                  camp.campStatus === 'operational'
                    ? '#4caf50'
                    : camp.campStatus === 'full'
                    ? '#ff9800'
                    : '#f44336'
                }
              />
            ))}
          </MapView>
        </View>
      )}

      {/* Add Camp Button */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CampForm')}
        >
          <Text style={styles.primaryButtonText}>+ Add New Camp</Text>
        </TouchableOpacity>
      </View>

      {/* Camps List */}
      {!showMap && (
        <FlatList
          data={camps}
          renderItem={renderCamp}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No camps available yet</Text>
              <Text style={styles.emptySubtext}>
                Add a new camp or wait for admin approval
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 10,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  toggleButtonActive: {
    borderColor: '#4caf50',
    backgroundColor: '#4caf50',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  mapContainer: {
    height: 300,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  map: {
    flex: 1,
  },
  actionButtons: {
    padding: 20,
    paddingTop: 0,
  },
  primaryButton: {
    backgroundColor: '#4caf50',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  campCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  campHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  campName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  campDetail: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  campDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  campDetailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  occupancyBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginVertical: 8,
    overflow: 'hidden',
  },
  occupancyBar: {
    height: '100%',
    borderRadius: 4,
  },
  facilitiesContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  facilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  facilityTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  facilityText: {
    color: '#2196f3',
    fontSize: 12,
    fontWeight: '600',
  },
  contactContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  campDescription: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  syncBadge: {
    marginTop: 8,
  },
  syncText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  synced: {
    color: '#4caf50',
  },
  failed: {
    color: '#f44336',
  },
  unsynced: {
    color: '#ff9800',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  onlineBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  offlineBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
});
