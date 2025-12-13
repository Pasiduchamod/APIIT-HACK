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
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Incident } from '../database/db';
import { cloudSyncService } from '../services/cloudSyncService';

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user, logout } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');

  // Refresh incidents whenever screen comes into focus (e.g., returning from IncidentForm)
  useFocusEffect(
    useCallback(() => {
      loadIncidents();
    }, [])
  );

  useEffect(() => {
    loadIncidents();

    // Monitor network status
    const netInfoUnsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    // Listen to sync status
    const handleSyncStatus = (status: string) => {
      setSyncStatus(status);
      if (status === 'success') {
        loadIncidents();
      }
    };

    cloudSyncService.addSyncListener(handleSyncStatus);

    return () => {
      netInfoUnsubscribe();
      cloudSyncService.removeSyncListener(handleSyncStatus);
    };
  }, []);

  const loadIncidents = async () => {
    try {
      const allIncidents = await cloudSyncService.getAllLocalIncidents();
      setIncidents(allIncidents);

      const count = await cloudSyncService.getPendingCount();
      setUnsyncedCount(count);
    } catch (error) {
      console.error('Error loading incidents:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadIncidents();
    if (isOnline) {
      await cloudSyncService.syncToCloud();
    }
    setIsRefreshing(false);
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please connect to the internet.');
      return;
    }

    const result = await cloudSyncService.syncToCloud();
    if (result.success) {
      Alert.alert('Success', `Synced ${result.synced} incident(s)`);
      loadIncidents();
    } else {
      Alert.alert('Sync Failed', result.error || 'Unknown error');
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

  const renderIncident = ({ item }: { item: Incident }) => (
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
      <View style={styles.syncBadge}>
        <Text style={[styles.syncText, item.status === 'synced' ? styles.synced : item.status === 'failed' ? styles.failed : styles.unsynced]}>
          {item.status === 'synced' ? '✓ Synced' : item.status === 'failed' ? '⚠ Failed' : '⏳ Pending Sync'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>LankaSafe</Text>
          <Text style={styles.headerSubtitle}>Welcome, {user?.username}</Text>
        </View>
        <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
          <Text style={styles.statusText}>{isOnline ? '● Online' : '● Offline'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{incidents.length}</Text>
          <Text style={styles.statLabel}>Total Incidents</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f44336' }]}>{unsyncedCount}</Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
        </View>
      </View>

      {/* Sync Status */}
      {syncStatus === 'syncing' && (
        <View style={styles.syncingBanner}>
          <Text style={styles.syncingText}> Syncing data...</Text>
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
        <View style={styles.secondaryButtons}>
          <TouchableOpacity
            style={[styles.secondaryButton, !isOnline && styles.secondaryButtonDisabled]}
            onPress={handleManualSync}
            disabled={!isOnline}
          >
            <Text style={styles.secondaryButtonText}>Sync Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleLogout}
          >
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Incidents List */}
      <Text style={styles.listTitle}>Recent Incidents</Text>
      <FlatList
        data={incidents}
        renderItem={renderIncident}
        keyExtractor={(item) => item.id}
        style={styles.list}
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
    </View>
  );
}

const getSeverityColor = (severity: number): string => {
  const colors = ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'];
  return colors[severity - 1] || '#999';
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
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
});
