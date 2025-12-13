/**
 * FIREBASE INTEGRATION EXAMPLES
 * 
 * This file contains practical examples of how to use
 * the Firebase services in your app components.
 */

import { useEffect, useState } from 'react';
import { cloudSyncService } from '../services/cloudSyncService';
import { firebaseService } from '../services/firebaseService';
import { firebaseQueryAPI } from '../services/firebaseQueryAPI';
import { Incident } from '../database/db';

// ============================================
// EXAMPLE 1: Create Incident and Sync
// ============================================

export async function createAndSyncIncident() {
  try {
    // Step 1: Create incident
    const newIncident = {
      id: `incident_${Date.now()}`,
      type: 'fire',
      severity: 4,
      latitude: 6.9271,
      longitude: 80.7789,
      timestamp: Date.now(),
      status: 'pending' as const,
    };

    // Step 2: Get user ID (from auth context or storage)
    // const userId = await TokenStorage.getUser().then(u => u?.id)

    // Step 3: Create in Firebase
    // const incidentId = await firebaseService.createIncident(newIncident, userId)

    // Step 4: Or sync from local database
    const syncResult = await cloudSyncService.syncToCloud();
    console.log(`✅ Synced ${syncResult.synced} incidents`);

    return syncResult;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================
// EXAMPLE 2: React Hook - Sync Status Listener
// ============================================

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    // Add listener
    const handleSyncStatus = (status: string) => {
      setSyncStatus(status);
    };

    cloudSyncService.addSyncListener(handleSyncStatus);

    // Get initial pending count
    cloudSyncService.getPendingCount().then(setPendingCount);

    // Start auto-sync
    cloudSyncService.startAutoSync(60000); // 60 seconds

    // Cleanup
    return () => {
      cloudSyncService.removeSyncListener(handleSyncStatus);
      cloudSyncService.stopAutoSync();
    };
  }, []);

  return { syncStatus, pendingCount };
}

// ============================================
// EXAMPLE 3: Get Nearby Incidents
// ============================================

export async function getNearbyIncidents(
  userLat: number,
  userLon: number,
  radiusKm: number = 50
) {
  try {
    const nearby = await firebaseQueryAPI.getIncidentsNearby(
      userLat,
      userLon,
      radiusKm
    );

    console.log(`📍 Found ${nearby.length} incidents within ${radiusKm}km`);
    return nearby;
  } catch (error) {
    console.error('❌ Error getting nearby incidents:', error);
    return [];
  }
}

// ============================================
// EXAMPLE 4: Get High Severity Incidents
// ============================================

export async function getHighSeverityIncidents() {
  try {
    // Get severity 4 and 5 incidents
    const critical = await firebaseQueryAPI.getHighSeverityIncidents(4);

    console.log(`🚨 Found ${critical.length} critical incidents`);
    critical.forEach((incident) => {
      console.log(`- ${incident.type}: Severity ${incident.severity}`);
    });

    return critical;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// ============================================
// EXAMPLE 5: Get Statistics Dashboard
// ============================================

export async function getIncidentStats() {
  try {
    const stats = await firebaseQueryAPI.getIncidentStats();

    console.log('📊 Incident Statistics:');
    console.log(`Total: ${stats.total}`);
    console.log('By Severity:', stats.bySeverity);
    console.log('By Type:', stats.byType);
    console.log('By Status:', stats.byStatus);

    return stats;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================
// EXAMPLE 6: Search Incidents with Filters
// ============================================

export async function searchIncidents() {
  try {
    const results = await firebaseQueryAPI.searchIncidents({
      type: 'fire',
      minSeverity: 3,
      status: 'synced',
    });

    console.log(`🔍 Found ${results.length} incidents matching filters`);
    return results;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// ============================================
// EXAMPLE 7: Get Recent Incidents
// ============================================

export async function getRecentIncidents(limit: number = 10) {
  try {
    const recent = await firebaseQueryAPI.getRecentIncidents(limit);

    console.log(`⏰ Retrieved ${recent.length} recent incidents`);
    recent.forEach((incident) => {
      const date = new Date(incident.timestamp).toLocaleString();
      console.log(`- ${incident.type} (${date})`);
    });

    return recent;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// ============================================
// EXAMPLE 8: Get Incident Hotspots
// ============================================

export async function getIncidentHotspots() {
  try {
    const hotspots = await firebaseQueryAPI.getIncidentHotspots(10);

    console.log(`🔥 Found ${hotspots.length} incident hotspots`);
    hotspots.forEach((hotspot, index) => {
      console.log(
        `${index + 1}. Cluster at (${hotspot.center.lat}, ${hotspot.center.lon}): ${hotspot.count} incidents`
      );
    });

    return hotspots;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// ============================================
// EXAMPLE 9: Bi-directional Full Sync
// ============================================

export async function performFullSync() {
  try {
    console.log('🔄 Starting full sync...');

    const result = await cloudSyncService.fullSync();

    console.log('✅ Full sync complete:');
    console.log(`- Downloaded: ${result.downloaded} incidents`);
    console.log(`- Synced: ${result.synced} incidents`);

    return result;
  } catch (error) {
    console.error('❌ Sync error:', error);
  }
}

// ============================================
// EXAMPLE 10: Get Sync Statistics
// ============================================

export async function getSyncStats() {
  try {
    const stats = await cloudSyncService.getSyncStats();

    console.log('📊 Sync Statistics:');
    console.log(`Local Pending: ${stats.localPending}`);
    console.log(`Local Total: ${stats.localTotal}`);
    console.log(`Cloud Total: ${stats.cloudTotal}`);

    return stats;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================
// EXAMPLE 11: Update Incident Status
// ============================================

export async function updateIncidentStatus(incidentId: string, newStatus: 'pending' | 'synced' | 'failed') {
  try {
    await firebaseService.updateIncidentStatus(incidentId, newStatus);
    console.log(`✅ Updated incident ${incidentId} to ${newStatus}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================
// EXAMPLE 12: Get Time Range Incidents
// ============================================

export async function getIncidentsFromToday() {
  try {
    const now = Date.now();
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const endOfDay = new Date(now).setHours(23, 59, 59, 999);

    const todayIncidents = await firebaseQueryAPI.getIncidentsInTimeRange(
      startOfDay,
      endOfDay
    );

    console.log(`📅 Found ${todayIncidents.length} incidents today`);
    return todayIncidents;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// ============================================
// EXAMPLE 13: React Component - Sync Status UI
// ============================================

export function SyncStatusComponent() {
  const { syncStatus, pendingCount } = useSyncStatus();

  const getStatusColor = () => {
    switch (syncStatus) {
      case 'syncing':
        return '#FFA500'; // Orange
      case 'success':
        return '#4CAF50'; // Green
      case 'error':
        return '#F44336'; // Red
      case 'offline':
        return '#9E9E9E'; // Gray
      default:
        return '#2196F3'; // Blue
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return `📤 Syncing (${pendingCount} pending)...`;
      case 'success':
        return '✅ Synced';
      case 'error':
        return '❌ Sync Failed';
      case 'offline':
        return '📵 Offline Mode';
      default:
        return `⏳ Ready (${pendingCount} pending)`;
    }
  };

  return {
    color: getStatusColor(),
    text: getStatusText(),
    status: syncStatus,
    pending: pendingCount,
  };
}

// ============================================
// EXAMPLE 14: Batch Operations
// ============================================

export async function syncMultipleIncidents(incidents: any[]) {
  try {
    // Note: Get userId from your auth context
    const userId = 'user_123'; // Replace with actual user ID

    const result = await firebaseService.syncIncidents(incidents, userId);

    console.log(`✅ Batch sync complete:`);
    console.log(`- Success: ${result.success}`);
    console.log(`- Failed: ${result.failed}`);

    return result;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================
// EXAMPLE 15: Error Handling Pattern
// ============================================

export async function safeFirebaseOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('❌ Firebase operation failed:', error);
    console.log('⚠️ Using offline fallback data');
    return fallback;
  }
}

// Usage:
export async function getSafeRecentIncidents() {
  return safeFirebaseOperation(
    () => firebaseQueryAPI.getRecentIncidents(10),
    [] // Empty array fallback
  );
}

// ============================================
// INITIALIZATION HELPER
// ============================================

/**
 * Call this in your app initialization (App.tsx or appInitializer.ts)
 * to set up Firebase sync automatically
 */
export async function initializeFirebaseSync() {
  try {
    console.log('🚀 Initializing Firebase sync...');

    // Start automatic sync
    cloudSyncService.startAutoSync(60000); // Sync every 60 seconds

    // Listen to sync events
    cloudSyncService.addSyncListener((status) => {
      console.log(`[SYNC] Status: ${status}`);
    });

    // Perform initial sync
    const syncResult = await cloudSyncService.syncToCloud();
    console.log(`✅ Firebase sync initialized. Synced: ${syncResult.synced}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase sync:', error);
    return false;
  }
}
