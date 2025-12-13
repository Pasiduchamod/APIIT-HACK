# Aid Request Feature - Implementation Summary

## Overview
New "Request Aid" feature allows civilians and responders to request emergency assistance during disasters. The feature works completely offline-first with automatic cloud sync when internet is available.

## Features Implemented

### 1. SQLite Database Schema
**Table: aid_requests**
- `id` (TEXT PRIMARY KEY) - UUID
- `aid_types` (TEXT) - JSON array of selected aid types
- `latitude` (REAL) - GPS latitude
- `longitude` (REAL) - GPS longitude
- `description` (TEXT) - Optional additional details
- `priority_level` (INTEGER) - 1 to 5 (1=Low, 5=Critical)
- `status` (TEXT) - 'pending' | 'synced' | 'failed'
- `created_at` (INTEGER) - Unix timestamp
- `updated_at` (INTEGER) - Unix timestamp

### 2. Aid Types Available
Users can select multiple aid types from:
- Food
- Drinking Water
- Clothing
- Medical Aid
- Shelter
- Rescue / Evacuation
- Elderly / Child Assistance
- Emergency Supplies

### 3. User Interface
**AidRequestFormScreen.tsx**
- Multi-select dropdown for aid types
- Visual chips showing selected aid types (removable)
- Priority level selector (1-5) with color coding
- Optional description text area
- Automatic GPS location capture
- Offline/Online status indicator
- Large, crisis-friendly buttons
- Clear "Saved Locally" confirmation

### 4. Offline-First Architecture
**Data Flow:**
1. User fills out form (works completely offline)
2. GPS location captured automatically (uses last known if no connection)
3. Data saved to SQLite immediately
4. Status marked as 'pending'
5. When online, background sync uploads to Firebase
6. Status updated to 'synced' after successful upload
7. No duplicate uploads - sync is idempotent

**Sync Behavior:**
- Saves locally FIRST (never blocks user)
- Syncs to Firebase in background when online
- Automatic retry on network reconnection
- Manual sync button available on HomeScreen
- Handles partial sync failures gracefully

### 5. Firebase Integration
**Firestore Collection: aid_requests**
- Automatic sync via cloudSyncService
- Batch operations for efficiency
- User ID association for security
- Timestamp tracking for audit trail

### 6. Navigation
**HomeScreen Updates:**
- New blue "Request Aid" button below incident reporting
- Navigates to AidRequestFormScreen
- Maintains existing incident reporting workflow

## Technical Implementation

### Files Created/Modified

**Created:**
1. `src/database/models/AidRequest.ts` - TypeScript interface
2. `src/screens/AidRequestFormScreen.tsx` - Main form component

**Modified:**
1. `src/database/db.ts` - Added aid_requests table and CRUD operations
2. `src/constants/config.ts` - Added AID_TYPES constant array
3. `src/services/cloudSyncService.ts` - Added aid request syncing
4. `src/services/firebaseService.ts` - Added Firebase aid request operations
5. `src/screens/HomeScreen.tsx` - Added navigation button
6. `App.tsx` - Added AidRequestForm navigation route

### Key Functions

**Database Operations (db.ts):**
- `createAidRequest()` - Save new aid request
- `getAllAidRequests()` - Retrieve all requests
- `getPendingAidRequests()` - Get unsynced requests
- `updateAidRequestStatus()` - Update sync status
- `getPendingAidRequestsCount()` - Count pending requests

**Cloud Sync (cloudSyncService.ts):**
- Enhanced `syncToCloud()` to handle both incidents and aid requests
- Parallel sync operations
- Error handling for partial failures

**Firebase Operations (firebaseService.ts):**
- `createAidRequest()` - Create single request in Firestore
- `syncAidRequests()` - Batch sync with retry logic
- `getAllAidRequests()` - Retrieve from cloud
- `getAidRequestsByUser()` - User-specific queries

## Crisis Design Considerations

1. **Large Touch Targets** - All buttons minimum 44pt height
2. **High Contrast** - Dark backgrounds with white text
3. **Clear Status** - ONLINE/OFFLINE badge always visible
4. **No Blocking** - Form never waits for network
5. **Visual Feedback** - Color-coded priority levels (green to red)
6. **Simple Language** - Clear labels and instructions
7. **Forgiving Input** - Description is optional
8. **Multiple Aid Types** - Can select as many as needed

## Demo Flow

1. Open app → Login
2. HomeScreen shows "Request Aid" button (blue)
3. Tap → AidRequestFormScreen opens
4. Select aid type(s) from dropdown, tap "Add"
5. Set priority level (1-5)
6. Add description (optional)
7. GPS location captured automatically
8. Submit → Saved locally instantly
9. Alert confirms save (mentions offline/online status)
10. Returns to HomeScreen
11. Data syncs to cloud automatically when online

## Testing Scenarios

### Offline Mode
1. Turn off WiFi/cellular
2. Submit aid request
3. Data saved to SQLite
4. Turn on network
5. Auto-sync uploads to Firebase
6. Status updates to 'synced'

### Online Mode
1. Submit aid request with network
2. Saves to SQLite immediately
3. Background sync to Firebase
4. Confirmation alert shown

### App Restart
1. Submit requests (offline or online)
2. Force quit app
3. Restart app
4. All data persists in SQLite
5. Unsynced requests auto-sync on next network connection

## Future Enhancements (Not Implemented)
- View list of submitted aid requests
- Edit/cancel pending requests
- Status updates (received, en route, delivered)
- Push notifications when aid is dispatched
- Map view of aid requests
- Priority-based sorting

## Hackathon Talking Points

1. **Offline-First** - Works in disaster zones with no connectivity
2. **Simple UX** - Designed for high-stress situations
3. **No Data Loss** - SQLite ensures persistence across app restarts
4. **Scalable** - Firebase backend handles load
5. **Secure** - User ID association prevents tampering
6. **Reliable** - Automatic retry and sync status tracking
7. **Fast** - Immediate local save, background sync
8. **Crisis-Ready** - No photo uploads, large buttons, clear priority levels

## Architecture Highlights

- **React Native + Expo** - Cross-platform mobile
- **TypeScript** - Type safety and better DX
- **Expo SQLite** - Local persistence
- **Firebase Firestore** - Cloud database
- **NetInfo** - Network state monitoring
- **Expo Location** - GPS with offline fallback

This feature makes the app truly useful in real disaster scenarios where network connectivity is unreliable but aid coordination is critical.
