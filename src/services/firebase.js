// Firebase initialization and authentication service

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('🔥 Initializing Firebase...');

let app;
let auth;
let db;
let googleProvider;
let firebaseEnabled = false;

try {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
        throw new Error('Firebase API Key is missing or default. Live features will be disabled.');
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    firebaseEnabled = true;
    console.log('✅ Firebase initialized successfully.');
} catch (error) {
    console.warn('⚠️ Firebase initialization skipped:', error.message);
    // Export nulls or mocks to prevent top-level crashes
    app = null;
    auth = {
        currentUser: null,
        onAuthStateChanged: (cb) => {
            // Immediately trigger with "no user" to allow app to boot into demo mode
            setTimeout(() => cb(null), 0);
            return () => { };
        }
    };
    db = null;
    googleProvider = null;
}

export { auth, db, firebaseEnabled };

function createFirebaseConfigError() {
    const error = new Error('Cloud sync is not configured for this build. Add Firebase env vars to enable Google sign-in.');
    error.code = 'auth/not-configured';
    return error;
}


// Simple popup sign-in
export const signInWithGoogle = async () => {
    if (!firebaseEnabled || !auth || !googleProvider) {
        throw createFirebaseConfigError();
    }
    console.log('🔑 Starting Google sign-in...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Sign-in success:', result.user.email);
    return result.user;
};

export const logout = () => {
    if (!firebaseEnabled || !auth) {
        return Promise.resolve();
    }
    console.log('👋 Signing out...');
    return signOut(auth);
};

// Helper to listen to auth state changes
export const onUserChanged = (callback) => {
    if (!firebaseEnabled && typeof auth?.onAuthStateChanged === 'function') {
        return auth.onAuthStateChanged((user) => {
            console.log('ðŸ‘¤ Auth state change:', user ? user.email : 'No user');
            callback(user);
        });
    }

    return onAuthStateChanged(auth, (user) => {
        console.log('👤 Auth state change:', user ? user.email : 'No user');
        callback(user);
    });
};
