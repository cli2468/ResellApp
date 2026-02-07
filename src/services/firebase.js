// Firebase initialization and authentication service

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD59FLH3amRac3fQjk7YtuHTdpCEofqFq0",
    authDomain: "resell-tracker-5320f.firebaseapp.com",
    projectId: "resell-tracker-5320f",
    storageBucket: "resell-tracker-5320f.firebasestorage.app",
    messagingSenderId: "355958720369",
    appId: "1:355958720369:web:fd3c105d6542889b03d8d0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Check for redirect result on page load
getRedirectResult(auth).catch(console.error);

// Auth functions - use redirect for better mobile support
export const signInWithGoogle = async () => {
    try {
        // Try popup first (works on desktop)
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        // If popup blocked or fails, use redirect (better for mobile)
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }
        console.error("Error signing in with Google:", error);
        throw error;
    }
};

export const logout = () => signOut(auth);

// Helper to listen to auth state changes
export const onUserChanged = (callback) => {
    return onAuthStateChanged(auth, callback);
};
