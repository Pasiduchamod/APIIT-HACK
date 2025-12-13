# Firebase Configuration & Setup Guide

## Step-by-Step Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Create a new project**
3. Project name: `Project Aegis` (or your preference)
4. Disable Google Analytics (optional)
5. Click **Create project**

### Step 2: Enable Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create database**
3. Start in **Production mode** (later update security rules)
4. Choose region: **asia-southeast1** (closest to Sri Lanka)
5. Click **Enable**

### Step 3: Enable Authentication

1. Go to **Build** → **Authentication**
2. Click **Get started**
3. Click **Email/Password**
4. Enable **Email/Password** and **Anonymous**
5. Save

### Step 4: Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Select your platform (web/iOS/Android)
3. Copy configuration
4. Download `google-services.json` (for Android)
5. Copy the config to your app

### Step 5: Update Firebase Config in App

**File:** `src/config/firebase.ts`

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

Replace with actual values from Firebase Console.

### Step 6: Deploy Firestore Security Rules

1. In Firebase Console, go to **Firestore Database** → **Rules**
2. Replace default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default: deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Incidents collection: Only authenticated users
    match /incidents/{document=**} {
      // Allow read/write to authenticated users
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      request.resource.data.userId == request.auth.uid;
      
      // Optional: Allow admins to read all
      allow read: if request.auth.token.admin == true;
    }
  }
}
```

3. Click **Publish**

### Step 7: Initialize in Your App

**File:** `src/utils/appInitializer.ts` or `App.tsx`

```typescript
import { initializeFirebaseSync } from './services/firebaseExamples'

async function initializeApp() {
  try {
    // ... other initialization code ...
    
    // Initialize Firebase sync
    await initializeFirebaseSync()
    
    console.log('✅ App initialized successfully')
  } catch (error) {
    console.error('❌ Initialization error:', error)
  }
}

// Call in App.tsx useEffect
useEffect(() => {
  initializeApp()
}, [])
```

### Step 8: Test the Setup

```typescript
import { firebaseService } from './services/firebaseService'

async function testFirebase() {
  try {
    const count = await firebaseService.getIncidentCount()
    console.log(`✅ Firebase connected! Total incidents: ${count}`)
  } catch (error) {
    console.error('❌ Firebase error:', error)
  }
}
```

---

## Environment Variables Setup

### Option 1: Using .env file

Create `.env.local`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_ID
EXPO_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
```

Update `src/config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}
```

### Option 2: Using Firebase Local Emulator (Development)

For local testing without cloud:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Start emulator
firebase emulators:start
```

Update `src/config/firebase.ts`:

```typescript
import { connectFirestoreEmulator } from 'firebase/firestore'
import { connectAuthEmulator } from 'firebase/auth'

// ... initialize app ...

if (__DEV__) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
  } catch (error) {
    // Emulator already connected
  }
}
```

---

## Collection Structure

### incidents Collection

```
collection('incidents')
  ├── incident_uuid_1
  │   ├── id: "incident_uuid_1"
  │   ├── type: "fire"
  │   ├── severity: 5
  │   ├── latitude: 6.9271
  │   ├── longitude: 80.7789
  │   ├── timestamp: 1702432800000
  │   ├── status: "synced"
  │   ├── userId: "user_123"
  │   ├── created_at: 1702432800000
  │   ├── updated_at: 1702432800000
  │   ├── description: "Fire at building XYZ"
  │   └── imageUrl: "gs://bucket/image.jpg"
  │
  ├── incident_uuid_2
  │   └── ...
  │
  └── incident_uuid_n
      └── ...
```

---

## Firestore Indexes

For optimal query performance, create these indexes:

### Index 1: Type & Severity
```
Collection: incidents
Fields:
  - type (Ascending)
  - severity (Descending)
```

### Index 2: User & Status
```
Collection: incidents
Fields:
  - userId (Ascending)
  - status (Ascending)
```

### Index 3: Timestamp & Severity
```
Collection: incidents
Fields:
  - timestamp (Descending)
  - severity (Descending)
```

Firestore will suggest indexes automatically when you run queries that need them.

---

## Sync Configuration

### Auto-Sync Settings

**File:** `src/utils/appInitializer.ts`

```typescript
import { cloudSyncService } from '../services/cloudSyncService'

// Start auto-sync every 60 seconds
cloudSyncService.startAutoSync(60000)

// Listen to sync events
cloudSyncService.addSyncListener((status) => {
  console.log('Sync status:', status)
  
  switch(status) {
    case 'syncing':
      console.log('📤 Uploading incidents...')
      break
    case 'downloading':
      console.log('📥 Downloading incidents...')
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
```

### Disable Auto-Sync (Optional)

```typescript
// For low-power mode
cloudSyncService.stopAutoSync()

// Or disable in settings
if (lowBatteryMode) {
  cloudSyncService.stopAutoSync()
}
```

---

## Storage Setup (Optional)

For incident images/media:

### 1. Enable Cloud Storage

In Firebase Console:
1. Go to **Build** → **Storage**
2. Click **Get started**
3. Start in **Production mode**
4. Choose region: **asia-southeast1**
5. Click **Done**

### 2. Update Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Deny all by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
    
    // Allow authenticated users to upload to their folder
    match /incidents/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

### 3. Use in App

```typescript
import { getStorage, ref, uploadBytes } from 'firebase/storage'

const storage = getStorage()
const fileName = `incidents/${userId}/${Date.now()}.jpg`
const fileRef = ref(storage, fileName)

// Upload image
await uploadBytes(fileRef, imageBlob)
```

---

## Data Migration

### Migrate from Local DB to Firestore

```typescript
import { dbService } from './database/db'
import { firebaseService } from './services/firebaseService'
import { TokenStorage } from './services/tokenStorage'

async function migrateData() {
  try {
    // Get all local incidents
    const localIncidents = await dbService.getAllIncidents()
    
    // Get current user
    const user = await TokenStorage.getUser()
    if (!user) throw new Error('User not authenticated')
    
    // Sync to Firebase
    const result = await firebaseService.syncIncidents(localIncidents, user.id.toString())
    
    console.log(`✅ Migrated ${result.success} incidents`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}
```

---

## Backup & Restore

### Backup Incidents

```typescript
import { firebaseService } from './services/firebaseService'

async function backupToJSON() {
  try {
    const incidents = await firebaseService.getAllIncidents()
    const backup = {
      timestamp: new Date().toISOString(),
      count: incidents.length,
      incidents
    }
    
    // Save as JSON file
    return JSON.stringify(backup, null, 2)
  } catch (error) {
    console.error('Backup failed:', error)
  }
}
```

---

## Monitoring & Analytics

### Check Database Size

In Firebase Console:
1. Go to **Firestore Database**
2. Check **Storage** tab
3. View data usage breakdown

### Monitor Sync

```typescript
const stats = await cloudSyncService.getSyncStats()

console.log('Local pending:', stats.localPending)
console.log('Local total:', stats.localTotal)
console.log('Cloud total:', stats.cloudTotal)

// Alert if too many pending
if (stats.localPending > 100) {
  console.warn('⚠️ Too many pending items!')
}
```

---

## Troubleshooting

### Issue: "Firebase not initialized"
**Solution:**
```typescript
import { firebaseApp } from './config/firebase'
// Check if firebaseApp is imported before using services
```

### Issue: "Permission denied"
**Check:**
1. User is authenticated
2. Firebase rules allow the operation
3. Document exists

### Issue: "Network timeout"
**Solutions:**
- Check internet connection
- Check Firebase region is closest to user
- Increase timeout in Firestore settings

### Issue: "App crashes on Firebase operation"
**Debug:**
```typescript
try {
  const result = await firebaseService.getIncidentCount()
  console.log('Firebase working:', result)
} catch (error) {
  console.error('Firebase error:', error)
}
```

---

## Production Checklist

- [ ] Firebase config has production API keys
- [ ] Security rules are restrictive (not `allow read, write: if true`)
- [ ] Firestore indexes created for all queries
- [ ] Backup procedures documented
- [ ] Auto-sync interval optimized for battery
- [ ] Error handling implemented
- [ ] User authentication enforced
- [ ] Data privacy compliant
- [ ] Monitoring/logging configured
- [ ] Tested on actual device/network

---

## Cost Optimization

### Firestore Pricing (as of 2024)

- **Reads:** $0.06 per 100,000
- **Writes:** $0.18 per 100,000
- **Deletes:** $0.02 per 100,000
- **Storage:** $0.18 per GB/month

### Optimization Tips

1. **Batch operations:** Reduce number of writes
2. **Query limits:** Only fetch needed data
3. **Offline support:** Minimize unnecessary syncs
4. **TTL:** Set data expiration policies
5. **Archive:** Move old data to Cloud Storage

---

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Security Rules Guide](https://firebase.google.com/docs/firestore/security/start)
- [Pricing Calculator](https://firebase.google.com/pricing)
- [Console](https://console.firebase.google.com)
