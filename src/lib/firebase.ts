import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase web config is public by design. Access is controlled by Firebase Auth settings
// (authorized domains, enabled providers), not by keeping these values secret.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/** Returns the Firebase app, creating it once. Throws if the config is missing. */
export function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error('Missing Firebase configuration. Check the VITE_FIREBASE_* values in your .env file.');
  }
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

/**
 * Firebase Auth is created on first use, not at import time. That way a missing config
 * only disables Google sign-in instead of stopping the whole app from loading.
 */
export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/** Analytics is optional. It only starts in a browser that supports it and when a measurement ID is set. */
export function initFirebaseAnalytics(): void {
  if (!firebaseConfigured || !firebaseConfig.measurementId) return;
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(getFirebaseApp());
    })
    .catch(() => {
      // Analytics is not essential. Ignore failures so they don't affect sign-in.
    });
}
