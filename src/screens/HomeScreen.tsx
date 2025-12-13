import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Incident, dbService } from '../database/db';
import { AidRequest } from '../database/models/AidRequest';
import { cloudSyncService } from '../services/cloudSyncService';
import { imageSyncService } from '../services/imageSyncService';

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user, logout } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [aidRequests, setAidRequests] = useState<AidRequest[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [activeTab, setActiveTab] = useState<'incidents' | 'aidRequests'>('incidents');
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Refresh incidents whenever screen comes into focus (e.g., returning from IncidentForm)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadData();

    let previousOnlineState = true;

    // Monitor network status and trigger sync when connection is restored
    const netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const isCurrentlyOnline = state.isConnected ?? false;
      setIsOnline(isCurrentlyOnline);
      
      // If connection was restored (offline -> online), trigger immediate sync
      if (!previousOnlineState && isCurrentlyOnline) {
        console.log('🌐 Internet connection restored - syncing data...');
        (async () => {
          try {
            if (dbService.isInitialized()) {
              const result = await cloudSyncService.syncFromCloud();
              if (result.downloaded > 0) {
                await loadData();
                setLastSyncTime(new Date());
                setShowUpdateBanner(true);
                setTimeout(() => setShowUpdateBanner(false), 3000);
              }
            }
          } catch (error) {
            console.error('Error syncing after connection restore:', error);
          }
        })();
      }
      
      previousOnlineState = isCurrentlyOnline;
    });

    // Listen to sync status
    const handleSyncStatus = (status: string) => {
      setSyncStatus(status);
      if (status === 'success') {
        loadData();
      }
    };

    cloudSyncService.addSyncListener(handleSyncStatus);

    // Auto-refresh every 5 seconds to get Firebase updates (only when online)
    const autoRefreshInterval = setInterval(async () => {
      try {
        if (!dbService.isInitialized()) return;
        
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected && netInfo.isInternetReachable) {
          const result = await cloudSyncService.syncFromCloud();
          // downloaded includes both new records and updates (e.g., actionStatus changes from dashboard)
          if (result.downloaded > 0) {
            console.log(`✅ Auto-sync: ${result.downloaded} updates received from Firebase`);
            await loadData();
            setLastSyncTime(new Date());
          }
        }
      } catch (error) {
        // Silent auto-refresh error
      }
    }, 5000); // 5 seconds

    return () => {
      netInfoUnsubscribe();
      cloudSyncService.removeSyncListener(handleSyncStatus);
      clearInterval(autoRefreshInterval);
    };
  }, []);

  const loadData = async () => {
    try {
      // Check if database is initialized before attempting to load
      if (!dbService.isInitialized()) {
        return;
      }

      // Load incidents
      const allIncidents = await cloudSyncService.getAllLocalIncidents();
      setIncidents(allIncidents);

      // Load aid requests
      const allAidRequests = await dbService.getAllAidRequests();
      setAidRequests(allAidRequests);

      // Calculate total unsynced count
      const incidentPendingCount = await cloudSyncService.getPendingCount();
      const aidRequestPendingCount = await dbService.getPendingAidRequestsCount();
      const campPendingCount = await dbService.getPendingDetentionCampsCount();
      setUnsyncedCount(incidentPendingCount + aidRequestPendingCount + campPendingCount);
    } catch (error) {
      // Silent error
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (isOnline) {
        const result = await cloudSyncService.fullSync();
        setLastSyncTime(new Date());
        
        // Also sync images after data sync
        await imageSyncService.syncAllPendingImages();
        
        if (result.downloaded > 0) {
          setShowUpdateBanner(true);
          setTimeout(() => setShowUpdateBanner(false), 3000);
        }
      }
      await loadData();
    } catch (error) {
      // Silent refresh error
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please connect to the internet.');
      return;
    }

    try {
      setIsRefreshing(true);
      
      // Check for pending images first
      const pendingIncidents = await dbService.getIncidentsWithPendingImages();
      
      // Sync data first
      const result = await cloudSyncService.syncToCloud();
      setLastSyncTime(new Date());
      
      // Then sync images
      const imageResults = await imageSyncService.syncAllPendingImages();
      const imagesSynced = imageResults.filter(r => r.success).length;
      
      if (result.success) {
        Alert.alert(
          'Success', 
          `Synced ${result.synced} incident(s) and ${imagesSynced} image(s)`
        );
        loadData();
      } else {
        Alert.alert('Sync Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      Alert.alert('Sync Error', error.message || 'Failed to sync');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' },
      ]
    );
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    console.log(`[RENDER] Incident ${item.id.substring(0, 8)}: actionStatus=${item.actionStatus}`);
    
    const getActionStatusDisplay = (status?: string) => {
      switch (status) {
        case 'taking action':
          return { text: 'Action In Progress', color: '#ff9800', emoji: '' };
        case 'completed':
          return { text: 'Completed', color: '#4caf50', emoji: '' };
        case 'pending':
        default:
          return { text: 'Pending Action', color: '#999', emoji: '' };
      }
    };

    const actionStatus = getActionStatusDisplay(item.actionStatus);

    return (
      <View style={styles.incidentCard}>
        <View style={styles.incidentHeader}>
          <Text style={styles.incidentType}>{item.type}</Text>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
            <Text style={styles.severityText}>Severity {item.severity}</Text>
          </View>
        </View>
        <Text style={styles.incidentLocation}>
          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
        </Text>
        <Text style={styles.incidentTime}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
        <View style={styles.actionStatusContainer}>
          <View style={[styles.actionStatusBadge, { backgroundColor: actionStatus.color }]}>
            <Text style={styles.actionStatusText}>{actionStatus.text}</Text>
          </View>
        </View>
        <View style={styles.syncBadge}>
          <Text style={[styles.syncText, item.status === 'synced' ? styles.synced : item.status === 'failed' ? styles.failed : styles.unsynced]}>
            {item.status === 'synced' ? 'Synced' : item.status === 'failed' ? 'Failed' : 'Pending Sync'}
          </Text>
        </View>
      </View>
    );
  };

  const renderAidRequest = ({ item }: { item: AidRequest }) => {
    const aidTypes = JSON.parse(item.aid_types) as string[];
    const primaryAidType = aidTypes[0] || 'Aid Request';
    
    const getAidStatusDisplay = (status?: string) => {
      switch (status) {
        case 'taking action':
          return { text: 'Aid In Progress', color: '#2196f3', emoji: '' };
        case 'completed':
          return { text: 'Aid Received', color: '#4caf50', emoji: '' };
        case 'pending':
        default:
          return { text: 'Pending', color: '#ffa726', emoji: '' };
      }
    };

    const aidStatus = getAidStatusDisplay(item.aidStatus);

    const handleMarkAsReceived = async () => {
      try {
        await dbService.updateAidRequestAidStatus(item.id, 'completed');
        await loadData();
        
        // Auto-sync if online
        if (isOnline) {
          try {
            await cloudSyncService.syncToCloud();
          } catch (syncError) {
            // Will retry later
          }
        }
        
        Alert.alert('Success', 'Aid marked as received! Thank you for confirming.');
      } catch (error) {
        Alert.alert('Error', 'Failed to update aid status');
      }
    };

    return (
      <View style={styles.incidentCard}>
        <View style={styles.incidentHeader}>
          <Text style={styles.incidentType}>{primaryAidType}</Text>
          <View style={[styles.severityBadge, { backgroundColor: getPriorityColor(item.priority_level) }]}>
            <Text style={styles.severityText}>Priority {item.priority_level}</Text>
          </View>
        </View>
        {aidTypes.length > 1 && (
          <View style={styles.aidTypesContainer}>
            {aidTypes.slice(1).map((type, index) => (
              <View key={index} style={styles.aidTypeTag}>
                <Text style={styles.aidTypeTagText}>{type}</Text>
              </View>
            ))}
          </View>
        )}
        {item.description && (
          <Text style={styles.aidDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text style={styles.incidentLocation}>
          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
        </Text>
        <Text style={styles.incidentTime}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
        <View style={styles.actionStatusContainer}>
          <View style={[styles.actionStatusBadge, { backgroundColor: aidStatus.color }]}>
            <Text style={styles.actionStatusText}>{aidStatus.text}</Text>
          </View>
        </View>
        {item.aidStatus === 'taking action' && (
          <TouchableOpacity
            style={styles.markReceivedButton}
            onPress={handleMarkAsReceived}
          >
            <Text style={styles.markReceivedButtonText}>Mark as Received</Text>
          </TouchableOpacity>
        )}
        <View style={styles.syncBadge}>
          <Text style={[styles.syncText, item.status === 'synced' ? styles.synced : item.status === 'failed' ? styles.failed : styles.unsynced]}>
            {item.status === 'synced' ? '✓ Synced' : item.status === 'failed' ? '⚠ Failed' : '⏳ Pending Sync'}
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
          <Text style={styles.headerTitle}>LankaSafe</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
            <Text style={styles.statusText}>{isOnline ? '● Online' : '● Offline'}</Text>
          </View>
          <TouchableOpacity
            style={styles.userIconButton}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Text style={styles.userIcon}>U</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncButton, !isOnline && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={!isOnline}
          >
            <Text style={styles.syncButtonText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Dropdown Menu */}
      {showMenu && (
        <View style={styles.dropdownMenu}>
          <View style={styles.profileSection}>
            <Text style={styles.profileLabel}>Username:</Text>
            <Text style={styles.profileValue}>{user?.username || 'Not logged in'}</Text>
            {user?.name && (
              <>
                <Text style={styles.profileLabel}>Name:</Text>
                <Text style={styles.profileValue}>{user.name}</Text>
              </>
            )}
            {user?.district && (
              <>
                <Text style={styles.profileLabel}>District:</Text>
                <Text style={styles.profileValue}>{user.district}</Text>
              </>
            )}
            {user?.contactNumber && (
              <>
                <Text style={styles.profileLabel}>Contact:</Text>
                <Text style={styles.profileValue}>{user.contactNumber}</Text>
              </>
            )}
            {lastSyncTime && (
              <>
                <Text style={styles.profileLabel}>Last sync:</Text>
                <Text style={styles.profileValue}>{lastSyncTime.toLocaleTimeString()}</Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              handleLogout();
            }}
          >
            <Text style={styles.menuItemText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{incidents.length}</Text>
          <Text style={styles.statLabel}>Incidents</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{aidRequests.length}</Text>
          <Text style={styles.statLabel}>Aid Requests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f44336' }]}>{unsyncedCount}</Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
        </View>
      </View>

      {/* Sync Status */}
      {syncStatus === 'syncing' && (
        <View style={styles.syncingBanner}>
          <Text style={styles.syncingText}>Syncing data...</Text>
        </View>
      )}

      {/* Update Received Banner */}
      {showUpdateBanner && (
        <View style={styles.updateBanner}>
          <Text style={styles.updateBannerText}>Status updates received from server</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('IncidentForm')}
        >
          <Text style={styles.primaryButtonText}>+ Report New Incident</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.aidButton}
          onPress={() => navigation.navigate('AidRequestForm')}
        >
          <Text style={styles.aidButtonText}>+ Request Aid</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.campsButton}
          onPress={() => navigation.navigate('CampsList')}
        >
          <Text style={styles.campsButtonText}>View Camps</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.volunteerButton}
          onPress={() => navigation.navigate('VolunteerForm')}
        >
          <Text style={styles.volunteerButtonText}>Volunteer</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'incidents' && styles.activeTab]}
          onPress={() => setActiveTab('incidents')}
        >
          <Text style={[styles.tabText, activeTab === 'incidents' && styles.activeTabText]}>
            Incidents ({incidents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'aidRequests' && styles.activeTab]}
          onPress={() => setActiveTab('aidRequests')}
        >
          <Text style={[styles.tabText, activeTab === 'aidRequests' && styles.activeTabText]}>
            Aid Requests ({aidRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Incidents List */}
      {activeTab === 'incidents' ? (
        <FlatList
          data={incidents}
          renderItem={renderIncident}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No incidents recorded yet</Text>
              <Text style={styles.emptySubtext}>Tap the button above to report an incident</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={aidRequests}
          renderItem={renderAidRequest}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No aid requests yet</Text>
              <Text style={styles.emptySubtext}>Tap the button above to request aid</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getSeverityColor = (severity: number): string => {
  const colors = ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'];
  return colors[severity - 1] || '#999';
};

const getPriorityColor = (priority: number): string => {
  const colors = ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'];
  return colors[priority - 1] || '#999';
};

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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  lastSyncText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  onlineBadge: {
    backgroundColor: '#4caf50',
  },
  offlineBadge: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  syncButton: {
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginLeft: 8,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    fontSize: 16,
  },
  userIconButton: {
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  userIcon: {
    fontSize: 16,
  },
  dropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minWidth: 200,
  },
  profileSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    fontWeight: '600',
  },
  profileValue: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
    fontWeight: '500',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  headerButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    color: '#333',
    fontSize: 12,
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
    color: '#e94560',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  syncingBanner: {
    backgroundColor: '#2196f3',
    padding: 12,
    alignItems: 'center',
  },
  syncingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  updateBanner: {
    backgroundColor: '#4caf50',
    padding: 12,
    alignItems: 'center',
  },
  updateBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtons: {
    padding: 20,
    paddingTop: 0,
  },
  primaryButton: {
    backgroundColor: '#e94560',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aidButton: {
    backgroundColor: '#2196f3',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  aidButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  campsButton: {
    backgroundColor: '#4caf50',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  campsButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  volunteerButton: {
    backgroundColor: '#8b5cf6',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  volunteerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  incidentCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  incidentLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  incidentTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  syncBadge: {
    marginTop: 5,
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
  actionStatusContainer: {
    marginTop: 8,
    marginBottom: 6,
  },
  actionStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionStatusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  markReceivedButton: {
    marginTop: 10,
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  markReceivedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#e94560',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#e94560',
  },
  aidTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
    gap: 6,
  },
  aidTypeTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  aidTypeTagText: {
    color: '#2196f3',
    fontSize: 10,
    fontWeight: '600',
  },
  aidDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontStyle: 'italic',
  },
});
