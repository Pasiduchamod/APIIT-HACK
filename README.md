# LankaSafe Mobile App

Offline-First disaster management mobile application built with React Native (Expo), SQLite, and Firebase.

## 📱 Download APK

**[Download LankaSafe APK](https://expo.dev/accounts/nimesh26/projects/lankasafe/builds/87a78d62-43a4-427a-9881-1f1ad578c3ea)**

## Screenshots

<p align="center">
  <img src="https://res.cloudinary.com/dnfbik3if/image/upload/v1765684065/WhatsApp_Image_2025-12-14_at_09.14.57_8de67534_z2pmnz.jpg" width="200" alt="Screenshot 1"/>
  <img src="https://res.cloudinary.com/dnfbik3if/image/upload/v1765684065/WhatsApp_Image_2025-12-14_at_09.14.57_facc0873_hytsii.jpg" width="200" alt="Screenshot 2"/>
  <img src="https://res.cloudinary.com/dnfbik3if/image/upload/v1765684065/WhatsApp_Image_2025-12-14_at_09.14.57_38b4959f_e4efhd.jpg" width="200" alt="Screenshot 3"/>
  <img src="https://res.cloudinary.com/dnfbik3if/image/upload/v1765684065/WhatsApp_Image_2025-12-14_at_09.14.57_3d8dcdf2_hmcdhw.jpg" width="200" alt="Screenshot 4"/>
</p>

## Features

✅ **Offline-First Architecture** - Works completely offline with local SQLite data persistence  
✅ **Firebase Authentication** - Secure email/password authentication with Firebase Auth  
✅ **SQLite Database** - Local database using expo-sqlite for offline data storage  
✅ **Automatic Sync** - Syncs data automatically when internet connection is restored  
✅ **GPS Location Capture** - Auto-captures coordinates using expo-location  
✅ **Image Upload** - Multi-image support with Firebase Storage integration  
✅ **Real-time Network Status** - Shows online/offline status with NetInfo  
✅ **Persistent Sessions** - User stays logged in even when offline  
✅ **Multi-Module Support** - Incidents, Aid Requests, Detention Camps, and Volunteer Management

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Email/Password authentication
3. Enable Firestore Database
4. Enable Firebase Storage
5. Add your Firebase configuration to `src/config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

See `FIREBASE_SETUP_FIX.md` for detailed Firebase setup instructions.

### 3. Configure Backend URL (Optional)

If you have a backend server, edit `src/constants/config.ts`:

```typescript
// For emulator/simulator (localhost)
export const API_BASE_URL = "http://localhost:3000/api";

// For physical device (use your computer's IP)
export const API_BASE_URL = "http://192.168.1.100:3000/api";
```

To find your IP address:

- **Windows**: `ipconfig` (look for IPv4 Address)
- **Mac/Linux**: `ifconfig` (look for inet address)

### 4. Start the App

```bash
# Start Expo development server
npm start

# Or directly on Android
npm run android

# Or directly on iOS
npm run ios
```

### 5. Test on Physical Device

1. Install **Expo Go** app from App Store or Google Play
2. Scan the QR code shown in terminal
3. Make sure your phone is on the same WiFi network as your computer

## Testing the "Airplane Mode Test"

### Step 1: Register/Login (Online)

1. Open the app
2. Register a new account or login with existing credentials
3. Email verification is sent via Firebase Auth
4. You should see the Home screen

### Step 2: Go Offline

1. Enable Airplane Mode on your device
2. Notice the status badge changes to "● Offline" (red)
3. App remains functional

### Step 3: Report Incident (Offline)

1. Tap "+ Report New Incident"
2. Select incident type (Landslide, Flood, etc.)
3. Choose severity (1-5)
4. Wait for GPS location to load
5. Optionally add images (stored locally)
6. Tap "Save Incident"
7. You'll see: "Saved Locally (Offline)" message
8. Incident appears in the list with "⏳ Pending Sync" badge

### Step 4: Close and Re-open App (Offline)

1. Close the app completely (swipe away from recent apps)
2. Re-open the app
3. **You should be automatically logged in** (no login screen)
4. Your incident data is still there
5. Status still shows "● Offline"

### Step 5: Go Online and Sync

1. Disable Airplane Mode
2. Status badge changes to "● Online" (green)
3. App automatically syncs in the background
4. Or tap "🔄 Sync Now" to manually trigger sync
5. Incident badge changes to "✓ Synced" (green)
6. Images are uploaded to Firebase Storage
7. Data is now synced to backend/Firebase

## Project Structure

```
APIIT-HACK/
├── src/
│   ├── assets/                     # Static assets
│   ├── components/
│   │   ├── HelpModal.tsx          # Help/tutorial modal
│   │   └── LocationPicker.tsx     # GPS location picker component
│   ├── config/
│   │   └── firebase.ts            # Firebase configuration
│   ├── constants/
│   │   └── config.ts              # API URLs and app constants
│   ├── contexts/
│   │   └── AuthContext.tsx        # Authentication context provider
│   ├── database/
│   │   ├── db.ts                  # SQLite database service
│   │   ├── index.ts               # Database exports
│   │   ├── schema.ts              # Database schema (deprecated)
│   │   └── models/
│   │       ├── AidRequest.ts      # Aid request model
│   │       └── Incident.ts        # Incident model
│   ├── screens/
│   │   ├── LoginScreen.tsx        # Firebase auth login
│   │   ├── RegisterScreen.tsx     # Firebase auth registration
│   │   ├── HomeScreen.tsx         # Dashboard with data lists
│   │   ├── IncidentFormScreen.tsx # Incident reporting form
│   │   ├── AidRequestFormScreen.tsx   # Aid request form
│   │   ├── CampFormScreen.tsx     # Detention camp form
│   │   ├── CampsListScreen.tsx    # Camps list view
│   │   └── VolunteerFormScreen.tsx    # Volunteer registration
│   ├── services/
│   │   ├── authService.ts         # Authentication API service
│   │   ├── cloudSyncService.ts    # Cloud synchronization
│   │   ├── firebaseExamples.ts    # Firebase usage examples
│   │   ├── firebaseInit.ts        # Firebase initialization
│   │   ├── firebaseQueryAPI.ts    # Firebase query utilities
│   │   ├── firebaseService.ts     # Main Firebase service
│   │   ├── firebaseStorageService.ts  # Image upload service
│   │   ├── imageService.ts        # Image handling utilities
│   │   ├── imageSyncService.ts    # Image sync management
│   │   ├── otpService.ts          # OTP verification
│   │   ├── supabaseStorageService.ts  # Alternative storage
│   │   ├── syncService.ts         # Sync engine with NetInfo
│   │   └── tokenStorage.ts        # Secure token storage
│   └── utils/
│       └── appInitializer.ts      # App initialization logic
├── App.tsx                         # Main app entry point
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── babel.config.js                 # Babel config
├── eas.json                        # EAS Build config
├── FIREBASE_SETUP_FIX.md          # Firebase setup guide
├── QUICK_START.md                 # Quick start guide
└── README.md                       # This file
```

## Key Technologies

- **React Native 0.81.5** - Cross-platform mobile framework
- **Expo SDK 54** - Managed React Native workflow
- **TypeScript** - Type-safe development
- **expo-sqlite** - Local SQLite database for offline storage
- **Firebase Auth** - Email/password authentication
- **Firebase Firestore** - Cloud database (optional)
- **Firebase Storage** - Image storage
- **expo-secure-store** - Secure token storage
- **expo-location** - GPS coordinate capture
- **expo-image-picker** - Camera and gallery access
- **@react-native-community/netinfo** - Network status monitoring
- **React Navigation** - Screen navigation
- **react-native-maps** - Map integration with Google Maps

## SQLite Database Schema

### Incidents Table

Stores disaster incident reports:

- `id` (TEXT) - UUID primary key
- `type` (TEXT) - Incident type (Landslide, Flood, Road Block, etc.)
- `severity` (INTEGER) - Severity level (1-5)
- `latitude` (REAL) - GPS latitude
- `longitude` (REAL) - GPS longitude
- `timestamp` (INTEGER) - Unix timestamp in milliseconds
- `status` (TEXT) - Sync status: 'pending', 'synced', 'failed'
- `actionStatus` (TEXT) - Admin action: 'pending', 'taking action', 'completed'
- `description` (TEXT) - Additional incident details
- `localImageUris` (TEXT) - JSON array of local image paths
- `cloudImageUrls` (TEXT) - JSON array of Firebase Storage URLs
- `imageUploadStatuses` (TEXT) - JSON array of upload states
- `imageQualities` (TEXT) - JSON array of quality levels
- `created_at` (INTEGER) - Record creation timestamp
- `updated_at` (INTEGER) - Record update timestamp

### Aid Requests Table

Stores civilian aid requests:

- `id` (TEXT) - UUID primary key
- `user_email` (TEXT) - Requester's email
- `full_name` (TEXT) - Requester's name
- `contact_number` (TEXT) - Phone number
- `district` (TEXT) - Location district
- `address` (TEXT) - Detailed address
- `aid_type` (TEXT) - Type of aid needed (Food, Water, Medical, etc.)
- `priority` (TEXT) - Priority level: 'low', 'medium', 'high', 'critical'
- `description` (TEXT) - Additional details
- `people_count` (INTEGER) - Number of people affected
- `status` (TEXT) - Sync status
- `adminResolved` (BOOLEAN) - Whether admin marked as resolved
- `created_at` (INTEGER) - Timestamp
- `updated_at` (INTEGER) - Timestamp

### Detention Camps Table

Stores camp/shelter information:

- `id` (TEXT) - UUID primary key
- `name` (TEXT) - Camp name
- `latitude` (REAL) - GPS latitude
- `longitude` (REAL) - GPS longitude
- `capacity` (INTEGER) - Maximum capacity
- `current_occupancy` (INTEGER) - Current number of people
- `facilities` (TEXT) - JSON array of available facilities
- `campStatus` (TEXT) - Status: 'operational', 'full', 'closed'
- `contact_person` (TEXT) - Contact name
- `contact_phone` (TEXT) - Contact phone
- `description` (TEXT) - Additional details
- `status` (TEXT) - Sync status
- `adminApproved` (BOOLEAN) - Admin approval status
- `created_at` (INTEGER) - Timestamp
- `updated_at` (INTEGER) - Timestamp

### Volunteers Table

Stores volunteer registrations:

- `id` (TEXT) - UUID primary key
- `user_email` (TEXT) - Volunteer email
- `full_name` (TEXT) - Volunteer name
- `phone_number` (TEXT) - Contact number
- `district` (TEXT) - JSON array of preferred districts
- `skills` (TEXT) - JSON array of skills
- `availability` (TEXT) - Availability schedule
- `preferred_tasks` (TEXT) - JSON array of preferred tasks
- `emergency_contact` (TEXT) - Emergency contact name
- `emergency_phone` (TEXT) - Emergency contact phone
- `status` (TEXT) - Sync status
- `approved` (BOOLEAN) - Admin approval status
- `created_at` (INTEGER) - Timestamp
- `updated_at` (INTEGER) - Timestamp

## Sync Logic Flow

1. **Data Collection**: User submits form → saved to SQLite with `status = 'pending'`
2. **Network Monitoring**: NetInfo continuously monitors connection state
3. **Auto Sync**: When connection restored → SyncService queries unsynced records
4. **API Call**: Posts data to backend or Firebase Firestore
5. **Image Upload**: Uploads images to Firebase Storage (low-res first, then high-res)
6. **Update Local**: On success → marks records as `status = 'synced'`
7. **Error Handling**: On failure → keeps `status = 'pending'` for retry

## Firebase Integration

### Authentication

- Email/password registration with email verification
- Secure session management with expo-secure-store
- Automatic session persistence across app restarts

### Cloud Storage

- Multi-image upload support (up to 3 images per incident)
- Progressive image quality upload (low-res first for faster sync)
- Images stored in Firebase Storage with organized folder structure

### Firestore (Optional)

- Can sync data to Firestore for real-time updates
- Offline persistence enabled for better reliability
- Optimized for mobile performance

## App Configuration

### Expo Config (app.json)

- **App Name**: LankaSafe
- **Package**: com.pasiduchamod.projectaegis
- **Owner**: nimesh26
- **Permissions**: Location, Camera, Storage
- **Google Maps API**: Integrated for map views

### Build Configuration

- EAS Build enabled for production APK generation
- Android adaptive icons configured
- Splash screen with app branding

## Troubleshooting

### "Firebase Auth Error"

- Check Firebase Console → Authentication is enabled
- Verify email/password sign-in method is enabled
- Check firebaseConfig credentials in `src/config/firebase.ts`

### "Network request failed"

- Verify backend server is running (if using custom backend)
- Check API_BASE_URL is correct in `src/constants/config.ts`
- For physical devices, use computer's IP address (not localhost)

### "Location permission denied"

- Go to device Settings → Apps → Expo Go → Permissions
- Enable Location permission

### "Module not found"

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm start -- --clear
```

### Data not syncing

- Check network connection (look for "● Online" badge)
- Verify Firebase configuration is correct
- Check console logs for sync errors
- Try manual sync with "🔄 Sync Now" button
- Verify Firestore security rules allow read/write

### Images not uploading

- Check Firebase Storage is enabled in console
- Verify storage bucket name in firebase config
- Check Firebase Storage security rules
- Ensure device has camera/storage permissions

## Demo Video Checklist

For hackathon judges, demonstrate:

1. ✅ Register new account with Firebase Auth
2. ✅ Enable Airplane Mode
3. ✅ Create and save incident offline (with images)
4. ✅ Create aid request offline
5. ✅ Close and reopen app (still offline)
6. ✅ Show session persists (no login required)
7. ✅ Show data persists (incident still there)
8. ✅ Disable Airplane Mode
9. ✅ Show automatic sync (data + images)
10. ✅ Verify data synced (green ✓ badge)
11. ✅ Show map view with incident locations
12. ✅ Demonstrate volunteer registration
13. ✅ Show detention camp management

## Available Test Data

### Incident Types

- Landslide
- Flood
- Road Block
- Power Line Down
- Trapped Civilians

### Aid Types

- Food
- Drinking Water
- Clothing
- Medical Aid
- Shelter
- Rescue / Evacuation
- Elderly / Child Assistance
- Emergency Supplies

### Sri Lankan Districts

All 25 districts supported for location filtering

## Development Team

Built for disaster management and emergency response in Sri Lanka.

## License

This project was developed for the APIIT Hackathon.

---

**Made with ❤️ for safer communities in Sri Lanka**
