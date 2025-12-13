# Firebase Sync - Testing & Troubleshooting

## ✅ Implementation Complete

Your app has been updated to use **Firebase Cloud Sync**!

### What Changed:
1. ✅ **HomeScreen** - Now uses `cloudSyncService` for syncing
2. ✅ **IncidentFormScreen** - Auto-syncs after creating incidents
3. ✅ **appInitializer** - Initializes Firebase on app startup
4. ✅ **firebase.ts** - Fixed duplicate initialization

---

## 🧪 Test Your Sync

### Step 1: Restart Your App
```bash
npm start
```

### Step 2: Check Console for Initialization
You should see:
```
Starting app initialization...
Initializing database...
✓ Database initialized successfully
Initializing Firebase...
🚀 Starting Firebase initialization...
✓ Firebase initialized successfully
✓ App initialized successfully
```

### Step 3: Create an Incident
1. Login to the app
2. Click **"Report Incident"**
3. Fill in the form
4. Click **Save**
5. Check console - Should show sync attempt

### Step 4: Manual Sync Test
1. Go to Home Screen
2. Click **"Sync Now"** button
3. Should show "Synced X incident(s)"

---

## 🔍 Debugging

### If Sync Still Fails

**Check Console Output:**

#### Error: "Network request failed"
✅ **Fix:** Ensure Firestore Database is created in Firebase Console
1. Go to https://console.firebase.google.com
2. Select project: **project-aegis-ce5a8**
3. Click **Firestore Database** (left sidebar)
4. If empty, click **"Create Database"**
5. Choose **Production mode**
6. Select region: **asia-southeast1**
7. Click **Enable**

#### Error: "User not authenticated"
✅ **Fix:** Make sure you're logged in before syncing

#### Error: "Permission denied"
✅ **Fix:** Update Firestore Security Rules
1. Firebase Console → Firestore → Rules tab
2. Replace with:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /incidents/{document=**} {
      allow read, write: if true;  // Temporarily allow all
    }
  }
}
```
3. Click **Publish**

---

## 📱 What Happens When You Sync

```
┌─────────────────────────────────┐
│ Click "Sync Now"                │
└──────────────┬──────────────────┘
               │
    ┌──────────▼─────────────┐
    │ Check Network          │
    │ (Must be online)       │
    └──────────┬─────────────┘
               │
    ┌──────────▼─────────────────┐
    │ Get Pending Incidents      │
    │ (status = 'pending')       │
    └──────────┬─────────────────┘
               │
    ┌──────────▼─────────────────┐
    │ Upload to Firestore        │
    │ (Firebase API call)        │
    └──────────┬─────────────────┘
               │
    ┌──────────▼─────────────────┐
    │ Update Local Status        │
    │ pending → synced           │
    └──────────┬─────────────────┘
               │
    ┌──────────▼─────────────────┐
    │ Show Success Alert         │
    │ "Synced X incident(s)"     │
    └────────────────────────────┘
```

---

## 🎯 Quick Verification

### Test Firebase Connection:
Open React Native console and run:
```typescript
import { firebaseService } from './src/services/firebaseService'

// Test connection
firebaseService.getIncidentCount()
  .then(count => console.log('✅ Firebase OK. Count:', count))
  .catch(err => console.error('❌ Firebase error:', err))
```

### Check Pending Incidents:
```typescript
import { cloudSyncService } from './src/services/cloudSyncService'

cloudSyncService.getPendingCount()
  .then(count => console.log('Pending incidents:', count))
```

### Get Sync Stats:
```typescript
import { cloudSyncService } from './src/services/cloudSyncService'

cloudSyncService.getSyncStats()
  .then(stats => console.log('Stats:', stats))
```

---

## 🚀 Expected Console Output (Success)

When sync works correctly, you'll see:

```
📤 [SYNC] Uploading data to cloud...
Found 3 pending incidents. Syncing to Firebase...
✓ Successfully synced 3 incidents to Firebase
✅ [SYNC] Successfully synced with cloud
```

---

## ❌ Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Network request failed` | Firestore not enabled | Create Firestore DB in Console |
| `PERMISSION_DENIED` | Security rules too strict | Update rules to allow access |
| `auth/invalid-api-key` | Wrong API key | Check firebase.ts config |
| `Sync already in progress` | Multiple sync calls | Wait for current sync to complete |
| `Database not initialized` | Called too early | Wait for app initialization |

---

## 📊 Verify in Firebase Console

After syncing, check your data:

1. Go to **Firebase Console**
2. Select **project-aegis-ce5a8**
3. Click **Firestore Database**
4. Look for **incidents** collection
5. You should see your synced incidents!

Example document:
```
incidents/incident_12345
├── id: "incident_12345"
├── type: "fire"
├── severity: 4
├── latitude: 6.9271
├── longitude: 80.7789
├── timestamp: 1702432800000
├── status: "synced"
├── userId: "1"
├── created_at: 1702432800000
└── updated_at: 1702432800000
```

---

## 🔄 Auto-Sync

Auto-sync runs every 60 seconds automatically.

**To disable:**
```typescript
import { cloudSyncService } from './src/services/cloudSyncService'
cloudSyncService.stopAutoSync()
```

**To change interval:**
```typescript
// Change to 30 seconds
cloudSyncService.startAutoSync(30000)
```

---

## 📱 Testing Offline Mode

1. Turn off WiFi/Mobile Data
2. Create an incident
3. Notice "Pending Sync" status
4. Turn WiFi back on
5. Auto-sync should trigger automatically
6. Status changes to "Synced"

---

## ✅ Checklist

Before reporting issues, verify:

- [ ] Firebase config updated in `src/config/firebase.ts`
- [ ] Firestore Database created in Firebase Console
- [ ] Security rules published
- [ ] App restarted after changes
- [ ] Internet connection available
- [ ] User is logged in
- [ ] Console shows no errors during initialization

---

## 📞 Still Not Working?

Run this debug command in console:

```typescript
import { firebaseInit } from './src/services/firebaseInit'

firebaseInit.getDebugInfo().then(info => {
  console.log('=== DEBUG INFO ===')
  console.log(JSON.stringify(info, null, 2))
})
```

Share the output for further assistance!

---

**Implementation Date:** December 13, 2025
**Status:** ✅ Ready to test
