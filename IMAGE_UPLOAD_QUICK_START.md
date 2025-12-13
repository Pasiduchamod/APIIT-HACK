# 🚀 Image Upload Quick Start

## 5-Minute Setup Guide

### 1. Supabase Setup (2 minutes)

1. Go to https://supabase.com
2. Create new project → Wait for setup
3. **Storage** → **New Bucket** → Name: `incident-images` → **Public**
4. **Settings** → **API** → Copy:
   - Project URL
   - anon/public key

5. Update `src/config/supabase.ts`:
```typescript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 2. Test the Feature (3 minutes)

1. **Start app:**
   ```bash
   npm start
   ```

2. **Capture incident with photo:**
   - Open app → Report Incident
   - Tap "📷 Capture Photo"
   - Take photo
   - Fill severity, wait for GPS
   - Tap "Save Incident"

3. **Verify upload:**
   - Check logs for: "✅ Image uploaded"
   - Open Supabase dashboard → Storage → incident-images
   - See your uploaded image!

### 3. Test Offline Mode

1. **Turn off WiFi/data** → Status shows "Offline"
2. **Capture incident** → Image saved locally
3. **Turn on WiFi** → Watch auto-sync in logs
4. **Check Supabase** → Image uploaded!

---

## Network Strategy Summary

| Network | Action | Image Size | Time |
|---------|--------|------------|------|
| **Offline** | Save locally only | N/A | Instant |
| **2G/3G** | Upload low-quality | ~50KB | ~3-5s |
| **4G/WiFi** | Upload high-quality | ~500KB | ~5-10s |
| **Upgrade** | Replace low → high | ~500KB | ~5-10s |

---

## File Structure

```
src/
├── config/
│   └── supabase.ts          # Supabase credentials
├── services/
│   ├── imageService.ts      # Compression & local storage
│   ├── supabaseStorageService.ts  # Cloud upload
│   └── imageSyncService.ts  # Network-aware sync
├── database/
│   └── db.ts                # SQLite with image fields
└── screens/
    └── IncidentFormScreen.tsx  # Image picker UI
```

---

## Code Examples

### Capture Photo
```typescript
import { imageService } from './services/imageService';

const uri = await imageService.capturePhoto();
// Returns: 'file:///path/to/photo.jpg'
```

### Process & Upload
```typescript
import { imageSyncService } from './services/imageSyncService';

await imageSyncService.processImageForIncident(imageUri, incidentId);
const result = await imageSyncService.syncIncidentImage(incidentId);
// Auto-detects network, uploads appropriate quality
```

### Check Upload Status
```typescript
import { dbService } from './database/db';

const incidents = await dbService.getAllIncidents();
incidents.forEach(i => {
  console.log(i.imageUploadStatus);
  // 'local_only' | 'low_uploaded' | 'high_uploaded'
});
```

---

## Troubleshooting

**Images not uploading?**
- Check Supabase credentials in `supabase.ts`
- Verify `incident-images` bucket exists and is Public
- Check network connection

**Permission errors?**
- Camera: Settings → App → Permissions → Camera
- Gallery: Settings → App → Permissions → Photos

**Large uploads slow?**
- Normal on 3G! Low-quality (~50KB) uploads first
- High-quality uploads when on WiFi

---

## Hackathon Demo Tips

1. **Show offline capture** (impressive!)
2. **Demonstrate auto-sync** (watch logs)
3. **Show Supabase dashboard** (proof it worked)
4. **Explain network strategy** (smart compression)
5. **Highlight production-ready** (retry logic, error handling)

---

## Next Steps

- Read full guide: [IMAGE_UPLOAD_GUIDE.md](./IMAGE_UPLOAD_GUIDE.md)
- Configure Firebase security rules for incident data
- Test on physical device with real networks
- Add analytics to track upload success rates

---

**Ready to go!** 🚀 Your app now handles images like a pro, even in disaster conditions.
