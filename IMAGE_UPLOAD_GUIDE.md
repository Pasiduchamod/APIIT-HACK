# 📸 Offline-First Image Upload System
## Complete Implementation Guide for Disaster Response App

---

## 🎯 Overview

This system implements **production-ready, offline-first image upload** for disaster incident reporting with:

- **Local-first storage**: Images saved immediately, even offline
- **Network-aware compression**: Low quality (~50KB) for slow networks, high quality (~500KB-1MB) for fast networks
- **Automatic upgrades**: Replace low-quality with high-quality when network improves
- **Safe for poor networks**: Retry logic, exponential backoff, no data loss
- **SQLite state tracking**: `local_only` → `low_uploaded` → `high_uploaded`

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture)
2. [SQLite Schema](#sqlite-schema)
3. [Setup Instructions](#setup-instructions)
4. [Usage Examples](#usage-examples)
5. [Network Strategy](#network-strategy)
6. [Hackathon Demo Script](#hackathon-demo)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                         │
│  (Capture Photo / Pick from Gallery / Report Incident)     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              INCIDENT FORM SCREEN                           │
│  • Image Picker UI                                          │
│  • Image Preview                                            │
│  • Save Incident Button                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              IMAGE SYNC SERVICE                             │
│  • processImageForIncident() - Save locally                 │
│  • syncIncidentImage() - Upload based on network            │
│  • Network quality detection (offline/poor/good/excellent)  │
└───┬─────────────────────────────┬───────────────────────────┘
    │                             │
    ▼                             ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│   IMAGE SERVICE      │    │  SUPABASE STORAGE SERVICE       │
│  • Compression       │    │  • Upload to cloud              │
│  • Local storage     │    │  • Replace low with high        │
│  • Quality control   │    │  • Delete old images            │
└──────────────────────┘    └─────────────────────────────────┘
    │                             │
    ▼                             ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│  LOCAL FILE SYSTEM   │    │      SUPABASE STORAGE           │
│  • Original image    │    │  • Low-quality (~50KB)          │
│  • Low quality       │    │  • High-quality (~500KB-1MB)    │
│  • High quality      │    │  • Public URLs                  │
└──────────────────────┘    └─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                  SQLITE DATABASE                            │
│  • localImageUri                                            │
│  • cloudImageUrl                                            │
│  • imageUploadStatus (local_only/low_uploaded/high_uploaded)│
│  • imageQuality (none/low/high)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 SQLite Schema

### Updated `incidents` Table

```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  -- IMAGE FIELDS
  localImageUri TEXT,              -- Local file path (e.g., file:///...incident-images/uuid_original.jpg)
  cloudImageUrl TEXT,              -- Supabase public URL (e.g., https://xyz.supabase.co/storage/...)
  imageUploadStatus TEXT DEFAULT 'local_only',  -- 'local_only', 'low_uploaded', 'high_uploaded'
  imageQuality TEXT DEFAULT 'none'              -- 'none', 'low', 'high'
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_image_status ON incidents(imageUploadStatus);
```

### TypeScript Interface

```typescript
export interface Incident {
  id: string;
  type: string;
  severity: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
  created_at: number;
  updated_at: number;
  
  // Image fields
  localImageUri?: string;
  cloudImageUrl?: string;
  imageUploadStatus?: 'local_only' | 'low_uploaded' | 'high_uploaded';
  imageQuality?: 'none' | 'low' | 'high';
}
```

---

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js expo-file-system expo-image-manipulator expo-image-picker
```

### 2. Configure Supabase

**Step 1:** Create Supabase project at https://supabase.com

**Step 2:** Create Storage Bucket
- Go to Storage in Supabase dashboard
- Create bucket named `incident-images`
- Set to **Public** or configure RLS policies

**Step 3:** Update Configuration

Edit `src/config/supabase.ts`:

```typescript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 3. Database Migration

The schema updates are applied automatically on app initialization. If you have existing data:

```typescript
// Add image columns to existing database
await db.execAsync(`
  ALTER TABLE incidents ADD COLUMN localImageUri TEXT;
  ALTER TABLE incidents ADD COLUMN cloudImageUrl TEXT;
  ALTER TABLE incidents ADD COLUMN imageUploadStatus TEXT DEFAULT 'local_only';
  ALTER TABLE incidents ADD COLUMN imageQuality TEXT DEFAULT 'none';
`);
```

### 4. Enable Auto-Sync (Optional)

Add to `src/utils/appInitializer.ts`:

```typescript
import { imageSyncService } from '../services/imageSyncService';

export async function initializeApp() {
  // ... existing initialization ...
  
  // Start automatic image sync
  imageSyncService.startAutoSync();
}
```

---

## 💻 Usage Examples

### 1. Capture and Save Image with Incident

```typescript
import { imageSyncService } from '../services/imageSyncService';
import { imageService } from '../services/imageService';
import { dbService } from '../database/db';

// Capture photo
const imageUri = await imageService.capturePhoto();

// Create incident
const incidentId = uuidv4();
await dbService.createIncident({
  id: incidentId,
  type: 'Earthquake',
  severity: 4,
  latitude: 37.7749,
  longitude: -122.4194,
  timestamp: Date.now(),
  status: 'pending',
});

// Process image (saves locally and updates database)
await imageSyncService.processImageForIncident(imageUri, incidentId);

// Try to upload immediately if online
const result = await imageSyncService.syncIncidentImage(incidentId);
console.log('Upload result:', result);
```

### 2. Manual Sync All Pending Images

```typescript
import { imageSyncService } from '../services/imageSyncService';

const results = await imageSyncService.syncAllPendingImages();

results.forEach(result => {
  console.log(`Incident ${result.incidentId}:`, result.action);
  // Actions: 'uploaded_low', 'uploaded_high', 'upgraded_to_high', 'skipped', 'failed'
});
```

### 3. Check Sync Status

```typescript
import { dbService } from '../database/db';

// Get all incidents with pending images
const pendingImages = await dbService.getIncidentsWithPendingImages();
console.log(`${pendingImages.length} images waiting to upload`);

// Check specific incident
const incidents = await dbService.getAllIncidents();
const incident = incidents.find(i => i.id === 'some-id');
console.log('Image status:', incident?.imageUploadStatus);
console.log('Image quality:', incident?.imageQuality);
```

### 4. Compress Image Manually

```typescript
import { imageService } from '../services/imageService';

// Low quality for slow networks (~50KB)
const lowQuality = await imageService.compressToLowQuality(originalUri);
console.log('Size:', (lowQuality.size / 1024).toFixed(2), 'KB');

// High quality for good networks (~500KB)
const highQuality = await imageService.compressToHighQuality(originalUri);
console.log('Size:', (highQuality.size / 1024).toFixed(2), 'KB');
```

---

## 📡 Network Strategy

### Network Quality Detection

```typescript
// Automatically detected by ImageSyncService
- offline: No internet connection
- poor: 2G, 3G cellular
- good: 4G, 5G cellular
- excellent: WiFi, Ethernet
```

### Upload Decision Tree

```
┌─────────────────────────────────────┐
│  Check imageUploadStatus            │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌──────────────┐
       │ local_only?  │
       └──┬───────┬───┘
          │       │
     YES  │       │  NO
          ▼       ▼
    ┌─────────┐  ┌────────────────┐
    │ Check   │  │ low_uploaded?  │
    │ Network │  └──┬─────────┬───┘
    └────┬────┘     │         │
         │     YES  │         │  NO
         ▼          ▼         ▼
    ┌─────────┐  ┌──────┐  ┌──────────┐
    │ Poor?   │  │Check │  │ SKIP     │
    │         │  │Net   │  │(Already  │
    └─┬───┬───┘  └──┬───┘  │uploaded) │
      │   │         │      └──────────┘
   YES│   │NO    GOOD│
      ▼   ▼         ▼
  ┌────┐ ┌─────┐ ┌───────────┐
  │Low │ │High │ │Upgrade to │
  │    │ │     │ │High       │
  └────┘ └─────┘ └───────────┘
```

### Compression Settings

| Quality | Resolution | JPEG Quality | Target Size | Use Case |
|---------|-----------|--------------|-------------|----------|
| **Low** | 480px width | 30% | ~50KB | 2G/3G networks |
| **High** | 1920px width | 80% | ~500KB-1MB | 4G/WiFi |
| **Original** | Native | 100% | Varies | Local storage only |

---

## 🎤 Hackathon Demo Script

### Setup

1. **Show Offline Mode**
   - Turn off WiFi and mobile data
   - Open app → "Offline" badge visible
   - Navigate to Report Incident

2. **Capture Incident with Photo**
   - Tap "Capture Photo" button
   - Take photo of mock disaster (e.g., overturned chair)
   - Photo appears in preview
   - Select severity, ensure GPS locked
   - Tap "Save Incident"

3. **Verify Local Storage**
   - Show success message
   - Navigate back to home screen
   - Incident appears in list (still offline)
   - Explain: "Image saved locally in SQLite database"

4. **Demonstrate Sync Strategy**
   
   **Slow Network (2G/3G):**
   - Enable mobile data (or simulate with 3G)
   - Status changes to "Online"
   - Watch logs: "📤 Uploading low-quality image (slow network)..."
   - Explain: "Compressed to ~50KB for poor connection"
   - Show database: `imageUploadStatus = 'low_uploaded'`

5. **Network Upgrade**
   - Connect to WiFi
   - Watch logs: "🔄 Upgrading to high-quality image..."
   - Explain: "Automatically replaces low-quality with high-quality (~500KB)"
   - Show database: `imageUploadStatus = 'high_uploaded'`
   - Show Supabase dashboard: High-quality image visible

6. **Show Cloud Storage**
   - Open Supabase dashboard
   - Navigate to Storage → incident-images bucket
   - Show uploaded image with filename format: `{incidentId}_high_{timestamp}.jpg`
   - Copy public URL
   - Open in browser → Full resolution image

### Key Talking Points

**Problem Statement:**
> "Disaster responders work in areas with poor or no internet. Traditional apps fail offline or can't upload media. Our solution ensures incidents with photos are ALWAYS captured, even without connectivity."

**Technical Highlights:**
> "We use SQLite for offline-first data persistence, expo-image-manipulator for client-side compression, and Supabase Storage for cloud hosting. The app intelligently compresses images based on real-time network quality detection."

**Resilience:**
> "If upload fails, images stay in queue. When network improves, automatic retry with exponential backoff ensures eventual consistency. No data is ever lost."

**Production-Ready:**
> "This isn't a prototype. It includes proper error handling, retry logic, state management, and follows mobile app best practices. It's ready for real disaster scenarios."

---

## 🔧 Troubleshooting

### Issue: Images Not Uploading

**Check:**
1. Supabase configured? Run:
   ```typescript
   import { isSupabaseConfigured } from '../config/supabase';
   console.log('Configured:', isSupabaseConfigured());
   ```

2. Storage bucket exists?
   - Go to Supabase dashboard → Storage
   - Verify `incident-images` bucket exists
   - Check bucket is Public or RLS allows access

3. Network connection?
   ```typescript
   import NetInfo from '@react-native-community/netinfo';
   const state = await NetInfo.fetch();
   console.log('Connected:', state.isConnected);
   ```

### Issue: Permission Denied

**Camera Permission:**
```typescript
import * as ImagePicker from 'expo-image-picker';
const { status } = await ImagePicker.requestCameraPermissionsAsync();
console.log('Camera permission:', status);
```

**Add to app.json:**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to capture disaster photos.",
          "cameraPermission": "Allow $(PRODUCT_NAME) to take disaster photos."
        }
      ]
    ]
  }
}
```

### Issue: Large Image Sizes

**Adjust compression settings in `imageService.ts`:**

```typescript
// Lower quality for slower networks
const manipulatedImage = await ImageManipulator.manipulateAsync(
  uri,
  [{ resize: { width: 320 } }],  // Even smaller
  { compress: 0.2 }              // Lower quality
);
```

### Issue: Auto-Sync Not Working

**Check if enabled:**
```typescript
import { imageSyncService } from '../services/imageSyncService';

// Start manually
imageSyncService.startAutoSync();

// Check status
console.log('Syncing:', imageSyncService.isSyncing());
```

**Debug network listener:**
```typescript
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  console.log('Network changed:', state.type, state.isConnected);
});
```

---

## 📱 Testing Checklist

### Offline Mode
- [ ] Capture photo offline
- [ ] Save incident offline
- [ ] Image saved to local file system
- [ ] Database shows `local_only` status
- [ ] Incident appears in list

### Slow Network (2G/3G)
- [ ] Upload triggers automatically
- [ ] Low-quality image uploaded (~50KB)
- [ ] Database shows `low_uploaded` status
- [ ] Supabase shows low-quality image

### Fast Network (WiFi)
- [ ] New incidents upload high-quality directly
- [ ] Existing low-quality images upgraded
- [ ] Database shows `high_uploaded` status
- [ ] Supabase shows high-quality image
- [ ] Old low-quality image deleted

### Error Handling
- [ ] Retry on network failure
- [ ] Exponential backoff works
- [ ] User sees meaningful errors
- [ ] No crashes on permission denial
- [ ] Graceful degradation (incident saved even if image fails)

---

## 🎯 Key Metrics for Demo

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Low-quality size** | < 60KB | Check file in FileSystem |
| **High-quality size** | 400-800KB | Check file in FileSystem |
| **Compression time** | < 2 seconds | Time `compressToLowQuality()` |
| **Upload time (low)** | < 5 seconds on 3G | Time `uploadImage()` |
| **Upload time (high)** | < 10 seconds on WiFi | Time `uploadImage()` |

---

## 🚀 Production Deployment Checklist

- [ ] Configure Supabase credentials
- [ ] Create `incident-images` bucket
- [ ] Set up RLS policies (if not public)
- [ ] Test on physical device (not emulator)
- [ ] Test on actual 2G/3G/4G networks
- [ ] Test in airplane mode
- [ ] Add analytics for upload success rate
- [ ] Monitor Supabase storage usage
- [ ] Set up automated backups
- [ ] Document API for backend team

---

## 📚 API Reference

See dedicated files for detailed API documentation:
- **[ImageService API](./src/services/imageService.ts)** - Compression & local storage
- **[SupabaseStorageService API](./src/services/supabaseStorageService.ts)** - Cloud uploads
- **[ImageSyncService API](./src/services/imageSyncService.ts)** - Network-aware orchestration
- **[Database Methods](./src/database/db.ts)** - SQLite operations

---

## 🎓 Learning Resources

- [Expo Image Picker Docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Expo Image Manipulator Docs](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Offline-First Architecture](https://www.smashingmagazine.com/2016/02/making-a-service-worker/)

---

## ✨ Credits

Built with ❤️ for disaster response teams who need reliable tools in unreliable conditions.

**Tech Stack:**
- React Native (Expo)
- TypeScript
- SQLite (expo-sqlite)
- Supabase Storage
- Firebase Firestore (for incident data sync)
- NetInfo (network detection)

---

**Last Updated:** December 13, 2025  
**Version:** 1.0.0  
**License:** MIT
