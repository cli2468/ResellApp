// Firestore synchronization service
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase.js';

/**
 * Sync lots from Firestore for the current user
 */
export function syncLots(onUpdate) {
    const user = auth.currentUser;
    if (!user) return null;

    const lotsRef = collection(db, 'users', user.uid, 'lots');
    const q = query(lotsRef);

    return onSnapshot(q, (snapshot) => {
        const lots = [];
        snapshot.forEach((doc) => {
            lots.push({ id: doc.id, ...doc.data() });
        });
        onUpdate(lots);
    }, (error) => {
        console.error("Error syncing lots:", error);
    });
}

/**
 * Save or update a lot in Firestore
 */
export async function saveLotToCloud(lot) {
    const user = auth.currentUser;
    if (!user) return;

    const lotRef = doc(db, 'users', user.uid, 'lots', lot.id);
    await setDoc(lotRef, {
        ...lot,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/**
 * Delete a lot from Firestore
 */
export async function deleteLotFromCloud(lotId) {
    const user = auth.currentUser;
    if (!user) return;

    const lotRef = doc(db, 'users', user.uid, 'lots', lotId);
    await deleteDoc(lotRef);
}

/**
 * Batch upload local data to cloud (Initial sync)
 */
export async function uploadLocalData(lots) {
    const user = auth.currentUser;
    if (!user) return;

    const batch = writeBatch(db);
    lots.forEach(lot => {
        const lotRef = doc(db, 'users', user.uid, 'lots', lot.id);
        batch.set(lotRef, {
            ...lot,
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
}
