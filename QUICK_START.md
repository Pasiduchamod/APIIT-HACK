# Quick Start Guide - LankaSafe Disaster Response App

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** installed ([Download here](https://nodejs.org/))
- **Git** installed ([Download here](https://git-scm.com/))
- **Expo Go** app on your iOS or Android device ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- A **GitHub account** (for forking)

## Step 1: Get the Code

### Option A: Fork the Repository (Recommended)

1. Go to the GitHub repository: `https://github.com/YOUR-USERNAME/APIIT-HACK`
2. Click the **"Fork"** button in the top-right corner
3. Wait for GitHub to create your copy
4. Clone your forked repository:

```bash
git clone https://github.com/YOUR-USERNAME/APIIT-HACK.git
cd APIIT-HACK
```

### Option B: Clone Directly

```bash
git clone https://github.com/ORIGINAL-USERNAME/APIIT-HACK.git
cd APIIT-HACK
```

## Step 2: Install Dependencies

Run this command in the project folder:

```bash
npm install
```

**Expected output:**

```
added 1234 packages in 45s
```

This installs all required libraries including:

- React Native
- Expo SDK
- Firebase
- SQLite database
- And more...

## Step 3: Configure Firebase (Important!)

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Add a Web app to your project
3. Copy your Firebase configuration
4. Open `src/config/firebase.ts` and replace with your credentials:

```typescript
const firebaseConfig = {
  apiKey: "YOUR-API-KEY",
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  projectId: "YOUR-PROJECT-ID",
  storageBucket: "YOUR-PROJECT.appspot.com",
  messagingSenderId: "YOUR-SENDER-ID",
  appId: "YOUR-APP-ID",
};
```

5. Enable **Authentication** (Email/Password) in Firebase Console
6. Enable **Firestore Database** in Firebase Console
7. Enable **Storage** in Firebase Console

## Step 4: Start the Development Server

```bash
npm start
```

**Expected output:**

```
Starting Metro Bundler
...
Metro waiting on exp://192.168.1.100:8081
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▀█ █ ▄▄▄▄▄ █
  █ █   █ █▀▀▀█ █   █ █
  █ █▄▄▄█ █ ▄ █ █▄▄▄█ █
  █▄▄▄▄▄▄▄█ ▀ █▄▄▄▄▄▄▄█
  ▀▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▀

› Press s │ switch to Expo Go
› Press a │ open Android
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu
```

## Step 5: Open the App on Your Device

### Using Expo Go (Easiest Method)

1. Open **Expo Go** app on your phone
2. **Android:** Scan the QR code using Expo Go app
3. **iOS:** Use your camera app to scan QR code, then tap "Open in Expo Go"
4. Wait for bundle to load (first time: 1-2 minutes)
5. App will open automatically

**Troubleshooting Connection Issues:**

- Make sure your phone and computer are on the **same Wi-Fi network**
- If QR scan doesn't work, press **`s`** in terminal and use the URL shown
- On some networks, you may need to use **tunnel mode**: `npm start -- --tunnel`

### Using Android Emulator (Optional)

1. Install Android Studio
2. Set up an Android Virtual Device (AVD)
3. Start the emulator
4. In the Expo terminal, press **`a`**

### Using iOS Simulator (Mac Only)

1. Install Xcode from Mac App Store
2. In the Expo terminal, press **`i`**

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

## Step 6: Create Your First Account

1. In the app, tap **"Register"**
2. Fill in:
   - Username (e.g., "john_doe")
   - Email (must be valid for verification)
   - Password (min 6 characters)
   - Confirm Password
   - Contact Number
   - Select your District
3. Tap **"Register"**
4. Check your email for verification code (check spam folder)
5. Enter the OTP code
6. You're in! 🎉

## Step 7: Test the App

### Test Offline Features

1. **Enable Airplane Mode** on your device
2. Tap **"+ Report New Incident"**
3. Select incident type, severity, and location
4. Tap **"Submit"**
5. ✅ Incident saved locally
6. Turn off Airplane Mode
7. ✅ App automatically syncs to Firebase

### Test Aid Requests

1. Tap **"+ Request Aid"**
2. Select aid types needed (Food, Water, Medical, etc.)
3. Fill in your details
4. Submit request
5. ✅ Request visible in the Aid Requests tab

## Common Issues & Solutions

### Issue: "Dependencies not installed"

**Solution:**

```bash
rm -rf node_modules
npm install
```

### Issue: "Metro bundler failed"

**Solution:**

```bash
npm start --clear
```

### Issue: "Cannot connect to device"

**Solutions:**

1. Make sure phone and computer are on same Wi-Fi
2. Try tunnel mode: `npm start -- --tunnel`
3. Check firewall isn't blocking port 8081

### Issue: "Firebase errors"

**Solutions:**

1. Verify Firebase config in `src/config/firebase.ts`
2. Enable Authentication, Firestore, and Storage in Firebase Console
3. Check Firebase rules allow read/write

### Issue: "App crashes on startup"

**Solutions:**

1. Clear cache: `npm start -- --clear`
2. Check you've installed all dependencies
3. Check terminal for error messages

### Issue: "QR code not scanning"

**Solutions:**

1. Make sure Expo Go app is up to date
2. Try manually typing the URL shown in terminal
3. Use tunnel mode if on corporate network

## Building for Production

### Build Android APK

```bash
npx eas build -p android --profile preview
```

This creates an APK file you can install on any Android device.

### Build for iOS

```bash
npx eas build -p ios --profile preview
```

Requires Apple Developer account ($99/year).

## App Features

### 📱 Main Features

- **Report Incidents** - Landslides, floods, trapped civilians, etc.
- **Request Aid** - Food, water, medical supplies, shelter
- **View Camps** - Find nearby detention camps
- **Volunteer** - Register as a volunteer helper
- **Offline-First** - Works without internet, syncs when online
- **Real-time Updates** - See incident status updates from dashboard

### 🔐 User Roles

- **Citizens** - Report incidents and request aid
- **Volunteers** - Respond to incidents
- **Admins** - Manage all data via web dashboard (not in mobile app)

### 📍 Screens Overview

**Home Screen:**

- View all incidents and aid requests
- See sync status (Online/Offline)
- Manual sync button
- Quick access to all features

**Report Incident:**

- Select incident type
- Add photos (up to 5)
- Set severity level (1-5)
- GPS location auto-detected
- Works offline

**Request Aid:**

- Select multiple aid types
- Set priority level
- Add contact details
- Describe your situation

**View Camps:**

- See all detention camps
- Filter by status
- View facilities available
- Get directions

**Volunteer:**

- Register as volunteer
- Select skills and availability
- Emergency contact details

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

## Development Workflow

### Making Changes

1. Edit files in `src/` folder
2. Save the file
3. App automatically reloads on your device
4. See changes instantly (Hot Reload)

### Debugging

Press **`j`** in terminal to open debugger, or:

- Shake your device
- Tap "Debug Remote JS"
- Chrome DevTools will open

### Version Control

```bash
# Check status
git status

# Commit changes
git add .
git commit -m "Add new feature"

# Push to your fork
git push origin main

# Keep fork updated
git remote add upstream https://github.com/ORIGINAL-REPO/APIIT-HACK.git
git fetch upstream
git merge upstream/main
```

## Stopping the Server

Press **`Ctrl+C`** in the terminal to stop the development server.

## Project Structure

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

## Useful Commands

```bash
# Start development server
npm start

# Start with cache cleared
npm start -- --clear

# Start with tunnel (for corporate networks)
npm start -- --tunnel

# Run on Android emulator
npm run android

# Run on iOS simulator (Mac only)
npm run ios

# Build for production
npx eas build -p android --profile preview
npx eas build -p ios --profile preview

# Check for TypeScript errors
npx tsc --noEmit

# Install a new package
npm install package-name
```

## Environment Setup (Optional)

Create a `.env` file in the root directory:

```env
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
```

Then update `src/config/firebase.ts` to read from environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m "Add feature"`
6. Push: `git push origin feature-name`
7. Create a Pull Request

## Resources

- **Expo Documentation:** https://docs.expo.dev
- **React Native Docs:** https://reactnative.dev
- **Firebase Docs:** https://firebase.google.com/docs
- **TypeScript Docs:** https://www.typescriptlang.org/docs

## Getting Help

- Check the **Issues** tab on GitHub
- Read existing documentation in the repo
- Ask questions in GitHub Discussions
- Contact the maintainers

## License

Check the LICENSE file in the repository.

---

**Happy coding!** 🚀 Built with ❤️ for disaster response in Sri Lanka.
