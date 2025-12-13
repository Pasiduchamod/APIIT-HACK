# Firebase Cloud Database Implementation

## Overview
This document outlines the Firebase Firestore integration for Project Aegis mobile app, including database schema, API endpoints, and synchronization strategy.

---

## 📊 Database Schema

### Collection: `incidents`

**Description:** Stores incident reports from users with geolocation and severity information.

#### Fields:

| Field | Type | Description | Required | Indexed |
|-------|------|-------------|----------|---------|
| `id` | string | Unique identifier (Document ID) | ✅ | ✅ |
| `type` | string | Incident type (fire, flood, earthquake, etc.) | ✅ | ✅ |
| `severity` | number | Severity level (1-5, where 5 is critical) | ✅ | ✅ |
| `latitude` | number | GPS latitude coordinate | ✅ | ❌ |
| `longitude` | number | GPS longitude coordinate | ✅ | ❌ |
| `timestamp` | number | When incident occurred (milliseconds) | ✅ | ✅ |
| `status` | string | Sync status: pending, synced, failed, deleted | ✅ | ✅ |
| `userId` | string | User ID who reported (from auth) | ✅ | ✅ |
| `created_at` | number | When document created (milliseconds) | ✅ | ✅ |
| `updated_at` | number | Last update time (milliseconds) | ✅ | ✅ |
| `description` | string | Optional incident details/description | ❌ | ❌ |
| `imageUrl` | string | Optional Cloud Storage image URL | ❌ | ❌ |

#### Composite Indexes:
```
- (type, severity)
- (userId, status)
- (timestamp, severity)
```

#### Example Document:
```json
{
  "id": "incident_uuid_12345",
  "type": "fire",
  "severity": 5,
  "latitude": 6.9271,
  "longitude": 80.7789,
  "timestamp": 1702432800000,
  "status": "synced",
  "userId": "user_123",
  "created_at": 1702432800000,
  "updated_at": 1702432800000,
  "description": "Large fire at commercial building",
  "imageUrl": "https://storage.googleapis.com/bucket/image.jpg"
}
```

---

## 🔌 API Implementation

### Service: FirebaseService

Complete CRUD operations for incidents.

#### 1. CREATE Operations

```typescript
// Create single incident
await firebaseService.createIncident(incident, userId)
```

**Parameters:**
- `incident`: Omit<FirebaseIncident, 'created_at' | 'updated_at'>
- `userId`: string

**Returns:** Promise<string> - incident ID

---

#### 2. READ Operations

```typescript
// Get single incident
await firebaseService.getIncident(incidentId)

// Get all incidents
await firebaseService.getAllIncidents()

// Get incidents by user
await firebaseService.getIncidentsByUser(userId)

// Get pending incidents (not synced)
await firebaseService.getPendingIncidents()

// Get incidents by severity
await firebaseService.getIncidentsBySeverity(severity)

// Get incidents by type
await firebaseService.getIncidentsByType(type)
```

---

#### 3. UPDATE Operations

```typescript
// Update incident status
await firebaseService.updateIncidentStatus(incidentId, status)

// Update incident fields
await firebaseService.updateIncident(incidentId, updates)
```

---

#### 4. DELETE Operations

```typescript
// Soft delete (marks as deleted)
await firebaseService.deleteIncident(incidentId)
```

---

#### 5. BULK Operations

```typescript
// Sync multiple incidents
await firebaseService.syncIncidents(incidents, userId)
```

**Returns:** { success: number, failed: number }

---

#### 6. STATISTICS

```typescript
// Get total count
await firebaseService.getIncidentCount()

// Get count by severity
await firebaseService.getCountBySeverity()

// Get count by type
await firebaseService.getCountByType()
```

---

### Service: CloudSyncService

Bi-directional synchronization between local SQLite and Firebase.

```typescript
// Push local incidents to Firebase
await cloudSyncService.syncToCloud()

// Pull incidents from Firebase to local DB
await cloudSyncService.syncFromCloud()

// Bi-directional sync (pull then push)
await cloudSyncService.fullSync()

// Start automatic sync every N milliseconds
cloudSyncService.startAutoSync(60000) // 60 seconds

// Stop automatic sync
cloudSyncService.stopAutoSync()

// Get sync statistics
await cloudSyncService.getSyncStats()

// Subscribe to sync status
cloudSyncService.addSyncListener((status) => {
  console.log('Sync status:', status) // 'syncing', 'offline', 'success', 'error', 'idle'
})
```

---

### Service: FirebaseQueryAPI

Advanced queries and analytics.

```typescript
// Get incidents near location
await firebaseQueryAPI.getIncidentsNearby(latitude, longitude, radiusKm)

// Get high severity incidents
await firebaseQueryAPI.getHighSeverityIncidents(threshold)

// Get incidents in time range
await firebaseQueryAPI.getIncidentsInTimeRange(startTime, endTime)

// Get incident statistics
await firebaseQueryAPI.getIncidentStats()

// Search with multiple filters
await firebaseQueryAPI.searchIncidents({
  type: 'fire',
  minSeverity: 3,
  userId: 'user_123',
  status: 'synced'
})

// Get recent incidents
await firebaseQueryAPI.getRecentIncidents(limit)

// Get incident hotspots (clustering)
await firebaseQueryAPI.getIncidentHotspots(gridSize)
```

---

## 🔄 Synchronization Strategy

### Local Database (SQLite)
- **File:** ProjectAegis.db (Expo SQLite)
- **Purpose:** Offline-first storage
- **Sync Status:** pending, synced, failed

### Cloud Database (Firestore)
- **Collection:** incidents
- **Purpose:** Central cloud repository
- **Real-time Sync:** Yes (enabled by default)

### Sync Flow

```
┌─────────────────────────────────────────────────────────┐
│ User Creates Incident on Mobile App                     │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  SQLite Database    │
        │  Status: pending    │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────────────────┐
        │ Network Connected?               │
        └──────────┬──────────┬───────────┘
                   │          │
              YES  │          │ NO
                   │          │
        ┌──────────▼──┐   ┌───▼────────────┐
        │   Sync to   │   │ Queue locally  │
        │  Firestore  │   │ Retry on       │
        └──────────┬──┘   │ reconnection   │
                   │      └────────────────┘
        ┌──────────▼──────────────────┐
        │ Firestore Cloud Database    │
        │ Status: synced              │
        └─────────────────────────────┘
```

### Auto-Sync Configuration

```typescript
// In app initialization
cloudSyncService.startAutoSync(60000) // Sync every 60 seconds

// Listen to sync events
cloudSyncService.addSyncListener((status) => {
  if (status === 'syncing') console.log('📤 Uploading...')
  if (status === 'success') console.log('✅ Synced!')
  if (status === 'offline') console.log('📵 Offline mode')
  if (status === 'error') console.log('❌ Sync failed')
})
```

---

## 🔐 Security Rules

### Firestore Security Rules (Deploy to Firebase Console)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write only to authenticated users
    match /incidents/{document=**} {
      allow read, write: if request.auth != null;
      
      // Users can only read/write their own incidents
      allow read, write: if request.auth.uid == resource.data.userId;
      
      // Admins can read all
      allow read: if request.auth.token.admin == true;
    }
  }
}
```

---

## 📱 Usage Examples

### Example 1: Create and Sync Incident

```typescript
import { firebaseService } from '../services/firebaseService'
import { cloudSyncService } from '../services/cloudSyncService'
import { dbService } from '../database/db'

// Create incident locally
const incident = await dbService.createIncident({
  id: generateUUID(),
  type: 'fire',
  severity: 4,
  latitude: 6.9271,
  longitude: 80.7789,
  timestamp: Date.now(),
  status: 'pending'
})

// Sync to cloud
const syncResult = await cloudSyncService.syncToCloud()
console.log(`${syncResult.synced} incidents synced`)
```

### Example 2: Get Nearby Incidents

```typescript
import { firebaseQueryAPI } from '../services/firebaseQueryAPI'

// Get incidents within 50km radius
const nearby = await firebaseQueryAPI.getIncidentsNearby(
  6.9271,  // latitude
  80.7789, // longitude
  50       // radius in km
)

console.log(`Found ${nearby.length} incidents nearby`)
```

### Example 3: Get Statistics

```typescript
const stats = await firebaseQueryAPI.getIncidentStats()

console.log('Total incidents:', stats.total)
console.log('By severity:', stats.bySeverity)  // { 1: 5, 2: 10, 3: 15, 4: 20, 5: 8 }
console.log('By type:', stats.byType)          // { 'fire': 20, 'flood': 15, 'earthquake': 8 }
console.log('By status:', stats.byStatus)      // { 'pending': 5, 'synced': 43, 'failed': 0 }
```

### Example 4: Listen to Sync Status

```typescript
import { cloudSyncService } from '../services/cloudSyncService'

// Add listener
cloudSyncService.addSyncListener((status) => {
  switch(status) {
    case 'syncing':
      console.log('📤 Syncing to cloud...')
      break
    case 'downloading':
      console.log('📥 Downloading from cloud...')
      break
    case 'success':
      console.log('✅ Sync successful!')
      break
    case 'error':
      console.log('❌ Sync failed')
      break
    case 'offline':
      console.log('📵 Offline mode')
      break
  }
})

// Start auto-sync
cloudSyncService.startAutoSync(30000) // Every 30 seconds
```

---

## 🚀 Deployment Steps

### 1. Setup Firebase Project

```bash
# Visit Firebase Console: https://console.firebase.google.com

# Create new project
# Enable Firestore Database
# Enable Authentication (Email/Password or Google)
# Get config from Project Settings
```

### 2. Update Firebase Config

**File:** `src/config/firebase.ts`

```typescript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
}
```

### 3. Deploy Security Rules

In Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /incidents/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Initialize in App

**File:** `App.tsx` or `src/utils/appInitializer.ts`

```typescript
import { cloudSyncService } from './services/cloudSyncService'

// After auth & db initialization
cloudSyncService.startAutoSync(60000) // Sync every minute
```

---

## 📊 Database Tables Summary

| Table | Purpose | Sync Method | Storage |
|-------|---------|------------|---------|
| `incidents` | Main incident reports | Firestore | Cloud |
| `incidents` | Local cache | SQLite | Device |

---

## ⚠️ Important Notes

1. **Offline-First:** App works without internet; syncs when available
2. **Data Loss Protection:** All incidents saved locally before cloud sync
3. **Battery Friendly:** Auto-sync can be disabled during low battery
4. **Privacy:** Only syncs authenticated user data
5. **Real-time Updates:** Firestore listener (optional) for live updates

---

## 🔍 Monitoring & Debugging

```typescript
// Check sync status
const stats = await cloudSyncService.getSyncStats()
console.log('Local pending:', stats.localPending)
console.log('Local total:', stats.localTotal)
console.log('Cloud total:', stats.cloudTotal)

// Manual sync
await cloudSyncService.fullSync()

// Check Firebase connection
try {
  await firebaseService.getIncidentCount()
  console.log('✅ Firebase connected')
} catch(error) {
  console.error('❌ Firebase error:', error)
}
```

---

## 📚 References

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Offline Sync Patterns](https://firebase.google.com/docs/firestore/offline-data)
