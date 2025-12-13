# Firebase API Reference

## Quick Start

```typescript
// 1. Initialize Firebase in your app
import { initializeFirebaseSync } from './services/firebaseExamples'
await initializeFirebaseSync()

// 2. Use any service
import { firebaseService } from './services/firebaseService'
import { cloudSyncService } from './services/cloudSyncService'
import { firebaseQueryAPI } from './services/firebaseQueryAPI'
```

---

## 📦 Available Services

### 1. FirebaseService - CRUD Operations
**File:** `src/services/firebaseService.ts`

#### CREATE
```typescript
firebaseService.createIncident(incident, userId) → Promise<string>
firebaseService.syncIncidents(incidents, userId) → Promise<{success, failed}>
```

#### READ
```typescript
firebaseService.getIncident(incidentId) → Promise<FirebaseIncident | null>
firebaseService.getAllIncidents() → Promise<FirebaseIncident[]>
firebaseService.getIncidentsByUser(userId) → Promise<FirebaseIncident[]>
firebaseService.getPendingIncidents() → Promise<FirebaseIncident[]>
firebaseService.getIncidentsBySeverity(severity) → Promise<FirebaseIncident[]>
firebaseService.getIncidentsByType(type) → Promise<FirebaseIncident[]>
```

#### UPDATE
```typescript
firebaseService.updateIncidentStatus(incidentId, status) → Promise<void>
firebaseService.updateIncident(incidentId, updates) → Promise<void>
```

#### DELETE
```typescript
firebaseService.deleteIncident(incidentId) → Promise<void>
```

#### STATS
```typescript
firebaseService.getIncidentCount() → Promise<number>
firebaseService.getCountBySeverity() → Promise<Record<number, number>>
firebaseService.getCountByType() → Promise<Record<string, number>>
```

---

### 2. CloudSyncService - Synchronization
**File:** `src/services/cloudSyncService.ts`

#### Sync Operations
```typescript
cloudSyncService.syncToCloud() → Promise<{success, synced, error?}>
cloudSyncService.syncFromCloud() → Promise<{success, downloaded, error?}>
cloudSyncService.fullSync() → Promise<{success, downloaded, synced}>
```

#### Auto-Sync
```typescript
cloudSyncService.startAutoSync(intervalMs = 60000) → void
cloudSyncService.stopAutoSync() → void
```

#### Events & Status
```typescript
cloudSyncService.addSyncListener(listener) → void
cloudSyncService.removeSyncListener(listener) → void
```

**Sync Status Values:**
- `'syncing'` - Currently syncing
- `'downloading'` - Downloading from cloud
- `'success'` - Sync completed successfully
- `'error'` - Sync failed
- `'offline'` - No internet connection
- `'idle'` - No sync in progress

#### Data Access
```typescript
cloudSyncService.getPendingCount() → Promise<number>
cloudSyncService.getAllLocalIncidents() → Promise<Incident[]>
cloudSyncService.getAllCloudIncidents() → Promise<FirebaseIncident[]>
cloudSyncService.getSyncStats() → Promise<{localPending, localTotal, cloudTotal}>
```

---

### 3. FirebaseQueryAPI - Advanced Queries
**File:** `src/services/firebaseQueryAPI.ts`

#### Geographic Queries
```typescript
firebaseQueryAPI.getIncidentsNearby(
  latitude: number,
  longitude: number,
  radiusKm?: number
) → Promise<FirebaseIncident[]>
```
**Example:**
```typescript
const nearby = await firebaseQueryAPI.getIncidentsNearby(6.9271, 80.7789, 50)
```

#### Severity Queries
```typescript
firebaseQueryAPI.getHighSeverityIncidents(threshold = 4) → Promise<FirebaseIncident[]>
```

#### Time Range Queries
```typescript
firebaseQueryAPI.getIncidentsInTimeRange(
  startTime: number,    // milliseconds
  endTime: number       // milliseconds
) → Promise<FirebaseIncident[]>
```
**Example:**
```typescript
const today = new Date().setHours(0, 0, 0, 0)
const tomorrow = new Date().setHours(23, 59, 59, 999)
const todayIncidents = await firebaseQueryAPI.getIncidentsInTimeRange(today, tomorrow)
```

#### Filtering & Search
```typescript
firebaseQueryAPI.searchIncidents(filters: {
  type?: string
  severity?: number
  userId?: string
  status?: string
  minSeverity?: number
}) → Promise<FirebaseIncident[]>
```
**Example:**
```typescript
const results = await firebaseQueryAPI.searchIncidents({
  type: 'fire',
  minSeverity: 3,
  status: 'synced'
})
```

#### Recent Items
```typescript
firebaseQueryAPI.getRecentIncidents(limit = 20) → Promise<FirebaseIncident[]>
```

#### Analytics
```typescript
firebaseQueryAPI.getIncidentStats() → Promise<{
  total: number
  bySeverity: Record<number, number>
  byType: Record<string, number>
  byStatus: Record<string, number>
}>
```

#### Clustering/Hotspots
```typescript
firebaseQueryAPI.getIncidentHotspots(gridSize = 10) → Promise<Array<{
  center: {lat: number, lon: number}
  count: number
  incidents: FirebaseIncident[]
}>>
```

---

## 🏗️ Data Types

### FirebaseIncident
```typescript
interface FirebaseIncident {
  id: string                                    // Unique ID
  type: string                                  // Incident type
  severity: number                              // 1-5
  latitude: number                              // GPS coordinate
  longitude: number                             // GPS coordinate
  timestamp: number                             // Milliseconds
  status: 'pending' | 'synced' | 'failed'      // Sync status
  userId: string                                // Reporter user ID
  created_at: number                            // Creation time
  updated_at: number                            // Last update
  description?: string                          // Optional details
  imageUrl?: string                             // Optional image URL
}
```

### Sync Response
```typescript
{
  success: boolean    // Whether operation succeeded
  synced?: number     // Number of items synced
  downloaded?: number // Number of items downloaded
  error?: string      // Error message if failed
}
```

---

## 💡 Common Patterns

### Pattern 1: Create and Sync Incident
```typescript
import { dbService } from './database/db'
import { cloudSyncService } from './services/cloudSyncService'
import { v4 as uuid } from 'uuid'

const incident = await dbService.createIncident({
  id: uuid(),
  type: 'fire',
  severity: 4,
  latitude: 6.9271,
  longitude: 80.7789,
  timestamp: Date.now(),
  status: 'pending'
})

const result = await cloudSyncService.syncToCloud()
console.log(`Synced ${result.synced} incidents`)
```

### Pattern 2: Auto-Sync with Listener
```typescript
import { cloudSyncService } from './services/cloudSyncService'

useEffect(() => {
  // Listen to sync events
  const handleSync = (status: string) => {
    if (status === 'success') {
      console.log('✅ Data synced successfully')
    }
  }

  cloudSyncService.addSyncListener(handleSync)
  
  // Start auto-sync every 60 seconds
  cloudSyncService.startAutoSync(60000)

  return () => {
    cloudSyncService.removeSyncListener(handleSync)
    cloudSyncService.stopAutoSync()
  }
}, [])
```

### Pattern 3: Error Handling
```typescript
try {
  const incidents = await firebaseQueryAPI.getIncidentsNearby(lat, lon, 50)
  console.log(`Found ${incidents.length} nearby incidents`)
} catch (error) {
  console.error('Query failed:', error)
  // Use cached/local data as fallback
}
```

### Pattern 4: Offline-First Approach
```typescript
// Always save locally first
const localIncident = await dbService.createIncident(...)

// Then sync when online
cloudSyncService.addSyncListener((status) => {
  if (status === 'success') {
    // Update UI after cloud sync
  }
})
```

### Pattern 5: Complex Filtering
```typescript
const results = await firebaseQueryAPI.searchIncidents({
  type: 'fire',
  minSeverity: 3,
  userId: currentUserId,
  status: 'synced'
})

// Or use time range
const startTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
const endTime = Date.now()
const weekIncidents = await firebaseQueryAPI.getIncidentsInTimeRange(startTime, endTime)
```

---

## 🔄 Sync Lifecycle

```
┌─────────────────────────────────────────────────┐
│ User Creates Incident                           │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────▼──────────┐
        │ Saved to SQLite   │
        │ status: pending   │
        └────────┬──────────┘
                 │
      ┌──────────▼──────────────┐
      │ Network Connected?      │
      │ (Automatic or Manual)   │
      └──────────┬──────────────┘
                 │
    ┌────────────▼──────────────┐
    │ Push to Firestore         │
    │ status: pending → synced  │
    └───────────────────────────┘
                 │
    ┌────────────▼──────────────┐
    │ Real-time Firestore       │
    │ Available to all users    │
    └───────────────────────────┘
```

---

## 🚨 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Database not initialized` | Async init not complete | Wait for init promise |
| `User not authenticated` | No auth token | Check auth context |
| `No internet connection` | Network unavailable | Retry when online |
| `Sync already in progress` | Overlapping sync calls | Debounce sync calls |
| `Permission denied` | Firebase rules | Check security rules |

### Error Handling Example
```typescript
try {
  const result = await cloudSyncService.syncToCloud()
  if (!result.success) {
    console.warn(`Sync failed: ${result.error}`)
  }
} catch (error) {
  console.error('Unexpected error:', error)
}
```

---

## ⚡ Performance Tips

1. **Batch Operations:** Use `syncIncidents()` for multiple items
2. **Limit Queries:** Use `getRecentIncidents(limit)` instead of `getAllIncidents()`
3. **Index Fields:** Queries on `type`, `severity`, `userId`, `status` are fast
4. **Debounce Sync:** Don't call sync too frequently
5. **Pagination:** For large datasets, implement pagination

### Performance Example
```typescript
// ❌ Bad: Multiple individual queries
for (let id of incidentIds) {
  await firebaseService.getIncident(id)
}

// ✅ Good: Single batch operation
const allIncidents = await firebaseService.getAllIncidents()
const filtered = allIncidents.filter(i => incidentIds.includes(i.id))
```

---

## 🔐 Security

### Always Authenticate
```typescript
// Check user is logged in before sync
const user = await TokenStorage.getUser()
if (!user) {
  console.log('Not authenticated')
  return
}
```

### Data Privacy
- Only synced data visible in Firestore
- Security rules enforce user-level access
- All data encrypted in transit (HTTPS)

---

## 📊 Monitoring

```typescript
// Check sync status
const stats = await cloudSyncService.getSyncStats()
console.log({
  pending: stats.localPending,
  local: stats.localTotal,
  cloud: stats.cloudTotal
})

// Monitor in real-time
cloudSyncService.addSyncListener((status) => {
  console.log(`Sync: ${status}`)
  // Update UI
})
```

---

## 🔗 Related Files

- Configuration: `src/config/firebase.ts`
- Database: `src/database/db.ts`
- Auth: `src/services/authService.ts`
- Examples: `src/services/firebaseExamples.ts`
- Setup Guide: `FIREBASE_DATABASE_SETUP.md`

---

## 📞 Support

For issues:
1. Check error messages in console
2. Verify Firebase config in `src/config/firebase.ts`
3. Check network connectivity
4. Review Firestore rules in Firebase Console
5. Check user authentication status
