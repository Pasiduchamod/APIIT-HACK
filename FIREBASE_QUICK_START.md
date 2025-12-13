# Firebase Implementation - Quick Start Guide

## 🚀 5-Minute Quick Start

### Step 1: Install Firebase (Already Done ✅)
```bash
npm install firebase
```

### Step 2: Get Firebase Config
1. Go to https://console.firebase.google.com
2. Create new project named "Project Aegis"
3. Click Project Settings (gear icon)
4. Copy web config

### Step 3: Update Config File

**File:** `src/config/firebase.ts`

Replace the placeholder config with your Firebase config:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",           // From Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### Step 4: Initialize in App

**File:** `App.tsx` or `src/utils/appInitializer.ts`

```typescript
import { useEffect } from 'react'
import { initializeFirebase } from './services/firebaseInit'

export default function App() {
  useEffect(() => {
    initializeFirebase()
  }, [])

  // Rest of app...
}
```

### Step 5: Deploy Security Rules

In Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /incidents/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish** ✅

### Done! 🎉

Your app now has:
- ✅ Cloud database (Firestore)
- ✅ Automatic sync with local SQLite
- ✅ Real-time updates
- ✅ Offline-first support

---

## 📱 Using the Firebase Services

### Create & Sync Incident

```typescript
import { dbService } from './database/db'
import { cloudSyncService } from './services/cloudSyncService'

// Create locally (instant)
const incident = await dbService.createIncident({
  id: 'incident_123',
  type: 'fire',
  severity: 4,
  latitude: 6.9271,
  longitude: 80.7789,
  timestamp: Date.now(),
  status: 'pending'
})

// Sync to cloud (when online)
const result = await cloudSyncService.syncToCloud()
console.log(`✅ Synced ${result.synced} incidents`)
```

### Get Incidents

```typescript
import { firebaseService } from './services/firebaseService'

// Get all
const all = await firebaseService.getAllIncidents()

// Get by type
const fires = await firebaseService.getIncidentsByType('fire')

// Get by severity
const critical = await firebaseService.getIncidentsBySeverity(5)
```

### Advanced Queries

```typescript
import { firebaseQueryAPI } from './services/firebaseQueryAPI'

// Nearby incidents
const nearby = await firebaseQueryAPI.getIncidentsNearby(6.9271, 80.7789, 50)

// High severity
const urgent = await firebaseQueryAPI.getHighSeverityIncidents(4)

// Recent incidents
const recent = await firebaseQueryAPI.getRecentIncidents(20)

// Statistics
const stats = await firebaseQueryAPI.getIncidentStats()
console.log('Total:', stats.total)
console.log('By severity:', stats.bySeverity)
console.log('By type:', stats.byType)
```

---

## 🔄 Auto-Sync Configuration

Auto-sync starts automatically and syncs every 60 seconds.

### Listen to Sync Events

```typescript
import { cloudSyncService } from './services/cloudSyncService'

cloudSyncService.addSyncListener((status) => {
  if (status === 'syncing') console.log('📤 Uploading...')
  if (status === 'success') console.log('✅ Synced!')
  if (status === 'offline') console.log('📵 Offline')
})
```

### Manual Sync Trigger

```typescript
import { cloudSyncService } from './services/cloudSyncService'

// Manual sync
await cloudSyncService.syncToCloud()

// Full bi-directional sync
await cloudSyncService.fullSync()

// Stop auto-sync
cloudSyncService.stopAutoSync()
```

---

## 📊 Database Tables

### Incidents Collection (Firestore Cloud)

```
Collection: incidents
├── id (string) - Unique ID
├── type (string) - fire, flood, earthquake, etc.
├── severity (number) - 1-5
├── latitude (number) - GPS
├── longitude (number) - GPS
├── timestamp (number) - When it happened
├── status (string) - pending, synced, failed
├── userId (string) - Who reported
├── created_at (number) - Created time
├── updated_at (number) - Last update
├── description (string) - Details [OPTIONAL]
└── imageUrl (string) - Image link [OPTIONAL]
```

---

## 🔍 Check Sync Status

```typescript
import { cloudSyncService } from './services/cloudSyncService'

const stats = await cloudSyncService.getSyncStats()

console.log('Local pending:', stats.localPending)  // Items waiting to sync
console.log('Local total:', stats.localTotal)      // Total local items
console.log('Cloud total:', stats.cloudTotal)      // Total in Firestore
```

---

## 🐛 Troubleshooting

### Error: "Firebase not initialized"
**Solution:** Call `initializeFirebase()` in App.tsx useEffect

### Error: "User not authenticated"
**Solution:** Ensure user is logged in before syncing

### Error: "No internet connection"
**Solution:** App works offline. Will sync when online.

### Error: "Permission denied"
**Solution:** Check Firestore security rules in Firebase Console

### Firebase not connecting?
**Debug:**
```typescript
import { firebaseService } from './services/firebaseService'

try {
  const count = await firebaseService.getIncidentCount()
  console.log('✅ Firebase OK:', count)
} catch (error) {
  console.error('❌ Firebase error:', error)
}
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `FIREBASE_DATABASE_SETUP.md` | Complete setup guide (500+ lines) |
| `FIREBASE_API_REFERENCE.md` | API documentation (400+ lines) |
| `FIREBASE_SETUP_GUIDE.md` | Configuration steps (600+ lines) |
| `FIREBASE_CLOUD_DATABASE_SUMMARY.md` | Summary with tables |
| `src/services/firebaseExamples.ts` | 15 code examples |

---

## 🗄️ Database Migration (If needed)

Migrate all local incidents to Firestore:

```typescript
import { dbService } from './database/db'
import { firebaseService } from './services/firebaseService'
import { TokenStorage } from './services/tokenStorage'

async function migrateAllData() {
  const localIncidents = await dbService.getAllIncidents()
  const user = await TokenStorage.getUser()
  
  if (user) {
    const result = await firebaseService.syncIncidents(
      localIncidents,
      user.id.toString()
    )
    console.log(`✅ Migrated ${result.success} incidents`)
  }
}

// Call once
await migrateAllData()
```

---

## ✅ Verify Setup is Working

```typescript
import { firebaseInit } from './services/firebaseInit'

// Check everything
const debugInfo = await firebaseInit.getDebugInfo()
console.log(debugInfo)

// Should output something like:
{
  timestamp: "2024-12-13T...",
  user: { id: "user_123", username: "demo" },
  database: {
    localPending: 0,
    localTotal: 5,
    cloudTotal: 5
  },
  services: {
    autoSyncEnabled: true
  }
}
```

---

## 🎯 Common Tasks

### Task 1: Display All Incidents on Map
```typescript
const incidents = await firebaseService.getAllIncidents()
// Plot on map with latitude/longitude
```

### Task 2: Show Critical Alerts
```typescript
const critical = await firebaseQueryAPI.getHighSeverityIncidents(4)
// Display alert notification
```

### Task 3: Find Incidents Near User
```typescript
const nearby = await firebaseQueryAPI.getIncidentsNearby(
  userLat, 
  userLon, 
  50 // 50km
)
// Show nearby on map
```

### Task 4: Get Daily Report
```typescript
const today = new Date().setHours(0, 0, 0, 0)
const tomorrow = new Date().setHours(23, 59, 59, 999)
const todayIncidents = await firebaseQueryAPI.getIncidentsInTimeRange(
  today,
  tomorrow
)
// Generate report
```

### Task 5: Monitor Sync Status
```typescript
const stats = await cloudSyncService.getSyncStats()
if (stats.localPending > 0) {
  console.log(`⚠️ ${stats.localPending} items waiting to sync`)
}
```

---

## 🚀 Next Steps

1. ✅ Get Firebase config from Firebase Console
2. ✅ Update `src/config/firebase.ts`
3. ✅ Deploy Firestore security rules
4. ✅ Initialize in App.tsx
5. ✅ Test with `firebaseInit.getDebugInfo()`
6. ✅ Read documentation files
7. ✅ Use services in your components
8. ✅ Deploy to production

---

## 💰 Costs (Estimates)

Free tier includes:
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day
- 1 GB storage

After free tier:
- Reads: $0.06 per 100K
- Writes: $0.18 per 100K
- Storage: $0.18/GB/month

For 1000 incidents:
- Monthly cost: < $0.10

---

## 📞 Need Help?

1. **Check Docs:** Read `FIREBASE_API_REFERENCE.md`
2. **See Examples:** Look at `src/services/firebaseExamples.ts`
3. **Debug:** Use `firebaseInit.getDebugInfo()`
4. **Firebase Help:** Visit [firebase.google.com/docs](https://firebase.google.com/docs)

---

## ✨ Key Features Implemented

- ✅ Cloud database (Firestore)
- ✅ Real-time sync
- ✅ Offline support
- ✅ Auto-sync with network detection
- ✅ 31 API methods
- ✅ Advanced queries (geo, severity, time range, etc.)
- ✅ Analytics & statistics
- ✅ Type-safe TypeScript
- ✅ Error handling
- ✅ Comprehensive documentation

**Everything is ready to use!** 🎉

