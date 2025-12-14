import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { CACHE_SIZE_UNLIMITED, initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Suppress Firebase Firestore debug logs (including WebChannel errors)
// Comment out this line if you need to debug Firebase issues
setLogLevel('error');

// Firebase Configuration - Replace with your own config from Firebase Console
// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1jOTH_a-NNdZqR93aOkD7VfQ35lhsnsQ",
  authDomain: "project-aegis-ce5a8.firebaseapp.com",
  projectId: "project-aegis-ce5a8",
  storageBucket: "project-aegis-ce5a8.firebasestorage.app",
  messagingSenderId: "920882154678",
  appId: "1:920882154678:web:eda4aa0a0997471762ea17"
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence and settings
export const db = initializeFirestore(firebaseApp, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true, // Better for React Native - use only this one
  ignoreUndefinedProperties: true, // Prevent crashes from undefined values
});

// Initialize Auth
export const auth = getAuth(firebaseApp);

// Initialize Storage
export const storage = getStorage(firebaseApp);

// Use emulators in development (optional)
// Uncomment these if you want to use Firebase Emulator Suite
// if (__DEV__) {
//   try {
//     connectFirestoreEmulator(db, 'localhost', 8080);
//     connectAuthEmulator(auth, 'http://localhost:9099');
//     connectStorageEmulator(storage, 'localhost', 9199);
//   } catch (error) {
//     console.log('Emulator already connected or error:', error);
//   }
// }

export default firebaseApp;
