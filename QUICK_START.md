# Quick Start Guide - Running in Expo Go

## Prerequisites

- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on iOS or Android device/emulator

## Setup (Already Done!)

Dependencies are installed. Database is configured. You're ready to go!

## Running the App

### Option 1: Start Expo Server

```bash
cd c:\Users\Nimesh\Downloads\sqlite\APIIT-HACK
npm start
```

**Expected output:**

```
Starting Metro Bundler
...
expo: Waiting on LAN interface...
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ QR Code here █
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄

Scan above QR code with Expo Go
Press 'w' to open web
```

### Option 2: Open in Expo Go

1. Open **Expo Go** app on your phone
2. Scan the QR code from terminal
3. Wait for bundle to load (first time: 1-2 minutes)
4. App opens on your device

## Testing Offline-First Features

### Test 1: Offline Data Creation

1. **Enable Airplane Mode** on your device
2. Tap **"+ Report New Incident"**
3. Fill in the form
4. Tap **"Save Incident"**
5. ✅ Should see: "Saved Locally (Offline)"
6. Close and reopen the app (still offline)
7. ✅ Incident still visible - **Offline persistence works!**

### Test 2: Auto-Sync on Connection

1. Keep the app open in offline mode
2. **Disable Airplane Mode**
3. App should detect connection within 3 seconds
4. You'll see: **"🔄 Syncing data..."** banner
5. After ~2 seconds: Status changes to **"✓ Synced"**
6. ✅ **Auto-sync works!**

### Test 3: Manual Sync

1. Go back online
2. Tap **"🔄 Sync Now"** button
3. If you have pending incidents, they'll sync
4. ✅ Success message appears

### Test 4: Authentication Persistence

1. Login with your credentials
2. Close the app
3. Reopen while **offline**
4. ✅ You're still logged in - **Token cached!**

## Troubleshooting

### Issue: "Metro bundler failed"

**Solution:**

```bash
npm start --clear
```

This clears the cache and rebuilds the bundle.

### Issue: "Cannot find module 'expo-sqlite'"

**Solution:** Restart Expo server and reload:

```bash
npm start
# Then press 'c' in terminal to clear cache
```

### Issue: "Database initialization error"

**Solution:** Check that permissions are granted:

- On Android: Allow "Files" access
- On iOS: Check app sandbox settings

### Issue: Sync not working while online

**Solution:**

1. Check internet connection is active
2. Verify API_BASE_URL in `src/constants/config.ts`
3. Make sure backend server is running

## API Server Configuration

Edit `src/constants/config.ts`:

```typescript
// For local development:
export const API_BASE_URL = "http://localhost:3000/api";

// For testing on device (replace with your IP):
export const API_BASE_URL = "http://192.168.1.100:3000/api";
```

**To find your computer's IP:**

```bash
# Windows
ipconfig | findstr IPv4

# Mac/Linux
ifconfig | grep inet
```

## App Screens

### Login Screen

- Enter username and password
- Token saved to secure storage (expo-secure-store)

### Home Screen

- Shows all incidents created
- **Total Incidents** count
- **Pending Sync** count (incidents waiting to upload)
- **Online/Offline** status badge
- **Sync Now** button for manual sync
- List of all incidents with their status

### Incident Form Screen

- **Incident Type** dropdown (Landslide, Flood, etc.)
- **Severity** slider (1-5)
- **GPS Location** (auto-detected)
- Online/Offline indicator
- Shows "Saved Locally" message when created

## Database Inspection

To check what's in the SQLite database (developer only):

### Using Expo Dev Client Tools

```bash
npm install -D expo-sqlite-inspector
```

Then import and use in your app for debugging.

### Alternative: Using expo-sqlite CLI

```bash
# Coming soon in future Expo versions
```

## Stopping the Server

```bash
# In terminal, press Ctrl+C
```

## Next Steps

1. ✅ Test all offline-first features
2. ✅ Verify sync with your backend
3. ✅ Test user authentication
4. ✅ Build APK when ready: `expo build:android`
5. ✅ Deploy to Play Store or TestFlight

## File Structure

```
src/
├── database/
│   ├── db.ts              # SQLite DatabaseService
│   ├── index.ts           # Exports
│   ├── schema.ts          # (deprecated)
│   └── models/
│       └── Incident.ts    # (deprecated)
├── services/
│   ├── syncService.ts     # Sync orchestration
│   ├── authService.ts     # Auth handling
│   └── tokenStorage.ts    # Secure token caching
├── screens/
│   ├── HomeScreen.tsx     # Main screen
│   ├── IncidentFormScreen.tsx # Create incident
│   └── LoginScreen.tsx    # Authentication
├── contexts/
│   └── AuthContext.tsx    # Auth state management
├── constants/
│   └── config.ts          # Configuration
└── utils/
    └── appInitializer.ts  # DB initialization
```

## Commands Reference

```bash
# Start development server
npm start

# Start with specific platform
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser

# Type checking
npx tsc --noEmit

# Clean build
npm start --clear
```

## Support

For issues or questions:

1. Check the `REFACTORING_COMPLETE.md` file for detailed documentation
2. Review error logs in Expo terminal
3. Check database status with sync listener logs

---

**Happy testing!** 🚀
